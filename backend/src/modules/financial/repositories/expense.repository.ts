import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Expense } from '../entities/expense.entity';

export class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super(Expense, {
      alias: 'expense',
      searchableFields: ['description', 'documentNumber'],
      filterableFields: ['condominiumId', 'categoryId', 'serviceProviderId', 'status', 'competence'],
      defaultSort: { field: 'dueDate', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async totals(scope: TenantScope, condominiumId: string, competence?: string) {
    const base = () => {
      const qb = this.query(scope)
        .andWhere('expense.condominiumId = :condominiumId', { condominiumId })
        .andWhere('expense.status != :canceled', { canceled: 'CANCELED' });
      if (competence) qb.andWhere('expense.competence = :competence', { competence });
      return qb;
    };

    const totalRow = await base().select('SUM(expense.amount)', 'total').getRawOne<{ total: string | null }>();
    const paidRow = await base()
      .andWhere('expense.status = :paid', { paid: 'PAID' })
      .select('SUM(expense.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    const total = Number(totalRow?.total ?? 0);
    const paid = Number(paidRow?.total ?? 0);
    return { total, paid, open: Math.max(0, total - paid) };
  }

  /** Distribuicao por categoria, usada no grafico de despesas do dashboard. */
  async byCategory(scope: TenantScope, condominiumId: string, competence?: string) {
    const qb = this.query(scope)
      .andWhere('expense.condominiumId = :condominiumId', { condominiumId })
      .andWhere('expense.status != :canceled', { canceled: 'CANCELED' })
      .select('expense.categoryId', 'categoryId')
      .addSelect('SUM(expense.amount)', 'total')
      .groupBy('expense.categoryId')
      .orderBy('total', 'DESC');

    if (competence) qb.andWhere('expense.competence = :competence', { competence });
    return qb.getRawMany<{ categoryId: string | null; total: string }>();
  }

  async markOverdue(tenantId: string, reference: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Expense)
      .set({ status: 'OVERDUE' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('due_date < :reference', { reference })
      .andWhere("status = 'PENDING'")
      .andWhere('deleted_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }
}

export const expenseRepository = new ExpenseRepository();
