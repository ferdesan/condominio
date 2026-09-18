import { condominiumRepository, type CondominiumRepository } from '@/modules/condominiums/condominium.repository';
import { auditService, type AuditService } from '@/modules/audit/audit.service';
import { BusinessRuleError, NotFoundError } from '@/shared/errors';
import type { Paginated, QueryOptions } from '@/shared/types/pagination';
import { assertCondominiumAccess } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import {
  currentReferenceMonth,
  dayjs,
  monthRange,
  REFERENCE_MONTH,
} from '@/shared/utils/date.util';
import {
  openingBalanceWindow,
  readBreakdown,
  resolveOpeningBalance,
  round2,
  toStatementLines,
  type ResolvedOpeningBalance,
} from '../closing-math';
import type { ClosingStatus, StatementLine } from '../entities/financial-closing.entity';
import { FinancialClosing } from '../entities/financial-closing.entity';
import { chargeRepository, type ChargeRepository } from '../repositories/charge.repository';
import {
  expenseRepository,
  type ExpenseRepository,
} from '../repositories/expense.repository';
import {
  financialCategoryRepository,
  type FinancialCategoryRepository,
} from '../repositories/financial-category.repository';
import {
  financialClosingRepository,
  type FinancialClosingRepository,
} from '../repositories/financial-closing.repository';
import { paymentRepository, type PaymentRepository } from '../repositories/payment.repository';

/**
 * O balancete de um mes, servido pela mesma forma esteja o mes aberto ou
 * fechado. Quem le descobre em qual dos dois estados esta por `status` e
 * `closedAt`, e nao por um payload diferente — uma tela que precisasse tratar
 * duas formas acabaria com dois caminhos que divergem.
 */
export type MonthlyStatement = {
  condominiumId: string;
  referenceMonth: string;
  status: ClosingStatus;
  openingBalance: ResolvedOpeningBalance;
  income: StatementLine[];
  expense: StatementLine[];
  totalIncome: number;
  totalExpense: number;
  result: number;
  closingBalance: number;
  /** Fora de todo total, de proposito (ADR-004). */
  unresolvedPaidExpenses: { count: number; total: number };
  /** Quadro auxiliar: inadimplencia da competencia, fora do resultado (ADR-001). */
  delinquency: { amount: number; count: number };
  closedAt: Date | null;
  closedBy: { id: string; name: string | null } | null;
  reopenedAt: Date | null;
  reopenCount: number;
};

/**
 * Nao estende `CondominiumScopedService`: nao ha create/update/delete a herdar.
 * Montar a fabrica exporia seis operacoes sobre um recurso que tem tres, e a
 * regra ja esta escrita no lado do cliente, em `features/tenant/tenant-hooks.ts`
 * e `audit-hooks.ts`.
 */
export class ClosingService {
  constructor(
    private readonly closings: FinancialClosingRepository = financialClosingRepository,
    private readonly payments: PaymentRepository = paymentRepository,
    private readonly expenses: ExpenseRepository = expenseRepository,
    private readonly charges: ChargeRepository = chargeRepository,
    private readonly categories: FinancialCategoryRepository = financialCategoryRepository,
    private readonly condominiums: CondominiumRepository = condominiumRepository,
    private readonly audit: AuditService = auditService,
  ) {}

  /**
   * Recalcula enquanto o mes esta aberto; serve o gravado depois de fechado
   * (ADR-005). Ausencia de linha e `status = 'OPEN'` sao o mesmo estado para
   * esta leitura: mes aberto.
   */
  async statement(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth: string,
  ): Promise<MonthlyStatement> {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    const existing = await this.closings.findByMonth(ctx.scope, condominiumId, referenceMonth);
    if (existing && existing.status === 'CLOSED') return this.fromSnapshot(existing);

    return this.compute(ctx, condominiumId, referenceMonth, existing);
  }

  async list(ctx: RequestContext, options: QueryOptions): Promise<Paginated<FinancialClosing>> {
    const condominiumId = options.filters?.condominiumId;
    if (typeof condominiumId === 'string') {
      await assertCondominiumAccess(ctx.scope, condominiumId);
    }
    return this.closings.findMany(ctx.scope, options);
  }

  /**
   * Congela o mes: recalcula uma ultima vez, grava o documento inteiro e passa a
   * servi-lo dali em diante (ADR-005).
   */
  async close(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth: string,
  ): Promise<MonthlyStatement> {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    // Congelar um mes que ainda recebe dinheiro transforma a guarda numa
    // armadilha sobre a escrita mais usada do modulo: dali ate o fim do mes,
    // toda baixa seria recusada.
    if (referenceMonth >= currentReferenceMonth()) {
      throw new BusinessRuleError(
        `A competencia ${referenceMonth} ainda nao terminou e por isso nao pode ser fechada.`,
      );
    }

    const existing = await this.closings.findByMonth(ctx.scope, condominiumId, referenceMonth);
    if (existing?.status === 'CLOSED') {
      throw new BusinessRuleError(`A competencia ${referenceMonth} ja esta fechada.`);
    }

    const statement = await this.compute(ctx, condominiumId, referenceMonth, existing);

    const document = {
      condominiumId,
      referenceMonth,
      status: 'CLOSED' as const,
      openingBalance: statement.openingBalance.amount,
      openingBalanceSource: statement.openingBalance.source,
      openingBalanceFrom: statement.openingBalance.from,
      totalIncome: statement.totalIncome,
      totalExpense: statement.totalExpense,
      closingBalance: statement.closingBalance,
      overdueAmount: statement.delinquency.amount,
      overdueCount: statement.delinquency.count,
      breakdown: {
        income: statement.income,
        expense: statement.expense,
        unresolvedPaidExpenses: statement.unresolvedPaidExpenses,
      },
      closedAt: new Date(),
      closedById: ctx.actor.userId,
      closedByName: ctx.actor.name ?? null,
    };

    // O indice unico por competencia torna o refechamento uma atualizacao da
    // mesma linha, e nao uma segunda linha — estrutural, e nao convencao.
    const saved = existing
      ? await this.closings.update(ctx.scope, existing.id, document)
      : await this.closings.create(ctx.scope, document);

    if (!saved) throw new NotFoundError('Balancete');

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'UPDATE',
      resource: 'financial-closing',
      resourceId: saved.id,
      description: `Balancete de ${referenceMonth} fechado.`,
      before: existing ? { status: existing.status, closingBalance: existing.closingBalance } : null,
      after: { status: 'CLOSED', closingBalance: saved.closingBalance },
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return this.fromSnapshot(saved);
  }

  /**
   * Devolve o mes ao estado vivo, deixando registro de quem e quando. Exige
   * permissao estritamente mais forte do que fechar: fechar e rotina, desfazer
   * uma prestacao de contas nao e (ADR-003).
   */
  async reopen(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth: string,
  ): Promise<MonthlyStatement> {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    const existing = await this.closings.findByMonth(ctx.scope, condominiumId, referenceMonth);
    if (!existing || existing.status !== 'CLOSED') {
      throw new BusinessRuleError(`A competencia ${referenceMonth} nao esta fechada.`);
    }

    const reopened = await this.closings.update(ctx.scope, existing.id, {
      status: 'OPEN',
      reopenedAt: new Date(),
      reopenedById: ctx.actor.userId,
      reopenedByName: ctx.actor.name ?? null,
      reopenCount: existing.reopenCount + 1,
    });

    if (!reopened) throw new NotFoundError('Balancete');

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'UPDATE',
      resource: 'financial-closing',
      resourceId: existing.id,
      description: `Balancete de ${referenceMonth} reaberto.`,
      before: { status: 'CLOSED', reopenCount: existing.reopenCount },
      after: { status: 'OPEN', reopenCount: reopened.reopenCount },
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    // Reaberto volta a ser calculado: os totais gravados descrevem um mes que
    // voltou a receber lancamento.
    return this.statement(ctx, condominiumId, referenceMonth);
  }

  /** O documento gravado, devolvido como foi gravado. Nenhuma agregacao roda aqui. */
  private fromSnapshot(row: FinancialClosing): MonthlyStatement {
    const breakdown = readBreakdown(row.breakdown);

    return {
      condominiumId: row.condominiumId,
      referenceMonth: row.referenceMonth,
      status: row.status,
      openingBalance: {
        amount: row.openingBalance,
        source: row.openingBalanceSource,
        from: row.openingBalanceFrom ?? null,
      },
      income: breakdown.income,
      expense: breakdown.expense,
      totalIncome: row.totalIncome,
      totalExpense: row.totalExpense,
      result: round2(row.totalIncome - row.totalExpense),
      closingBalance: row.closingBalance,
      unresolvedPaidExpenses: breakdown.unresolvedPaidExpenses,
      delinquency: { amount: row.overdueAmount, count: row.overdueCount },
      closedAt: row.closedAt ?? null,
      closedBy: row.closedById ? { id: row.closedById, name: row.closedByName ?? null } : null,
      reopenedAt: row.reopenedAt ?? null,
      reopenCount: row.reopenCount,
    };
  }

  private async compute(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth: string,
    existing: FinancialClosing | null,
  ): Promise<MonthlyStatement> {
    const { scope } = ctx;
    const { start, endExclusive } = monthRange(referenceMonth);

    const condominium = await this.condominiums.findById(scope, condominiumId);
    if (!condominium) throw new NotFoundError('Condominio');

    const openingBalance = await this.resolveOpening(scope, condominium, start);

    const [incomeRows, expenseRows] = await Promise.all([
      this.payments.incomeByCategory(scope, condominiumId, start, endExclusive),
      this.expenses.paidByCategory(scope, condominiumId, start, endExclusive),
    ]);

    const categoryIds = [...incomeRows, ...expenseRows]
      .map((row) => row.categoryId)
      .filter((id): id is string => Boolean(id));
    const names = await this.categories.namesByIds(scope, [...new Set(categoryIds)]);

    const income = toStatementLines(incomeRows, names);
    const expense = toStatementLines(expenseRows, names);

    const [unresolvedPaidExpenses, chargeTotals] = await Promise.all([
      this.expenses.unresolvedPaid(scope, condominiumId, referenceMonth),
      this.charges.totals(scope, condominiumId, referenceMonth),
    ]);

    const result = round2(income.total - expense.total);

    return {
      condominiumId,
      referenceMonth,
      status: existing?.status ?? 'OPEN',
      openingBalance,
      income: income.lines,
      expense: expense.lines,
      totalIncome: income.total,
      totalExpense: expense.total,
      result,
      closingBalance: round2(openingBalance.amount + result),
      unresolvedPaidExpenses,
      // A mesma definicao de "o que se deve" que `charges/summary` ja usa. Uma
      // quarta definicao de valor de cobranca neste modulo seria uma a mais.
      delinquency: { amount: chargeTotals.overdue, count: chargeTotals.overdueCount },
      closedAt: null,
      closedBy: null,
      reopenedAt: existing?.reopenedAt ?? null,
      reopenCount: existing?.reopenCount ?? 0,
    };
  }

  private async resolveOpening(
    scope: RequestContext['scope'],
    condominium: { id: string; openingBalance: number; openingBalanceDate?: string | null },
    monthStart: Date,
  ): Promise<ResolvedOpeningBalance> {
    const previousMonth = dayjs(monthStart).subtract(1, 'month').format(REFERENCE_MONTH);
    const previous = await this.closings.findByMonth(scope, condominium.id, previousMonth);

    if (previous && previous.status === 'CLOSED') {
      return resolveOpeningBalance({
        previous,
        condominium,
        movements: { income: 0, expense: 0 },
      });
    }

    const window = openingBalanceWindow(condominium.openingBalanceDate, monthStart);
    const [income, expense] = await Promise.all([
      this.payments.sumInWindow(scope, condominium.id, window.from, window.toExclusive),
      this.expenses.sumPaidInWindow(scope, condominium.id, window.from, window.toExclusive),
    ]);

    return resolveOpeningBalance({ previous, condominium, movements: { income, expense } });
  }
}

export const closingService = new ClosingService();
