/**
 * Fixtures e duble de transporte dos testes do financeiro (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/financial.ts`: aquele arquivo e compartilhado
 * entre tasks. Como a fixture e tipada contra o contrato, uma divergencia
 * quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta, makeServiceProvider, makeUnit } from '@/test/fixtures';
import type { ServiceProvider, Unit } from '@/types/api';
import type {
  Charge,
  Payment,
  ChargeSummary,
  DelinquencyRow,
  Expense,
  FinancialCategory,
} from '@/types/financial';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeCategory(overrides: Partial<FinancialCategory> = {}): FinancialCategory {
  return {
    id: 'category-1',
    condominiumId: 'cond-1',
    name: 'Taxa condominial',
    kind: 'INCOME',
    code: '1.1',
    description: 'Receita ordinaria do condominio.',
    color: null,
    active: true,
    ...TIMESTAMPS,
    ...overrides,
  };
}

/**
 * Cobranca com encargos.
 *
 * O padrao tem juros, multa, desconto e uma baixa parcial de proposito: e a
 * unica forma de o teste do saldo provar que a conta e
 * `amount + juros + multa - desconto - pago`, e nao simplesmente `amount`.
 */
export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    condominiumId: 'cond-1',
    chargeId: 'charge-1',
    amount: 250,
    paidAt: '2026-03-05T14:00:00.000Z',
    method: 'PIX',
    receiptUrl: null,
    registeredById: 'user-1',
    transactionId: null,
    notes: null,
    createdAt: '2026-03-05T14:00:00.000Z',
    updatedAt: '2026-03-05T14:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

export function makeCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: 'charge-1',
    condominiumId: 'cond-1',
    unitId: 'unit-1',
    unit: { id: 'unit-1', number: '101', blockId: 'block-1' },
    categoryId: 'category-1',
    residentId: null,
    description: 'Taxa condominial 03/2026',
    referenceMonth: '2026-03',
    dueDate: '2026-03-10',
    amount: 1000,
    discount: 50,
    interest: 20,
    penalty: 30,
    paidAmount: 200,
    status: 'PARTIAL',
    paidAt: null,
    paymentMethod: null,
    barcode: null,
    invoiceUrl: null,
    notes: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    condominiumId: 'cond-1',
    categoryId: 'category-1',
    serviceProviderId: 'provider-1',
    description: 'Limpeza mensal',
    competence: '2026-03',
    dueDate: '2026-03-20',
    amount: 4200,
    status: 'PENDING',
    paidAt: null,
    paymentMethod: null,
    documentUrl: null,
    documentNumber: 'NF-1234',
    isRecurring: true,
    notes: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<ChargeSummary> = {}): ChargeSummary {
  return {
    billed: 48_000,
    received: 31_500,
    open: 16_500,
    overdue: 9_200,
    overdueCount: 7,
    pendingCount: 19,
    delinquencyRate: 19.17,
    ...overrides,
  };
}

export function makeDelinquencyRow(overrides: Partial<DelinquencyRow> = {}): DelinquencyRow {
  return {
    unitId: 'unit-9',
    unitNumber: '909',
    blockId: 'block-1',
    charges: 3,
    total: 3_600,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type FinancialWorld = {
  charges: Charge[];
  /** Historico de baixas, servido por `/financial/payments`. */
  payments: Payment[];
  expenses: Expense[];
  categories: FinancialCategory[];
  units: Unit[];
  providers: ServiceProvider[];
  summary: ChargeSummary;
  delinquency: DelinquencyRow[];
  /** `meta.total` da listagem de cobrancas, para exercitar a paginacao. */
  chargeTotal?: number;
};

/**
 * Responde as oito rotas de leitura que a tela alcanca a partir de uma unica
 * descricao do mundo. O objeto devolvido e o mesmo que os mocks leem, entao
 * mutar um campo dele muda o que a proxima requisicao ve.
 */
export function serveFinancial(initial: Partial<FinancialWorld> = {}): FinancialWorld {
  const world: FinancialWorld = {
    charges: [],
    payments: [],
    expenses: [],
    categories: [makeCategory()],
    units: [makeUnit({ id: 'unit-1', number: '101' })],
    providers: [makeServiceProvider({ id: 'provider-1' })],
    summary: makeSummary(),
    delinquency: [],
    ...initial,
  };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    const collection =
      url === '/financial/charges'
        ? world.charges
        : url === '/financial/expenses'
          ? world.expenses
          : url === '/financial/categories'
            ? world.categories
            : url === '/units'
              ? world.units
              : url === '/service-providers'
                ? world.providers
                : url === '/financial/payments'
                  ? // O servidor filtra por `chargeId`; o duble faz o mesmo, para
                    // que um caso com duas cobrancas nao veja o historico da outra.
                    world.payments.filter(
                      (payment) => !params.chargeId || payment.chargeId === params.chargeId,
                    )
                  : null;

    if (collection === null) {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    const total =
      url === '/financial/charges' ? (world.chargeTotal ?? collection.length) : collection.length;

    return {
      data: collection,
      meta: makeMeta({
        total,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/financial/charges/summary') return world.summary as never;
    if (url === '/financial/charges/delinquency') return world.delinquency as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem pedida a uma rota. */
export function lastParamsOf(url: string): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([called]) => called === url);
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Parametros de toda consulta de leitura feita pela tela, com a URL junto. */
export function allReadRequests(): Array<{ url: string; params: RequestParams }> {
  const paginated = vi
    .mocked(apiGetPaginated)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  const plain = vi
    .mocked(apiGet)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  return [...paginated, ...plain];
}
