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

  /**
   * Despesa do balancete de caixa: o que foi **pago** entre `from` (inclusive) e
   * `toExclusive`, agrupado por categoria. Competencia nao entra: uma conta de
   * julho paga em agosto sai no caixa de agosto (ADR-001).
   */
  async paidByCategory(
    scope: TenantScope,
    condominiumId: string,
    from: Date,
    toExclusive: Date,
  ): Promise<{ categoryId: string | null; total: string | null }[]> {
    return this.query(scope)
      .andWhere('expense.condominiumId = :condominiumId', { condominiumId })
      .andWhere('expense.status = :paid', { paid: 'PAID' })
      .andWhere('expense.paidAt >= :from', { from })
      .andWhere('expense.paidAt < :toExclusive', { toExclusive })
      .select('expense.categoryId', 'categoryId')
      .addSelect('SUM(expense.amount)', 'total')
      .groupBy('expense.categoryId')
      .getRawMany<{ categoryId: string | null; total: string | null }>();
  }

  /** Soma das despesas pagas numa janela semiaberta; `from` nulo nao limita por baixo. */
  async sumPaidInWindow(
    scope: TenantScope,
    condominiumId: string,
    from: Date | null,
    toExclusive: Date,
  ): Promise<number> {
    const qb = this.query(scope)
      .andWhere('expense.condominiumId = :condominiumId', { condominiumId })
      .andWhere('expense.status = :paid', { paid: 'PAID' })
      .andWhere('expense.paidAt < :toExclusive', { toExclusive });

    if (from) qb.andWhere('expense.paidAt >= :from', { from });

    const row = await qb.select('SUM(expense.amount)', 'total').getRawOne<{ total: string | null }>();
    return Number(row?.total ?? 0);
  }

  /**
   * Despesas marcadas como pagas **sem data de pagamento**, na competencia.
   *
   * Nao pertencem a mes de caixa nenhum: o dinheiro saiu e nao ha quando. Sao
   * atribuidas a competencia porque e o unico mes que a linha reivindica, e
   * ficam fora de todo total — visiveis para serem resolvidas, nunca somadas
   * (ADR-004). O servico passou a recusar esse estado; o que existe aqui e
   * anterior a ele, ou entrou por escrita direta no banco.
   */
  async unresolvedPaid(
    scope: TenantScope,
    condominiumId: string,
    competence: string,
  ): Promise<{ count: number; total: number }> {
    const row = await this.query(scope)
      .andWhere('expense.condominiumId = :condominiumId', { condominiumId })
      .andWhere('expense.status = :paid', { paid: 'PAID' })
      .andWhere('expense.paidAt IS NULL')
      .andWhere('expense.competence = :competence', { competence })
      .select('COUNT(1)', 'count')
      .addSelect('SUM(expense.amount)', 'total')
      .getRawOne<{ count: string | null; total: string | null }>();

    return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
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
