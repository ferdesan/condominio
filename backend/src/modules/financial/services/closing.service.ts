import { AppDataSource } from '@/config/data-source';
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
  sortStatementEntries,
  toStatementEntry,
  toStatementLines,
  type ResolvedOpeningBalance,
  type StatementEntry,
} from '../closing-math';
import { FinancialClosingEntry } from '../entities/financial-closing-entry.entity';
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
  financialClosingEntryRepository,
  type FinancialClosingEntryRepository,
} from '../repositories/financial-closing-entry.repository';
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
 * Os lancamentos de uma competencia, e de onde eles vieram.
 *
 * `frozen` nao e redundante com `status`: ele diz se **estas linhas** sairam do
 * armazenamento ou foram calculadas agora. E o que distingue um documento
 * fechado antes desta esteira — `frozen: true`, lista vazia e totais acima de
 * zero — de um mes que simplesmente nao teve movimento. Renderizar o primeiro
 * como o segundo seria uma afirmacao falsa dentro de uma prestacao de contas.
 */
export type ClosingEntries = {
  entries: StatementEntry[];
  frozen: boolean;
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
    private readonly closingEntries: FinancialClosingEntryRepository = financialClosingEntryRepository,
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

  /**
   * Os lancamentos do mes, pela mesma regra de dois modos que `statement` segue:
   * serve o gravado quando a competencia esta `CLOSED`, calcula quando esta
   * aberta. Ausencia de linha e `status = 'OPEN'` sao o mesmo estado aqui
   * tambem — o segundo apenas ja foi fechado alguma vez.
   *
   * A regra nao e simetria por gosto: o mes fechado tem totais congelados, e
   * `balancete-mensal` IT-276 prova que uma escrita direta no banco depois do
   * fechamento nao os move. Uma lista recalculada mostraria uma linha que o
   * total acima dela exclui, e o documento se contradiria na propria tela.
   */
  async entries(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth: string,
  ): Promise<ClosingEntries> {
    await assertCondominiumAccess(ctx.scope, condominiumId);

    const existing = await this.closings.findByMonth(ctx.scope, condominiumId, referenceMonth);

    if (existing && existing.status === 'CLOSED') {
      const stored = await this.closingEntries.findByClosing(ctx.scope, existing.id);
      return { entries: sortStatementEntries(stored.map(fromStoredEntry)), frozen: true };
    }

    return {
      entries: await this.computeEntries(ctx.scope, condominiumId, referenceMonth),
      frozen: false,
    };
  }

  async list(ctx: RequestContext, options: QueryOptions): Promise<Paginated<FinancialClosing>> {
    const condominiumId = options.filters?.condominiumId;
    if (typeof condominiumId === 'string') {
      await assertCondominiumAccess(ctx.scope, condominiumId);
    }
    return this.closings.findMany(ctx.scope, options);
  }

  /**
   * Congela o mes: recalcula uma ultima vez, grava o documento inteiro — resumo
   * e lancamentos — e passa a servi-lo dali em diante (ADR-005).
   *
   * **A escrita inteira cabe numa transacao so** (ADR-003). Um fechamento cujos
   * totais foram gravados e cujos lancamentos nao e um documento que afirma um
   * numero que nao consegue mostrar; e como sao duas tabelas, so a transacao
   * impede o meio-termo. E a unica escrita do modulo financeiro que contorna o
   * `BaseRepository` de proposito: o getter dele resolve o repositorio global do
   * DataSource (`base.repository.ts:37-40`), de modo que uma chamada por ali nao
   * participaria do bloco e quebraria a atomicidade em silencio.
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
    // Mesma janela e mesmo regime de caixa do resumo acima: e o que faz a soma
    // dos lancamentos fechar com os totais gravados ao lado deles.
    const entries = await this.computeEntries(ctx.scope, condominiumId, referenceMonth);

    // Lido antes da transacao porque a gravacao mescla o documento novo sobre
    // `existing`: consultado depois, o estado de chegada apareceria na
    // auditoria como se fosse o de partida.
    const before = existing
      ? { status: existing.status, closingBalance: existing.closingBalance }
      : null;

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

    const closingId = await AppDataSource.transaction(async (manager) => {
      // O documento vem primeiro, e nao na ordem em que a ADR-003 o lista, por
      // uma razao que a propria ADR-003 cria: o lancamento e filho do
      // fechamento, e numa competencia fechada pela primeira vez nao existe
      // `closing_id` nem para apagar por ele nem para apontar para ele. Inverter
      // isso exigiria limpar so "quando ja havia fechamento" — exatamente a
      // guarda condicional que a decisao proibe. O indice unico por competencia
      // torna o refechamento uma atualizacao da mesma linha, e nao uma segunda.
      const row = existing
        ? manager.merge(FinancialClosing, existing, document)
        : manager.create(FinancialClosing, { ...document, tenantId: ctx.scope.tenantId });
      const closing = await manager.save(row);

      // Incondicional, sem perguntar se havia fechamento anterior. Uma guarda
      // que so limpa "quando devia haver" confia na propria contabilidade;
      // apagar o que nao deveria estar la custa uma declaracao e elimina a
      // classe inteira de duplicata.
      await this.closingEntries.deleteByClosing(manager, ctx.scope, closing.id);

      // `tenantId` explicito em cada linha: quem normalmente o injeta e o
      // repositorio, a partir do escopo, e ele nao esta neste caminho. Esquecer
      // nao da erro de tipo — da linha sem tenant, invisivel para todo o resto
      // do sistema.
      await manager.save(
        entries.map((entry) =>
          manager.create(FinancialClosingEntry, {
            ...entry,
            tenantId: ctx.scope.tenantId,
            closingId: closing.id,
          }),
        ),
        { chunk: 100 },
      );

      return closing.id;
    });

    // Relido pelo repositorio depois do commit, e nao devolvido de dentro da
    // transacao: e o que garante que o documento servido a quem fechou seja o
    // que o banco guarda, com os defaults de coluna que a entidade em memoria
    // ainda nao tem.
    const saved = await this.closings.findById(ctx.scope, closingId);
    if (!saved) throw new NotFoundError('Balancete');

    // Fora da transacao, depois do commit: uma escrita de auditoria e
    // fire-and-forget por desenho (`audit.service.ts:85-88`) e nao pode derrubar
    // um fato financeiro que ja aconteceu.
    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'UPDATE',
      resource: 'financial-closing',
      resourceId: saved.id,
      description: `Balancete de ${referenceMonth} fechado.`,
      before,
      // A contagem entra no rastro para que ele registre nao so que um mes foi
      // fechado, mas o tamanho do documento que o fechamento produziu.
      after: { status: 'CLOSED', closingBalance: saved.closingBalance, entries: entries.length },
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
   * uma prestacao de contas nao e (ADR-003 de `balancete-mensal`).
   *
   * **Nao apaga os lancamentos gravados.** Enquanto o mes esta aberto eles nao
   * sao lidos — `entries` recalcula, como `statement` ja faz com os totais —,
   * entao mante-los nao mostra nada obsoleto a ninguem. Apaga-los, por outro
   * lado, destruiria o documento de um mes que talvez seja reaberto e fechado de
   * novo sem uma alteracao sequer, e tornaria destrutiva uma operacao que existe
   * para ser reversivel e registrada.
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

  /**
   * Os lancamentos de um mes aberto, montados dos movimentos que existem agora.
   *
   * A janela e a mesma de `compute`, e as duas leituras sao as irmas linha a
   * linha das agregacoes que ele usa — e por isso que a soma dos lancamentos
   * fecha com os totais do resumo. Duas janelas independentes divergiriam no
   * dia em que uma delas ganhasse um filtro que a outra nao ganhou.
   */
  private async computeEntries(
    scope: RequestContext['scope'],
    condominiumId: string,
    referenceMonth: string,
  ): Promise<StatementEntry[]> {
    const { start, endExclusive } = monthRange(referenceMonth);

    const [incomeRows, expenseRows] = await Promise.all([
      this.payments.movementsInRange(scope, condominiumId, start, endExclusive),
      this.expenses.paidMovementsInRange(scope, condominiumId, start, endExclusive),
    ]);

    const categoryIds = [...incomeRows, ...expenseRows]
      .map((row) => row.categoryId)
      .filter((id): id is string => Boolean(id));
    const names = await this.categories.namesByIds(scope, [...new Set(categoryIds)]);

    return sortStatementEntries([
      ...incomeRows.map((row) => toStatementEntry('INCOME', row, names)),
      ...expenseRows.map((row) => toStatementEntry('EXPENSE', row, names)),
    ]);
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

/**
 * A linha gravada, devolvida como foi gravada. Nada e resolvido aqui de
 * proposito: o nome da categoria, a outra parte e o metodo ja foram congelados
 * no fechamento, e reconsultar qualquer um deles deixaria um cadastro alterado
 * depois reescrever uma prestacao de contas ja publicada.
 */
function fromStoredEntry(row: FinancialClosingEntry): StatementEntry {
  return {
    kind: row.kind,
    occurredAt: row.occurredAt,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName,
    description: row.description,
    counterpart: row.counterpart ?? null,
    amount: row.amount,
    method: row.method ?? null,
    sourceId: row.sourceId,
  };
}

export const closingService = new ClosingService();
