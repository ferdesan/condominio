import type { DeepPartial } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { BusinessRuleError, ConflictError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import type { RequestContext } from '@/shared/services/request-context';
import { Block } from './block.entity';
import { blockRepository, type BlockRepository } from './block.repository';
import type { CreateBlockDTO, UpdateBlockDTO } from './block.schema';

export class BlockService extends CondominiumScopedService<Block, CreateBlockDTO, UpdateBlockDTO> {
  constructor(private readonly blocks: BlockRepository = blockRepository) {
    super(blocks, { resource: 'block', label: 'Bloco' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateBlockDTO,
  ): Promise<DeepPartial<Block>> {
    if (await this.blocks.nameTaken(ctx.scope, dto.condominiumId, dto.name)) {
      throw new ConflictError('Ja existe um bloco com este nome neste condominio.');
    }
    return dto as DeepPartial<Block>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Block,
    dto: UpdateBlockDTO,
  ): Promise<DeepPartial<Block>> {
    const name = dto.name ?? current.name;
    const condominiumId = dto.condominiumId ?? current.condominiumId;

    if (
      (dto.name || dto.condominiumId) &&
      (await this.blocks.nameTaken(ctx.scope, condominiumId, name, current.id))
    ) {
      throw new ConflictError('Ja existe um bloco com este nome neste condominio.');
    }
    return dto as DeepPartial<Block>;
  }

  protected override async beforeRemove(ctx: RequestContext, entity: Block): Promise<void> {
    const row = await AppDataSource.createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from('units', 'unit')
      .where('unit.block_id = :blockId', { blockId: entity.id })
      .andWhere('unit.tenant_id = :tenantId', { tenantId: ctx.scope.tenantId })
      .andWhere('unit.deleted_at IS NULL')
      .getRawOne<{ total: string }>();

    if (Number(row?.total ?? 0) > 0) {
      throw new BusinessRuleError('Bloco possui unidades vinculadas e nao pode ser removido.');
    }
  }
}

export const blockService = new BlockService();
