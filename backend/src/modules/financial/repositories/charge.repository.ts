import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Charge } from '../entities/charge.entity';

export type ChargeTotals = {
  billed: number;
  received: number;
  open: number;
  overdue: number;
  overdueCount: number;
  pendingCount: number;
};

export class ChargeRepository extends BaseRepository<Charge> {
  constructor() {
    super(Charge, {
      alias: 'charge',
      searchableFields: ['description', 'barcode'],
      filterableFields: [
        'condominiumId',
        'unitId',
        'residentId',
        'categoryId',
        'status',
        'referenceMonth',
      ],
      relations: ['unit'],
      defaultSort: { field: 'dueDate', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async existsForUnitAndMonth(
    scope: TenantScope,
    unitId: string,
    referenceMonth: string,
    categoryId: string | null,
  ): Promise<boolean> {
    const qb = this.query(scope)
      .andWhere('charge.unitId = :unitId', { unitId })
      .andWhere('charge.referenceMonth = :referenceMonth', { referenceMonth })
      .andWhere('charge.status != :canceled', { canceled: 'CANCELED' });

    if (categoryId) qb.andWhere('charge.categoryId = :categoryId', { categoryId });
    else qb.andWhere('charge.categoryId IS NULL');

    return qb.getExists();
  }

  /** Marca como vencidas as cobrancas cujo vencimento passou (job diario). */
  async markOverdue(tenantId: string, reference: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Charge)
      .set({ status: 'OVERDUE' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('due_date < :reference', { reference })
      .andWhere("status IN ('PENDING','PARTIAL')")
      .andWhere('deleted_at IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  async totals(scope: TenantScope, condominiumId: string, referenceMonth?: string): Promise<ChargeTotals> {
    const base = () => {
      const qb = this.query(scope).andWhere('charge.condominiumId = :condominiumId', {
        condominiumId,
      });
      if (referenceMonth) {
        qb.andWhere('charge.referenceMonth = :referenceMonth', { referenceMonth });
      }
      return qb.andWhere('charge.status != :canceled', { canceled: 'CANCELED' });
    };

    const billedRow = await base()
      .select('SUM(charge.amount + charge.interest + charge.penalty - charge.discount)', 'total')
      .getRawOne<{ total: string | null }>();

    const receivedRow = await base()
      .select('SUM(charge.paidAmount)', 'total')
      .getRawOne<{ total: string | null }>();

    const overdueRow = await base()
      .andWhere('charge.status = :overdue', { overdue: 'OVERDUE' })
      .select('SUM(charge.amount + charge.interest + charge.penalty - charge.discount - charge.paidAmount)', 'total')
      .addSelect('COUNT(1)', 'count')
      .getRawOne<{ total: string | null; count: string }>();

    const pendingCount = await base()
      .andWhere('charge.status IN (:...statuses)', { statuses: ['PENDING', 'PARTIAL'] })
      .getCount();

    const billed = Number(billedRow?.total ?? 0);
    const received = Number(receivedRow?.total ?? 0);

    return {
      billed,
      received,
      open: Math.max(0, billed - received),
      overdue: Number(overdueRow?.total ?? 0),
      overdueCount: Number(overdueRow?.count ?? 0),
      pendingCount,
    };
  }

  /** Inadimplencia por unidade, ordenada pelo maior saldo em aberto. */
  async delinquencyByUnit(scope: TenantScope, condominiumId: string, limit = 10) {
    return this.query(scope)
      .andWhere('charge.condominiumId = :condominiumId', { condominiumId })
      .andWhere('charge.status = :overdue', { overdue: 'OVERDUE' })
      .select('charge.unitId', 'unitId')
      .addSelect('COUNT(1)', 'charges')
      .addSelect('SUM(charge.amount - charge.paidAmount)', 'total')
      .groupBy('charge.unitId')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany<{ unitId: string; charges: string; total: string }>();
  }

  /** Serie mensal (faturado x recebido) para os graficos do dashboard. */
  async monthlySeries(scope: TenantScope, condominiumId: string, months: string[]) {
    if (!months.length) return [];
    return this.query(scope)
      .andWhere('charge.condominiumId = :condominiumId', { condominiumId })
      .andWhere('charge.referenceMonth IN (:...months)', { months })
      .andWhere('charge.status != :canceled', { canceled: 'CANCELED' })
      .select('charge.referenceMonth', 'referenceMonth')
      .addSelect('SUM(charge.amount)', 'billed')
      .addSelect('SUM(charge.paidAmount)', 'received')
      .groupBy('charge.referenceMonth')
      .orderBy('charge.referenceMonth', 'ASC')
      .getRawMany<{ referenceMonth: string; billed: string; received: string }>();
  }
}

export const chargeRepository = new ChargeRepository();
