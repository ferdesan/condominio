import {
  Brackets,
  type DeepPartial,
  type EntityTarget,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { paginated, type Paginated, type QueryOptions } from '@/shared/types/pagination';
import type { ICrudRepository, RepositoryConfig, TenantScope } from './types';

/**
 * Generic, tenant-aware data access layer built on top of TypeORM.
 *
 * Concrete repositories only declare *what* is queryable (searchable /
 * filterable fields, relations, default ordering); the *how* — tenant scoping,
 * pagination, soft deletes, field whitelisting — lives here once.
 */
export abstract class BaseRepository<T extends ObjectLiteral> implements ICrudRepository<T> {
  protected readonly config: RepositoryConfig;

  protected constructor(
    private readonly target: EntityTarget<T>,
    config: Partial<RepositoryConfig> & Pick<RepositoryConfig, 'alias'>,
  ) {
    this.config = {
      searchableFields: [],
      filterableFields: [],
      relations: [],
      defaultSort: { field: 'createdAt', order: 'DESC' },
      ...config,
    };
  }

  /** Resolved lazily so the data source can be initialised after module load. */
  protected get repository(): Repository<T> {
    return AppDataSource.getRepository(this.target);
  }

  get alias(): string {
    return this.config.alias;
  }

  async findMany(scope: TenantScope, options: QueryOptions): Promise<Paginated<T>> {
    const qb = this.baseQuery(scope, options.includeDeleted);
    this.applyFilters(qb, options.filters);
    this.applySearch(qb, options.search);
    this.applySorting(qb, options.sortBy, options.sortOrder);

    const page = Math.max(1, options.page);
    const perPage = Math.min(Math.max(1, options.perPage), 200);
    qb.skip((page - 1) * perPage).take(perPage);

    const [rows, total] = await qb.getManyAndCount();
    return paginated(rows, total, page, perPage);
  }

  async findById(scope: TenantScope, id: string, withDeleted = false): Promise<T | null> {
    const qb = this.baseQuery(scope, withDeleted);
    qb.andWhere(`${this.alias}.id = :id`, { id });
    return qb.getOne();
  }

  async findOneBy(scope: TenantScope, where: Partial<Record<keyof T, unknown>>): Promise<T | null> {
    const qb = this.baseQuery(scope);
    this.applyWhereObject(qb, where);
    return qb.getOne();
  }

  async findAllBy(
    scope: TenantScope,
    where: Partial<Record<keyof T, unknown>>,
    limit = 500,
  ): Promise<T[]> {
    const qb = this.baseQuery(scope);
    this.applyWhereObject(qb, where);
    this.applySorting(qb, this.config.defaultSort.field, this.config.defaultSort.order);
    return qb.take(limit).getMany();
  }

  async create(scope: TenantScope, data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create({ ...data, tenantId: scope.tenantId } as DeepPartial<T>);
    const saved = await this.repository.save(entity);
    return (await this.findById(scope, (saved as ObjectLiteral).id as string)) ?? saved;
  }

  async update(scope: TenantScope, id: string, data: DeepPartial<T>): Promise<T | null> {
    const current = await this.findById(scope, id);
    if (!current) return null;
    // Neither the primary key nor the tenant can be patched from the outside.
    const { tenantId: _tenantId, id: _id, ...patch } = data as ObjectLiteral;
    const merged = this.repository.merge(current, patch as DeepPartial<T>);
    await this.repository.save(merged);
    return this.findById(scope, id);
  }

  async softDelete(scope: TenantScope, id: string): Promise<boolean> {
    const current = await this.findById(scope, id);
    if (!current) return false;
    await this.repository.softRemove(current);
    return true;
  }

  async restore(scope: TenantScope, id: string): Promise<boolean> {
    const current = await this.findById(scope, id, true);
    if (!current) return false;
    await this.repository.recover(current);
    return true;
  }

  async count(scope: TenantScope, where: Partial<Record<keyof T, unknown>> = {}): Promise<number> {
    const qb = this.baseQuery(scope);
    this.applyWhereObject(qb, where);
    return qb.getCount();
  }

  async exists(scope: TenantScope, where: Partial<Record<keyof T, unknown>>): Promise<boolean> {
    return (await this.count(scope, where)) > 0;
  }

  /** Bulk persistence used by seeders and batch imports; still tenant-scoped. */
  async saveMany(scope: TenantScope, items: DeepPartial<T>[]): Promise<T[]> {
    const entities = items.map((item) =>
      this.repository.create({ ...item, tenantId: scope.tenantId } as DeepPartial<T>),
    );
    return this.repository.save(entities);
  }

  /**
   * Escape hatch for module-specific aggregations: tenant and condominium
   * predicates are already applied, callers only add their own clauses.
   */
  query(scope: TenantScope, withDeleted = false): SelectQueryBuilder<T> {
    return this.baseQuery(scope, withDeleted);
  }

  protected baseQuery(scope: TenantScope, withDeleted = false): SelectQueryBuilder<T> {
    const qb = this.repository.createQueryBuilder(this.alias);

    if (scope.superAdmin) {
      qb.where('1 = 1');
    } else {
      qb.where(`${this.alias}.tenantId = :scopedTenantId`, { scopedTenantId: scope.tenantId });
    }

    const { condominiumField } = this.config;
    if (condominiumField && scope.condominiumIds?.length) {
      qb.andWhere(`${this.alias}.${condominiumField} IN (:...scopedCondominiums)`, {
        scopedCondominiums: scope.condominiumIds,
      });
    }

    for (const relation of this.config.relations) {
      const [parent, child] = relation.includes('.')
        ? relation.split('.')
        : [this.alias, relation];
      qb.leftJoinAndSelect(`${parent}.${child}`, relation.replace(/\./g, '_'));
    }

    if (withDeleted) qb.withDeleted();

    return qb;
  }

  protected applyFilters(qb: SelectQueryBuilder<T>, filters: Record<string, unknown>): void {
    for (const [field, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      if (!this.config.filterableFields.includes(field)) continue;

      const param = `filter_${field}`;
      if (Array.isArray(value)) {
        if (!value.length) continue;
        qb.andWhere(`${this.alias}.${field} IN (:...${param})`, { [param]: value });
      } else {
        qb.andWhere(`${this.alias}.${field} = :${param}`, { [param]: value });
      }
    }
  }

  protected applySearch(qb: SelectQueryBuilder<T>, search?: string): void {
    const term = search?.trim();
    if (!term || !this.config.searchableFields.length) return;

    qb.andWhere(
      new Brackets((builder) => {
        this.config.searchableFields.forEach((field, index) => {
          const expression = `${this.alias}.${field} LIKE :searchTerm`;
          if (index === 0) builder.where(expression, { searchTerm: `%${term}%` });
          else builder.orWhere(expression, { searchTerm: `%${term}%` });
        });
      }),
    );
  }

  protected applySorting(
    qb: SelectQueryBuilder<T>,
    sortBy: string | undefined,
    sortOrder: 'ASC' | 'DESC',
  ): void {
    // Only whitelisted columns can reach the ORDER BY clause (SQL injection guard).
    const sortable = new Set([
      ...this.config.filterableFields,
      ...this.config.searchableFields,
      'createdAt',
      'updatedAt',
    ]);
    const isAllowed = Boolean(sortBy && sortable.has(sortBy));
    const field = isAllowed ? (sortBy as string) : this.config.defaultSort.field;
    const order = isAllowed ? sortOrder : this.config.defaultSort.order;
    qb.orderBy(`${this.alias}.${field}`, order);
  }

  private applyWhereObject(
    qb: SelectQueryBuilder<T>,
    where: Partial<Record<keyof T, unknown>>,
  ): void {
    for (const [field, value] of Object.entries(where)) {
      if (value === undefined) continue;
      const param = `where_${field}`;
      if (value === null) {
        qb.andWhere(`${this.alias}.${field} IS NULL`);
      } else if (Array.isArray(value)) {
        if (!value.length) {
          qb.andWhere('1 = 0');
          continue;
        }
        qb.andWhere(`${this.alias}.${field} IN (:...${param})`, { [param]: value });
      } else {
        qb.andWhere(`${this.alias}.${field} = :${param}`, { [param]: value });
      }
    }
  }

  /** Typed helper for the rare cases a module needs plain TypeORM find options. */
  protected whereWithTenant(scope: TenantScope, where: FindOptionsWhere<T> = {}): FindOptionsWhere<T> {
    return scope.superAdmin
      ? where
      : ({ ...where, tenantId: scope.tenantId } as FindOptionsWhere<T>);
  }
}
