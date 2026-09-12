import type { DeepPartial, Repository } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { paginated, type Paginated, type QueryOptions } from '@/shared/types/pagination';
import { Tenant } from './tenant.entity';

/**
 * O tenant e a raiz do escopo, portanto nao usa BaseRepository (que sempre
 * filtra por `tenant_id`). Todo acesso aqui e restrito a operadores da
 * plataforma ou ao proprio tenant autenticado.
 */
export class TenantRepository {
  private get repository(): Repository<Tenant> {
    return AppDataSource.getRepository(Tenant);
  }

  async findMany(options: QueryOptions): Promise<Paginated<Tenant>> {
    const qb = this.repository.createQueryBuilder('tenant');

    if (options.search) {
      qb.where('(tenant.name LIKE :search OR tenant.slug LIKE :search OR tenant.document LIKE :search)', {
        search: `%${options.search}%`,
      });
    }
    if (typeof options.filters.status === 'string') {
      qb.andWhere('tenant.status = :status', { status: options.filters.status });
    }
    if (typeof options.filters.plan === 'string') {
      qb.andWhere('tenant.plan = :plan', { plan: options.filters.plan });
    }
    if (options.includeDeleted) qb.withDeleted();

    const page = Math.max(1, options.page);
    const perPage = Math.min(Math.max(1, options.perPage), 200);

    qb.orderBy('tenant.name', 'ASC')
      .skip((page - 1) * perPage)
      .take(perPage);

    const [rows, total] = await qb.getManyAndCount();
    return paginated(rows, total, page, perPage);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { slug } });
  }

  async findByDocument(document: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { document } });
  }

  async create(data: DeepPartial<Tenant>): Promise<Tenant> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: string, data: DeepPartial<Tenant>): Promise<Tenant | null> {
    const current = await this.findById(id);
    if (!current) return null;
    return this.repository.save(this.repository.merge(current, data));
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return Boolean(result.affected);
  }

  async countCondominiums(tenantId: string): Promise<number> {
    return this.repository.manager
      .createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from('condominiums', 'c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL')
      .getRawOne<{ total: string }>()
      .then((row) => Number(row?.total ?? 0));
  }
}

export const tenantRepository = new TenantRepository();
