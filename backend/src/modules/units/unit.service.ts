import type { DeepPartial } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { blockRepository, type BlockRepository } from '@/modules/blocks/block.repository';
import {
  condominiumRepository,
  type CondominiumRepository,
} from '@/modules/condominiums/condominium.repository';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import type { RequestContext } from '@/shared/services/request-context';
import { Unit } from './unit.entity';
import { unitRepository, type UnitRepository } from './unit.repository';
import type { BulkCreateUnitsDTO, CreateUnitDTO, UpdateUnitDTO } from './unit.schema';

export class UnitService extends CondominiumScopedService<Unit, CreateUnitDTO, UpdateUnitDTO> {
  constructor(
    private readonly units: UnitRepository = unitRepository,
    private readonly blocks: BlockRepository = blockRepository,
    private readonly condominiums: CondominiumRepository = condominiumRepository,
  ) {
    super(units, { resource: 'unit', label: 'Unidade' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateUnitDTO,
  ): Promise<DeepPartial<Unit>> {
    await this.assertBlockBelongsToCondominium(ctx, dto.blockId, dto.condominiumId);

    if (await this.units.numberTaken(ctx.scope, dto.blockId, dto.number)) {
      throw new ConflictError('Ja existe uma unidade com este numero neste bloco.');
    }

    return dto as DeepPartial<Unit>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Unit,
    dto: UpdateUnitDTO,
  ): Promise<DeepPartial<Unit>> {
    const blockId = dto.blockId ?? current.blockId;
    const condominiumId = dto.condominiumId ?? current.condominiumId;

    if (dto.blockId || dto.condominiumId) {
      await this.assertBlockBelongsToCondominium(ctx, blockId, condominiumId);
    }

    if (
      (dto.number || dto.blockId) &&
      (await this.units.numberTaken(ctx.scope, blockId, dto.number ?? current.number, current.id))
    ) {
      throw new ConflictError('Ja existe uma unidade com este numero neste bloco.');
    }

    return dto as DeepPartial<Unit>;
  }

  protected override async afterCreate(ctx: RequestContext, entity: Unit): Promise<void> {
    await this.condominiums.refreshUnitCounter(ctx.scope.tenantId, entity.condominiumId);
  }

  protected override async beforeRemove(ctx: RequestContext, entity: Unit): Promise<void> {
    const residents = await this.countRelated('residents', ctx.scope.tenantId, entity.id);
    if (residents > 0) {
      throw new BusinessRuleError('Unidade possui moradores ativos e nao pode ser removida.');
    }

    const openCharges = await this.countRelated(
      'charges',
      ctx.scope.tenantId,
      entity.id,
      "status IN ('PENDING','OVERDUE','PARTIAL')",
    );
    if (openCharges > 0) {
      throw new BusinessRuleError('Unidade possui cobrancas em aberto e nao pode ser removida.');
    }
  }

  protected override async afterRemove(ctx: RequestContext, entity: Unit): Promise<void> {
    await this.condominiums.refreshUnitCounter(ctx.scope.tenantId, entity.condominiumId);
  }

  /**
   * Cadastro em lote de um bloco inteiro. Executado em transacao: um erro de
   * numeracao no meio do processo nao pode deixar o bloco parcialmente criado.
   */
  async bulkCreate(ctx: RequestContext, dto: BulkCreateUnitsDTO): Promise<{ created: number }> {
    await this.assertBlockBelongsToCondominium(ctx, dto.blockId, dto.condominiumId);

    const existing = await this.units.listByCondominium(ctx.scope, dto.condominiumId);
    const takenNumbers = new Set(
      existing.filter((unit) => unit.blockId === dto.blockId).map((unit) => unit.number),
    );

    const payload: DeepPartial<Unit>[] = [];
    for (let floorOffset = 0; floorOffset < dto.floors; floorOffset += 1) {
      const floor = dto.startFloor + floorOffset;
      for (let index = 1; index <= dto.unitsPerFloor; index += 1) {
        const number = dto.numberPattern
          .replace('{floor}', String(floor))
          .replace('{index}', String(index).padStart(2, '0'));

        if (takenNumbers.has(number)) continue;
        takenNumbers.add(number);

        payload.push({
          tenantId: ctx.scope.tenantId,
          condominiumId: dto.condominiumId,
          blockId: dto.blockId,
          number,
          floor,
          type: dto.type,
          status: 'VACANT',
          monthlyFee: dto.monthlyFee,
          area: dto.area ?? null,
        });
      }
    }

    if (!payload.length) {
      throw new BusinessRuleError('Nenhuma unidade nova foi gerada: todos os numeros ja existem.');
    }

    await AppDataSource.transaction(async (manager) => {
      await manager.save(
        payload.map((item) => manager.create(Unit, item)),
        { chunk: 100 },
      );
    });

    await this.condominiums.refreshUnitCounter(ctx.scope.tenantId, dto.condominiumId);
    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'CREATE',
      resource: 'unit',
      resourceId: dto.blockId,
      description: `Criacao em lote de ${payload.length} unidades.`,
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return { created: payload.length };
  }

  /** Soma das fracoes ideais: usada para conferir o rateio das despesas. */
  async idealFractionSummary(
    ctx: RequestContext,
    condominiumId: string,
  ): Promise<{ total: number; isBalanced: boolean }> {
    const total = await this.units.sumIdealFraction(ctx.scope, condominiumId);
    return { total, isBalanced: Math.abs(total - 1) < 0.0001 };
  }

  private async assertBlockBelongsToCondominium(
    ctx: RequestContext,
    blockId: string,
    condominiumId: string,
  ): Promise<void> {
    const block = await this.blocks.findById(ctx.scope, blockId);
    if (!block) throw new NotFoundError('Bloco');
    if (block.condominiumId !== condominiumId) {
      throw new BusinessRuleError('O bloco informado pertence a outro condominio.');
    }
  }

  private async countRelated(
    table: string,
    tenantId: string,
    unitId: string,
    extraCondition?: string,
  ): Promise<number> {
    const qb = AppDataSource.createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from(table, 'related')
      .where('related.tenant_id = :tenantId', { tenantId })
      .andWhere('related.unit_id = :unitId', { unitId })
      .andWhere('related.deleted_at IS NULL');

    if (extraCondition) qb.andWhere(extraCondition);

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }
}

export const unitService = new UnitService();
