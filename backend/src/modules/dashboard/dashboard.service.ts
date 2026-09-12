import { AppDataSource } from '@/config/data-source';
import { auditService, type AuditService } from '@/modules/audit/audit.service';
import { assemblyRepository, type AssemblyRepository } from '@/modules/assemblies/repositories/assembly.repository';
import {
  correspondenceRepository,
  type CorrespondenceRepository,
} from '@/modules/correspondences/correspondence.repository';
import { chargeRepository, type ChargeRepository } from '@/modules/financial/repositories/charge.repository';
import { expenseRepository, type ExpenseRepository } from '@/modules/financial/repositories/expense.repository';
import { incidentRepository, type IncidentRepository } from '@/modules/incidents/incident.repository';
import {
  maintenanceRepository,
  type MaintenanceRepository,
} from '@/modules/maintenances/maintenance.repository';
import { visitorRepository, type VisitorRepository } from '@/modules/visitors/visitor.repository';
import { cacheService, type CacheService } from '@/shared/services/cache.service';
import { assertCondominiumAccess } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { currentReferenceMonth, dayjs } from '@/shared/utils/date.util';

const DASHBOARD_TTL_SECONDS = 60;

export type DashboardOverview = {
  condominium: { id: string; name: string } | null;
  referenceMonth: string;
  units: { total: number; occupied: number; vacant: number; occupancyRate: number };
  people: { residents: number; employees: number; visitorsInside: number };
  finance: {
    billed: number;
    received: number;
    open: number;
    overdue: number;
    delinquencyRate: number;
    expenses: number;
    expensesPaid: number;
    balance: number;
  };
  operations: {
    openIncidents: number;
    pendingReservations: number;
    pendingCorrespondences: number;
    upcomingMaintenances: number;
    upcomingAssemblies: number;
  };
};

/**
 * Agregacoes de leitura para o painel executivo.
 *
 * Todas as consultas passam pelos repositorios tenant-aware e o resultado e
 * cacheado por 60s — o dashboard e a tela mais acessada e a que mais geraria
 * carga repetida no banco.
 */
export class DashboardService {
  constructor(
    private readonly charges: ChargeRepository = chargeRepository,
    private readonly expenses: ExpenseRepository = expenseRepository,
    private readonly incidents: IncidentRepository = incidentRepository,
    private readonly correspondences: CorrespondenceRepository = correspondenceRepository,
    private readonly visitors: VisitorRepository = visitorRepository,
    private readonly maintenances: MaintenanceRepository = maintenanceRepository,
    private readonly assemblies: AssemblyRepository = assemblyRepository,
    private readonly audit: AuditService = auditService,
    private readonly cache: CacheService = cacheService,
  ) {}

  async overview(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth = currentReferenceMonth(),
  ): Promise<DashboardOverview> {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    const cacheKey = `tenant:${ctx.scope.tenantId}:dashboard:overview:${condominiumId}:${referenceMonth}`;

    return this.cache.remember(cacheKey, DASHBOARD_TTL_SECONDS, async () => {
      const [
        condominium,
        unitTotals,
        residents,
        employees,
        visitorsInside,
        chargeTotals,
        expenseTotals,
        openIncidents,
        pendingReservations,
        pendingCorrespondences,
        upcomingMaintenances,
        upcomingAssemblies,
      ] = await Promise.all([
        this.loadCondominium(ctx, condominiumId),
        this.unitTotals(ctx, condominiumId),
        this.countTable('residents', ctx, condominiumId, "status = 'ACTIVE'"),
        this.countTable('employees', ctx, condominiumId, "status = 'ACTIVE'"),
        this.visitors.countInside(ctx.scope, condominiumId),
        this.charges.totals(ctx.scope, condominiumId, referenceMonth),
        this.expenses.totals(ctx.scope, condominiumId, referenceMonth),
        this.incidents.countOpen(ctx.scope, condominiumId),
        this.countTable('reservations', ctx, condominiumId, "status = 'PENDING'"),
        this.correspondences.countPending(ctx.scope, condominiumId),
        this.maintenances.listUpcoming(ctx.scope, condominiumId, 50),
        this.assemblies.listUpcoming(ctx.scope, condominiumId, 50),
      ]);

      const occupancyRate =
        unitTotals.total > 0 ? (unitTotals.occupied / unitTotals.total) * 100 : 0;
      const delinquencyRate =
        chargeTotals.billed > 0 ? (chargeTotals.overdue / chargeTotals.billed) * 100 : 0;

      return {
        condominium,
        referenceMonth,
        units: {
          total: unitTotals.total,
          occupied: unitTotals.occupied,
          vacant: unitTotals.total - unitTotals.occupied,
          occupancyRate: this.round(occupancyRate),
        },
        people: { residents, employees, visitorsInside },
        finance: {
          billed: this.round(chargeTotals.billed),
          received: this.round(chargeTotals.received),
          open: this.round(chargeTotals.open),
          overdue: this.round(chargeTotals.overdue),
          delinquencyRate: this.round(delinquencyRate),
          expenses: this.round(expenseTotals.total),
          expensesPaid: this.round(expenseTotals.paid),
          balance: this.round(chargeTotals.received - expenseTotals.paid),
        },
        operations: {
          openIncidents,
          pendingReservations,
          pendingCorrespondences,
          upcomingMaintenances: upcomingMaintenances.length,
          upcomingAssemblies: upcomingAssemblies.length,
        },
      };
    });
  }

  /** Serie historica faturado x recebido para o grafico principal. */
  async financialSeries(ctx: RequestContext, condominiumId: string, months = 6) {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    const references = Array.from({ length: months }, (_, index) =>
      dayjs()
        .subtract(months - 1 - index, 'month')
        .format('YYYY-MM'),
    );

    const cacheKey = `tenant:${ctx.scope.tenantId}:dashboard:series:${condominiumId}:${months}`;

    return this.cache.remember(cacheKey, DASHBOARD_TTL_SECONDS, async () => {
      const rows = await this.charges.monthlySeries(ctx.scope, condominiumId, references);
      const byMonth = new Map(rows.map((row) => [row.referenceMonth, row]));

      return references.map((referenceMonth) => ({
        referenceMonth,
        label: dayjs(`${referenceMonth}-01`).format('MMM/YY'),
        billed: this.round(Number(byMonth.get(referenceMonth)?.billed ?? 0)),
        received: this.round(Number(byMonth.get(referenceMonth)?.received ?? 0)),
      }));
    });
  }

  async incidentsByCategory(ctx: RequestContext, condominiumId: string) {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    const rows = await this.incidents
      .query(ctx.scope)
      .andWhere('incident.condominiumId = :condominiumId', { condominiumId })
      .select('incident.category', 'category')
      .addSelect('COUNT(1)', 'total')
      .groupBy('incident.category')
      .orderBy('total', 'DESC')
      .getRawMany<{ category: string; total: string }>();

    return rows.map((row) => ({ category: row.category, total: Number(row.total) }));
  }

  async expensesByCategory(ctx: RequestContext, condominiumId: string, competence?: string) {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    const rows = await this.expenses.byCategory(ctx.scope, condominiumId, competence);
    const categories = await AppDataSource.createQueryBuilder()
      .select(['c.id AS id', 'c.name AS name', 'c.color AS color'])
      .from('financial_categories', 'c')
      .where('c.tenant_id = :tenantId', { tenantId: ctx.scope.tenantId })
      .getRawMany<{ id: string; name: string; color: string | null }>();

    const byId = new Map(categories.map((category) => [category.id, category]));

    return rows.map((row) => ({
      categoryId: row.categoryId,
      name: row.categoryId ? (byId.get(row.categoryId)?.name ?? 'Sem categoria') : 'Sem categoria',
      color: row.categoryId ? (byId.get(row.categoryId)?.color ?? null) : null,
      total: this.round(Number(row.total)),
    }));
  }

  /** Ultimos eventos relevantes do condominio, para o feed do painel. */
  async recentActivity(ctx: RequestContext, limit = 10) {
    const result = await this.audit.list(ctx.scope, {
      page: 1,
      perPage: Math.min(limit, 50),
      sortOrder: 'DESC',
      sortBy: 'createdAt',
      filters: {},
    });

    return result.data.map((entry) => ({
      id: entry.id,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      description: entry.description,
      userName: entry.userName,
      createdAt: entry.createdAt,
    }));
  }

  private async loadCondominium(ctx: RequestContext, condominiumId: string) {
    const row = await AppDataSource.createQueryBuilder()
      .select(['c.id AS id', 'c.name AS name'])
      .from('condominiums', 'c')
      .where('c.id = :condominiumId', { condominiumId })
      .andWhere('c.tenant_id = :tenantId', { tenantId: ctx.scope.tenantId })
      .getRawOne<{ id: string; name: string }>();

    return row ?? null;
  }

  private async unitTotals(ctx: RequestContext, condominiumId: string) {
    const [total, occupied] = await Promise.all([
      this.countTable('units', ctx, condominiumId),
      this.countTable('units', ctx, condominiumId, "status = 'OCCUPIED'"),
    ]);
    return { total, occupied };
  }

  private async countTable(
    table: string,
    ctx: RequestContext,
    condominiumId: string,
    extraCondition?: string,
  ): Promise<number> {
    const qb = AppDataSource.createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from(table, 'row')
      .where('row.tenant_id = :tenantId', { tenantId: ctx.scope.tenantId })
      .andWhere('row.condominium_id = :condominiumId', { condominiumId })
      .andWhere('row.deleted_at IS NULL');

    // Condicao interna e constante; nunca recebe entrada do usuario.
    if (extraCondition) qb.andWhere(extraCondition);

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

export const dashboardService = new DashboardService();
