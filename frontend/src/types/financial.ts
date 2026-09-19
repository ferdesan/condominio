/**
 * Espelha `backend/src/modules/financial/entities/`.
 *
 * Arquivo proprio pela regra registrada no cabecalho de `types/api.ts`: recurso
 * novo ganha `types/<recurso>.ts`.
 *
 * **Sao quatro recursos sob um modulo so.** `financialRouter` monta
 * `/financial/categories`, `/financial/charges` e `/financial/expenses` com o
 * roteador CRUD compartilhado, mais `/financial/payments`, que e **somente
 * leitura**: a baixa e feita pela cobranca (`POST /charges/:id/payments`), e nao
 * cadastrando um pagamento solto.
 */

export const CATEGORY_KINDS = ['INCOME', 'EXPENSE'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** Plano de contas simplificado do condominio. */
export type FinancialCategory = {
  id: string;
  condominiumId: string;
  name: string;
  kind: CategoryKind;
  code: string | null;
  color: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const CHARGE_STATUSES = ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELED'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const PAYMENT_METHODS = [
  'PIX',
  'BOLETO',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'TRANSFER',
  'CASH',
  'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Unidade como vem aninhada na resposta de `/financial/charges`. */
export type ChargeUnit = {
  id: string;
  number: string;
  blockId: string | null;
};

export type Charge = {
  id: string;
  condominiumId: string;
  unitId: string;
  /** Presente: `ChargeRepository` faz eager load da unidade. */
  unit?: ChargeUnit | null;
  categoryId: string | null;
  residentId: string | null;
  description: string;
  /** Competencia no formato AAAA-MM. */
  referenceMonth: string;
  /** Data (AAAA-MM-DD). */
  dueDate: string;
  amount: number;
  discount: number;
  interest: number;
  penalty: number;
  paidAmount: number;
  status: ChargeStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  barcode: string | null;
  invoiceUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const EXPENSE_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELED'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export type Expense = {
  id: string;
  condominiumId: string;
  categoryId: string | null;
  serviceProviderId: string | null;
  description: string;
  /** Competencia no formato AAAA-MM. */
  competence: string;
  dueDate: string;
  amount: number;
  status: ExpenseStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  documentUrl: string | null;
  documentNumber: string | null;
  isRecurring: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Corpo de `GET /financial/charges/summary`.
 *
 * `billed` ja soma juros e multa e desconta o abatimento — nao e a soma dos
 * valores de face. `open` e o que falta receber, e nao o vencido.
 */
export type ChargeSummary = {
  billed: number;
  received: number;
  open: number;
  overdue: number;
  overdueCount: number;
  pendingCount: number;
  delinquencyRate: number;
};

/** Uma linha de `GET /financial/charges/delinquency`, ja ordenada pelo servidor. */
export type DelinquencyRow = {
  unitId: string;
  unitNumber: string | null;
  blockId: string | null;
  charges: number;
  total: number;
};

/** Corpo de `POST /financial/charges/generate`. */
export type GenerateChargesResult = {
  created: number;
  skipped: number;
  total: number;
};

/** Corpo de `POST /financial/charges/apply-late-fees`. */
export type ApplyLateFeesResult = {
  updated: number;
};

/** Baixa registrada numa cobranca. */
export type Payment = {
  id: string;
  condominiumId: string;
  chargeId: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  receiptUrl: string | null;
  registeredById: string | null;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** Corpo de `POST /financial/charges/:id/payments`: a baixa e a cobranca atualizada. */
export type RegisterPaymentResult = {
  charge: Charge;
  payment: Payment;
};

// ---------------------------------------------------------------------------
// Balancete mensal
// ---------------------------------------------------------------------------

export const CLOSING_STATUSES = ['CLOSED', 'OPEN'] as const;
export type ClosingStatus = (typeof CLOSING_STATUSES)[number];

export type OpeningBalanceSource = 'INHERITED' | 'COMPUTED';

/** Uma linha do balancete: uma categoria, ou a linha explicita sem categoria. */
export type StatementLine = {
  categoryId: string | null;
  name: string;
  total: number;
};

/**
 * Corpo de `GET /financial/closings/:referenceMonth`.
 *
 * A forma e a mesma com o mes aberto ou fechado — o servidor recalcula num caso
 * e serve o documento gravado no outro. Quem le descobre em qual estado esta por
 * `status` e `closedAt`, e nao por um payload diferente.
 */
export type MonthlyStatement = {
  condominiumId: string;
  referenceMonth: string;
  status: ClosingStatus;
  openingBalance: {
    amount: number;
    source: OpeningBalanceSource;
    /** Competencia herdada (`AAAA-MM`) ou data de corte (`AAAA-MM-DD`). */
    from: string | null;
  };
  income: StatementLine[];
  expense: StatementLine[];
  totalIncome: number;
  totalExpense: number;
  result: number;
  closingBalance: number;
  /** Despesas pagas sem data: fora de todo total, de proposito. */
  unresolvedPaidExpenses: { count: number; total: number };
  /** Quadro auxiliar: inadimplencia da competencia, fora do resultado. */
  delinquency: { amount: number; count: number };
  closedAt: string | null;
  closedBy: { id: string; name: string | null } | null;
  reopenedAt: string | null;
  reopenCount: number;
};

/** Linha da listagem de meses fechados. */
export type FinancialClosing = {
  id: string;
  condominiumId: string;
  referenceMonth: string;
  status: ClosingStatus;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
  closedAt: string | null;
  closedByName: string | null;
  reopenCount: number;
};

// ---------------------------------------------------------------------------
// Lancamentos do balancete
// ---------------------------------------------------------------------------

export const CLOSING_ENTRY_KINDS = ['INCOME', 'EXPENSE'] as const;

/**
 * De que lado do balancete o lancamento esta.
 *
 * Tem os mesmos dois valores de `CategoryKind` e nao e ele: aquele classifica
 * uma conta do plano de contas, este diz se o dinheiro entrou ou saiu. Unir os
 * dois faria uma renomeacao no plano de contas alcancar um documento fechado.
 */
export type ClosingEntryKind = (typeof CLOSING_ENTRY_KINDS)[number];

/**
 * Um lancamento do balancete: uma entrada ou uma saida, como ela foi naquele dia.
 *
 * Espelha `backend/src/modules/financial/closing-math.ts`. Ali `occurredAt` e um
 * `Date`; aqui e a string ISO que o JSON entrega, como em `Payment.paidAt`.
 *
 * `categoryName` e `counterpart` chegam congelados no mes fechado: a categoria
 * pode ser renomeada e o prestador removido depois, e nenhum dos dois pode
 * reescrever uma prestacao de contas ja publicada (ADR-002).
 */
export type StatementEntry = {
  kind: ClosingEntryKind;
  /** Data de caixa: o pagamento recebido ou a despesa paga. */
  occurredAt: string;
  categoryId: string | null;
  categoryName: string;
  description: string;
  /** A outra parte: numero da unidade na entrada, prestador na saida. */
  counterpart: string | null;
  amount: number;
  method: PaymentMethod | null;
  /** Referencia a origem (`payment.id` ou `expense.id`). **Nao e um link** (ADR-002). */
  sourceId: string;
};

/**
 * Corpo de `GET /financial/closings/:referenceMonth/entries`.
 *
 * Um objeto, e nao a lista crua: o mes inteiro vem numa resposta so e a tabela
 * pagina no cliente (ADR-004), entao uma adicao futura — uma contagem, um aviso
 * de corte — nao muda a forma do que ja foi publicado.
 *
 * `frozen` diz de onde as linhas vieram: `true` quando foram lidas do
 * fechamento gravado, `false` quando foram calculadas ao vivo. E o que permite
 * distinguir um documento anterior ao registro dos lancamentos — `frozen: true`,
 * lista vazia e totais acima de zero — de um mes que simplesmente nao teve
 * movimento.
 */
export type ClosingEntries = {
  entries: StatementEntry[];
  frozen: boolean;
};
