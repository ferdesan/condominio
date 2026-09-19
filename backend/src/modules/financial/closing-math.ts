import type { PaymentMethod } from './entities/charge.entity';
import type { ClosingEntryKind } from './entities/financial-closing-entry.entity';
import type {
  ClosingBreakdown,
  ClosingStatus,
  OpeningBalanceSource,
  StatementLine,
} from './entities/financial-closing.entity';

/** Linha do balancete sem categoria atribuida. E uma linha, nunca um descarte. */
export const UNCATEGORIZED_LABEL = 'Sem categoria';

/**
 * Categoria que a linha aponta e o cadastro nao tem mais — nem entre as
 * removidas. Diferente de `Sem categoria`: ali ninguem classificou, aqui alguem
 * classificou e a referencia se perdeu. Confundir as duas esconde um defeito de
 * dado atras de um rotulo que parece normal.
 */
export const MISSING_CATEGORY_LABEL = 'Categoria removida';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Linha crua de um `GROUP BY category_id`, como o QueryBuilder a devolve. */
export type GroupedTotal = {
  categoryId: string | null;
  total: number | string | null;
};

/**
 * Monta as linhas do balancete e o total que vai no topo.
 *
 * **O total sai das linhas, e nao de uma segunda consulta.** Duas somas
 * independentes sobre a mesma tabela divergem no dia em que uma delas ganha um
 * filtro que a outra nao ganhou — foi assim que `charges/summary`,
 * `delinquencyByUnit` e `monthlySeries` acabaram com tres definicoes diferentes
 * de "valor da cobranca" (`charge.repository.ts:65-134`). Aqui ha um caminho so.
 */
export function toStatementLines(
  rows: GroupedTotal[],
  categoryNames: Map<string, string>,
): { lines: StatementLine[]; total: number } {
  const lines = rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.categoryId
      ? (categoryNames.get(row.categoryId) ?? MISSING_CATEGORY_LABEL)
      : UNCATEGORIZED_LABEL,
    total: round2(Number(row.total ?? 0)),
  }));

  lines.sort((a, b) => b.total - a.total);

  return { lines, total: round2(lines.reduce((sum, line) => sum + line.total, 0)) };
}

/**
 * Janela de movimentos que compoe o saldo de abertura calculado: da data de
 * corte (inclusive) ate o primeiro instante do mes (exclusive).
 *
 * Corte nulo devolve `from: null`, e nao uma data inventada: "nao informado"
 * significa que tudo o que o banco guarda entra na conta, que e a unica leitura
 * honesta da ausencia.
 */
export function openingBalanceWindow(
  openingBalanceDate: string | null | undefined,
  monthStart: Date,
): { from: Date | null; toExclusive: Date } {
  return {
    from: openingBalanceDate ? new Date(`${openingBalanceDate}T00:00:00`) : null,
    toExclusive: monthStart,
  };
}

/**
 * Le o `breakdown` gravado tolerando forma anterior.
 *
 * A coluna e `simple-json`: o banco nao valida nada, e um documento fechado hoje
 * pode ser lido por um codigo que ganhou campos depois. Preencher com vazio o que
 * falta e a diferenca entre um balancete antigo que abre com uma linha a menos e
 * um balancete antigo que nao abre.
 */
export function readBreakdown(raw: unknown): ClosingBreakdown {
  const value = (raw ?? {}) as Partial<ClosingBreakdown>;
  const unresolved = value.unresolvedPaidExpenses;

  return {
    income: Array.isArray(value.income) ? value.income : [],
    expense: Array.isArray(value.expense) ? value.expense : [],
    unresolvedPaidExpenses: {
      count: Number(unresolved?.count ?? 0),
      total: Number(unresolved?.total ?? 0),
    },
  };
}

export type OpeningBalanceInput = {
  /** Fechamento do mes anterior, quando existe linha. */
  previous: { status: ClosingStatus; closingBalance: number; referenceMonth: string } | null;
  condominium: { openingBalance: number; openingBalanceDate?: string | null };
  /** Movimentos entre o corte e o inicio do mes, ja somados. */
  movements: { income: number; expense: number };
};

export type ResolvedOpeningBalance = {
  amount: number;
  source: OpeningBalanceSource;
  from: string | null;
};

/**
 * De onde vem o saldo que abre o mes (ADR-002).
 *
 * Herda do mes anterior **somente quando ele esta fechado**. Uma linha `OPEN` e
 * um mes que ja foi fechado e depois reaberto: os totais gravados nela nao valem
 * mais, porque o mes voltou a receber lancamento. Tratar `OPEN` como herdavel
 * propagaria um saldo obsoleto para todos os meses seguintes.
 */
export function resolveOpeningBalance(input: OpeningBalanceInput): ResolvedOpeningBalance {
  const { previous, condominium, movements } = input;

  if (previous && previous.status === 'CLOSED') {
    return {
      amount: round2(previous.closingBalance),
      source: 'INHERITED',
      from: previous.referenceMonth,
    };
  }

  return {
    amount: round2(condominium.openingBalance + movements.income - movements.expense),
    source: 'COMPUTED',
    from: condominium.openingBalanceDate ?? null,
  };
}

// ---------------------------------------------------------------------------
// Lancamentos do balancete (ADR-002)
// ---------------------------------------------------------------------------

/** Um lancamento do balancete: uma entrada ou uma saida, como ela foi naquele dia. */
export type StatementEntry = {
  kind: ClosingEntryKind;
  /** Data de caixa: `payment.paid_at` ou `expense.paid_at`. */
  occurredAt: Date;
  categoryId: string | null;
  /** Congelado: a categoria pode ser renomeada ou removida depois. */
  categoryName: string;
  description: string;
  /** A outra parte: numero da unidade na entrada, prestador na saida. */
  counterpart: string | null;
  amount: number;
  method: PaymentMethod | null;
  /** Referencia a origem (`payment.id` ou `expense.id`). Nao e um link. */
  sourceId: string;
};

/** Linha crua de um movimento, como o QueryBuilder a devolve do join manual. */
export type RawMovement = {
  sourceId: string;
  occurredAt: Date | string;
  categoryId: string | null;
  description: string | null;
  counterpart: string | null;
  amount: number | string | null;
  method: string | null;
};

/**
 * Monta um lancamento a partir de uma linha crua, resolvendo o nome da categoria
 * pelo mesmo par de rotulos que `toStatementLines` ja usa nas linhas por
 * categoria: `Sem categoria` quando ninguem classificou, `Categoria removida`
 * quando alguem classificou e a referencia se perdeu. Duas situacoes
 * diferentes, e confundi-las esconderia um defeito de dado atras de um rotulo
 * que parece normal.
 */
export function toStatementEntry(
  kind: ClosingEntryKind,
  row: RawMovement,
  categoryNames: Map<string, string>,
): StatementEntry {
  return {
    kind,
    occurredAt: row.occurredAt instanceof Date ? row.occurredAt : new Date(row.occurredAt),
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryId
      ? (categoryNames.get(row.categoryId) ?? MISSING_CATEGORY_LABEL)
      : UNCATEGORIZED_LABEL,
    description: row.description ?? '',
    counterpart: row.counterpart ?? null,
    amount: round2(Number(row.amount ?? 0)),
    method: (row.method as PaymentMethod | null) ?? null,
    sourceId: row.sourceId,
  };
}

/**
 * A ordem do documento: data crescente, valor decrescente, `sourceId` para
 * desempatar.
 *
 * O terceiro criterio e o que torna a ordem **total**, e nao um detalhe: sem
 * ele, dois lancamentos do mesmo dia e do mesmo valor sairiam em ordem
 * arbitraria, duas leituras do mesmo mes fechado poderiam divergir, e o diff de
 * duas exportacoes deixaria de significar alguma coisa. A mesma funcao ordena
 * os dois modos de leitura de proposito: quem le nao deve conseguir dizer, pela
 * ordem, se o mes estava aberto.
 */
export function sortStatementEntries(entries: StatementEntry[]): StatementEntry[] {
  return [...entries].sort((a, b) => {
    const byDate = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (byDate !== 0) return byDate;

    const byAmount = b.amount - a.amount;
    if (byAmount !== 0) return byAmount;

    return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
  });
}
