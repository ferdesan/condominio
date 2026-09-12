import type { DeepPartial, ObjectLiteral } from 'typeorm';
import { BaseCrudService, type CrudServiceConfig } from './base-crud.service';
import { assertCondominiumAccess } from './reference-guard';
import type { RequestContext } from './request-context';
import type { BaseRepository } from '@/shared/repositories/base.repository';

type WithCondominium = { condominiumId?: string };

/**
 * Base para todos os recursos pertencentes a um condominio.
 *
 * Centraliza a verificacao de que o condominio informado existe no tenant e
 * esta no escopo do usuario — a regra mais critica do modelo multi-tenant e a
 * que mais se repetiria se cada modulo a implementasse por conta propria.
 * Subclasses estendem `prepareCreate` / `prepareUpdate` no lugar dos hooks
 * `beforeCreate` / `beforeUpdate`.
 */
export abstract class CondominiumScopedService<
  T extends ObjectLiteral,
  CreateDTO extends object = WithCondominium,
  UpdateDTO extends object = Partial<CreateDTO>,
> extends BaseCrudService<T, CreateDTO, UpdateDTO> {
  protected constructor(repository: BaseRepository<T>, config: CrudServiceConfig) {
    super(repository, config);
  }

  protected override async beforeCreate(
    ctx: RequestContext,
    dto: CreateDTO,
  ): Promise<DeepPartial<T>> {
    const { condominiumId } = dto as WithCondominium;
    if (condominiumId) await assertCondominiumAccess(ctx.scope, condominiumId);
    return this.prepareCreate(ctx, dto);
  }

  protected override async beforeUpdate(
    ctx: RequestContext,
    current: T,
    dto: UpdateDTO,
  ): Promise<DeepPartial<T>> {
    const { condominiumId } = dto as WithCondominium;
    if (condominiumId && condominiumId !== current.condominiumId) {
      await assertCondominiumAccess(ctx.scope, condominiumId);
    }
    return this.prepareUpdate(ctx, current, dto);
  }

  protected async prepareCreate(_ctx: RequestContext, dto: CreateDTO): Promise<DeepPartial<T>> {
    return dto as unknown as DeepPartial<T>;
  }

  protected async prepareUpdate(
    _ctx: RequestContext,
    _current: T,
    dto: UpdateDTO,
  ): Promise<DeepPartial<T>> {
    return dto as unknown as DeepPartial<T>;
  }
}
