import type { DeepPartial } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { tenantRepository, type TenantRepository } from '@/modules/tenants/tenant.repository';
import { BusinessRuleError, ConflictError } from '@/shared/errors';
import { BaseCrudService } from '@/shared/services/base-crud.service';
import type { RequestContext } from '@/shared/services/request-context';
import { Condominium } from './condominium.entity';
import { condominiumRepository, type CondominiumRepository } from './condominium.repository';
import type { CreateCondominiumDTO, UpdateCondominiumDTO } from './condominium.schema';

export type CondominiumStats = {
  units: number;
  occupiedUnits: number;
  residents: number;
  vehicles: number;
  openIncidents: number;
  pendingCharges: number;
  pendingReservations: number;
};

export class CondominiumService extends BaseCrudService<
  Condominium,
  CreateCondominiumDTO,
  UpdateCondominiumDTO
> {
  constructor(
    repository: CondominiumRepository = condominiumRepository,
    private readonly tenants: TenantRepository = tenantRepository,
  ) {
    super(repository, { resource: 'condominium', label: 'Condominio' });
  }

  protected override async beforeCreate(
    ctx: RequestContext,
    dto: CreateCondominiumDTO,
  ): Promise<DeepPartial<Condominium>> {
    await this.assertPlanLimit(ctx);
    await this.assertDocumentAvailable(ctx, dto.document ?? null);
    return dto as DeepPartial<Condominium>;
  }

  protected override async beforeUpdate(
    ctx: RequestContext,
    current: Condominium,
    dto: UpdateCondominiumDTO,
  ): Promise<DeepPartial<Condominium>> {
    if (dto.document && dto.document !== current.document) {
      await this.assertDocumentAvailable(ctx, dto.document, current.id);
    }
    return dto as DeepPartial<Condominium>;
  }

  protected override async beforeRemove(ctx: RequestContext, entity: Condominium): Promise<void> {
    const units = await this.countRelated('units', ctx.scope.tenantId, entity.id);
    if (units > 0) {
      throw new BusinessRuleError(
        'Condominio possui unidades cadastradas. Remova ou transfira as unidades antes de excluir.',
      );
    }
  }

  /** Consolidado usado nos cards do dashboard e na tela do condominio. */
  async stats(ctx: RequestContext, condominiumId: string): Promise<CondominiumStats> {
    const condominium = await this.findById(ctx, condominiumId);
    const tenantId = ctx.scope.tenantId;

    const [units, occupiedUnits, residents, vehicles, openIncidents, pendingCharges, pendingReservations] =
      await Promise.all([
        this.countRelated('units', tenantId, condominium.id),
        this.countRelated('units', tenantId, condominium.id, "status = 'OCCUPIED'"),
        this.countRelated('residents', tenantId, condominium.id, "status = 'ACTIVE'"),
        this.countRelated('vehicles', tenantId, condominium.id),
        this.countRelated('incidents', tenantId, condominium.id, "status IN ('OPEN','IN_ANALYSIS','IN_PROGRESS')"),
        this.countRelated('charges', tenantId, condominium.id, "status IN ('PENDING','OVERDUE','PARTIAL')"),
        this.countRelated('reservations', tenantId, condominium.id, "status = 'PENDING'"),
      ]);

    return {
      units,
      occupiedUnits,
      residents,
      vehicles,
      openIncidents,
      pendingCharges,
      pendingReservations,
    };
  }

  private async countRelated(
    table: string,
    tenantId: string,
    condominiumId: string,
    extraCondition?: string,
  ): Promise<number> {
    const qb = AppDataSource.createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from(table, 'related')
      .where('related.tenant_id = :tenantId', { tenantId })
      .andWhere('related.condominium_id = :condominiumId', { condominiumId })
      .andWhere('related.deleted_at IS NULL');

    // `extraCondition` e sempre uma constante interna, nunca entrada do usuario.
    if (extraCondition) qb.andWhere(extraCondition);

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async assertPlanLimit(ctx: RequestContext): Promise<void> {
    if (ctx.scope.superAdmin) return;

    const tenant = await this.tenants.findById(ctx.scope.tenantId);
    if (!tenant) return;

    const current = await this.tenants.countCondominiums(ctx.scope.tenantId);
    if (current >= tenant.maxCondominiums) {
      throw new BusinessRuleError(
        `O plano ${tenant.plan} permite ate ${tenant.maxCondominiums} condominio(s). Faca upgrade para cadastrar mais.`,
      );
    }
  }

  private async assertDocumentAvailable(
    ctx: RequestContext,
    document: string | null,
    exceptId?: string,
  ): Promise<void> {
    if (!document) return;

    const qb = this.repository
      .query(ctx.scope, true)
      .andWhere('condominium.document = :document', { document });
    if (exceptId) qb.andWhere('condominium.id != :exceptId', { exceptId });

    if (await qb.getExists()) {
      throw new ConflictError('Ja existe um condominio cadastrado com este CNPJ.');
    }
  }
}

export const condominiumService = new CondominiumService();
