import type { DeepPartial, ObjectLiteral } from 'typeorm';
import { auditService, type AuditService } from '@/modules/audit/audit.service';
import { NotFoundError } from '@/shared/errors';
import type { BaseRepository } from '@/shared/repositories/base.repository';
import type { Paginated, QueryOptions } from '@/shared/types/pagination';
import { cacheService, type CacheService } from './cache.service';
import type { RequestContext } from './request-context';

export type CrudServiceConfig = {
  /** Resource key used by the audit trail and by cache namespaces. */
  resource: string;
  /** Human readable label used in error messages (pt-BR). */
  label: string;
  /** Disables audit records for high-volume, low-value resources. */
  audit?: boolean;
};

/**
 * Application service shared by every CRUD module.
 *
 * Responsibilities kept here: authorization scope propagation, not-found
 * handling, audit trail and cache invalidation. Domain rules live in the
 * subclasses through the `before*` / `after*` hooks — Open/Closed in practice.
 */
export abstract class BaseCrudService<
  T extends ObjectLiteral,
  CreateDTO extends object = Record<string, unknown>,
  UpdateDTO extends object = Partial<CreateDTO>,
> {
  protected constructor(
    protected readonly repository: BaseRepository<T>,
    protected readonly config: CrudServiceConfig,
    protected readonly audit: AuditService = auditService,
    protected readonly cache: CacheService = cacheService,
  ) {}

  async list(ctx: RequestContext, options: QueryOptions): Promise<Paginated<T>> {
    return this.repository.findMany(ctx.scope, options);
  }

  async findById(ctx: RequestContext, id: string): Promise<T> {
    const entity = await this.repository.findById(ctx.scope, id);
    if (!entity) throw new NotFoundError(this.config.label);
    return entity;
  }

  async create(ctx: RequestContext, dto: CreateDTO): Promise<T> {
    const payload = await this.beforeCreate(ctx, dto);
    const created = await this.repository.create(ctx.scope, payload);

    await this.afterCreate(ctx, created, dto);
    await this.invalidateCache(ctx);
    await this.writeAudit(ctx, 'CREATE', created, null, this.toAuditSnapshot(created));

    return created;
  }

  async update(ctx: RequestContext, id: string, dto: UpdateDTO): Promise<T> {
    const current = await this.findById(ctx, id);
    const payload = await this.beforeUpdate(ctx, current, dto);
    const updated = await this.repository.update(ctx.scope, id, payload);
    if (!updated) throw new NotFoundError(this.config.label);

    await this.afterUpdate(ctx, updated, current, dto);
    await this.invalidateCache(ctx);
    await this.writeAudit(
      ctx,
      'UPDATE',
      updated,
      this.toAuditSnapshot(current),
      this.toAuditSnapshot(updated),
    );

    return updated;
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    const current = await this.findById(ctx, id);
    await this.beforeRemove(ctx, current);

    const removed = await this.repository.softDelete(ctx.scope, id);
    if (!removed) throw new NotFoundError(this.config.label);

    await this.afterRemove(ctx, current);
    await this.invalidateCache(ctx);
    await this.writeAudit(ctx, 'DELETE', current, this.toAuditSnapshot(current), null);
  }

  async restore(ctx: RequestContext, id: string): Promise<T> {
    const restored = await this.repository.restore(ctx.scope, id);
    if (!restored) throw new NotFoundError(this.config.label);

    const entity = await this.findById(ctx, id);
    await this.invalidateCache(ctx);
    await this.writeAudit(ctx, 'RESTORE', entity, null, this.toAuditSnapshot(entity));
    return entity;
  }

  // ---------------------------------------------------------------------------
  // Extension points
  // ---------------------------------------------------------------------------

  protected async beforeCreate(_ctx: RequestContext, dto: CreateDTO): Promise<DeepPartial<T>> {
    return dto as unknown as DeepPartial<T>;
  }

  protected async afterCreate(_ctx: RequestContext, _entity: T, _dto: CreateDTO): Promise<void> {}

  protected async beforeUpdate(
    _ctx: RequestContext,
    _current: T,
    dto: UpdateDTO,
  ): Promise<DeepPartial<T>> {
    return dto as unknown as DeepPartial<T>;
  }

  protected async afterUpdate(
    _ctx: RequestContext,
    _entity: T,
    _previous: T,
    _dto: UpdateDTO,
  ): Promise<void> {}

  protected async beforeRemove(_ctx: RequestContext, _entity: T): Promise<void> {}

  protected async afterRemove(_ctx: RequestContext, _entity: T): Promise<void> {}

  // ---------------------------------------------------------------------------
  // Infrastructure helpers
  // ---------------------------------------------------------------------------

  protected cacheNamespace(ctx: RequestContext): string {
    return `tenant:${ctx.scope.tenantId}:${this.config.resource}:`;
  }

  protected async invalidateCache(ctx: RequestContext): Promise<void> {
    await this.cache.delByPrefix(this.cacheNamespace(ctx));
    await this.cache.delByPrefix(`tenant:${ctx.scope.tenantId}:dashboard:`);
  }

  /** Relations are dropped from the trail to keep the payload bounded. */
  protected toAuditSnapshot(entity: T): Record<string, unknown> {
    return Object.entries(entity as ObjectLiteral).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
          return acc;
        }
        if (Array.isArray(value)) return acc;
        acc[key] = value;
        return acc;
      },
      {},
    );
  }

  protected async writeAudit(
    ctx: RequestContext,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
    entity: T,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    if (this.config.audit === false) return;
    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action,
      resource: this.config.resource,
      resourceId: (entity as ObjectLiteral).id as string,
      description: `${action} ${this.config.label}`,
      before,
      after,
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }
}
