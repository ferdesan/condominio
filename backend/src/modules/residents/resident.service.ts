import type { DeepPartial } from 'typeorm';
import { unitRepository, type UnitRepository } from '@/modules/units/unit.repository';
import { BusinessRuleError, ConflictError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { resolveUnitCondominium } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { isValidCpf } from '@/shared/utils/document.util';
import { Resident } from './resident.entity';
import { residentRepository, type ResidentRepository } from './resident.repository';
import type { CreateResidentDTO, UpdateResidentDTO } from './resident.schema';

export class ResidentService extends CondominiumScopedService<
  Resident,
  CreateResidentDTO,
  UpdateResidentDTO
> {
  constructor(
    private readonly residents: ResidentRepository = residentRepository,
    private readonly units: UnitRepository = unitRepository,
  ) {
    super(residents, { resource: 'resident', label: 'Morador' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateResidentDTO,
  ): Promise<DeepPartial<Resident>> {
    const condominiumId = await resolveUnitCondominium(ctx.scope, dto.unitId);
    if (condominiumId !== dto.condominiumId) {
      throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
    }

    await this.assertDocument(ctx, dto.document ?? null);

    return {
      ...dto,
      // O aceite do termo LGPD e registrado quando o morador informa dados pessoais.
      lgpdConsentAt: dto.document || dto.email ? new Date() : null,
    } as DeepPartial<Resident>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Resident,
    dto: UpdateResidentDTO,
  ): Promise<DeepPartial<Resident>> {
    if (dto.unitId && dto.unitId !== current.unitId) {
      const condominiumId = await resolveUnitCondominium(ctx.scope, dto.unitId);
      if (condominiumId !== (dto.condominiumId ?? current.condominiumId)) {
        throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
      }
    }

    if (dto.document && dto.document !== current.document) {
      await this.assertDocument(ctx, dto.document, current.id);
    }

    return dto as DeepPartial<Resident>;
  }

  protected override async afterCreate(ctx: RequestContext, entity: Resident): Promise<void> {
    await this.enforceSinglePrimary(ctx, entity);
    await this.syncUnitStatus(ctx, entity.unitId);
  }

  protected override async afterUpdate(
    ctx: RequestContext,
    entity: Resident,
    previous: Resident,
  ): Promise<void> {
    await this.enforceSinglePrimary(ctx, entity);
    await this.syncUnitStatus(ctx, entity.unitId);
    if (previous.unitId !== entity.unitId) {
      await this.syncUnitStatus(ctx, previous.unitId);
    }
  }

  protected override async afterRemove(ctx: RequestContext, entity: Resident): Promise<void> {
    await this.syncUnitStatus(ctx, entity.unitId);
  }

  /** Moradores da unidade do proprio usuario logado (portal do morador). */
  async myUnitResidents(ctx: RequestContext): Promise<Resident[]> {
    if (!ctx.actor.unitId) return [];
    return this.residents.findAllBy(ctx.scope, { unitId: ctx.actor.unitId });
  }

  private async assertDocument(
    ctx: RequestContext,
    document: string | null,
    exceptId?: string,
  ): Promise<void> {
    if (!document) return;

    if (!isValidCpf(document)) {
      throw new BusinessRuleError('CPF informado e invalido.');
    }
    if (await this.residents.documentTaken(ctx.scope, document, exceptId)) {
      throw new ConflictError('Ja existe um morador cadastrado com este CPF.');
    }
  }

  /** Apenas um responsavel por unidade: e quem recebe cobrancas e comunicados. */
  private async enforceSinglePrimary(ctx: RequestContext, entity: Resident): Promise<void> {
    if (!entity.isPrimary) return;
    await this.residents.clearPrimaryFlag(ctx.scope, entity.unitId, entity.id);
  }

  /** Unidade ocupada quando ha ao menos um morador ativo. */
  private async syncUnitStatus(ctx: RequestContext, unitId: string): Promise<void> {
    const unit = await this.units.findById(ctx.scope, unitId);
    if (!unit || unit.status === 'RENOVATION' || unit.status === 'BLOCKED') return;

    const activeResidents = await this.residents.countActiveByUnit(ctx.scope, unitId);
    const nextStatus = activeResidents > 0 ? 'OCCUPIED' : 'VACANT';

    if (unit.status !== nextStatus) {
      await this.units.update(ctx.scope, unitId, { status: nextStatus });
    }
  }
}

export const residentService = new ResidentService();
