/**
 * Espelho cliente de `backend/src/modules/financial/schemas/financial.schema.ts`.
 *
 * Mesma convencao dos demais formularios: tudo entra e sai como string, entao
 * `z.infer` basta e cada `useForm` precisa de um generico so. A conversao para o
 * corpo da requisicao acontece nas funcoes `to...Payload`.
 *
 * **Dinheiro e digitado como numero decimal, e nao pelo `CurrencyInput`.** O
 * controle de moeda guarda `number` e formata no proprio estado, o que quebraria
 * a convencao de valores em texto deste projeto — a mesma escolha que
 * `unit-schema.ts` ja fez para a taxa mensal. A formatacao acontece na leitura,
 * em `formatCurrency`.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 */

import { z } from 'zod';
import {
  CATEGORY_KINDS,
  CHARGE_STATUSES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  type Charge,
  type Expense,
  type FinancialCategory,
} from '@/types/financial';

/** Teto do `moneySchema` do servidor. */
const MAX_MONEY = 99_999_999.99;

function money(message: string) {
  return z
    .string()
    .refine((value) => value !== '', 'Informe o valor.')
    .refine((value) => Number.isFinite(Number(value)), 'Informe um valor numerico.')
    .refine((value) => Number(value) >= 0 && Number(value) <= MAX_MONEY, message);
}

function optionalMoney(message: string) {
  return z
    .string()
    .refine((value) => value === '' || Number.isFinite(Number(value)), 'Informe um valor numerico.')
    .refine((value) => value === '' || (Number(value) >= 0 && Number(value) <= MAX_MONEY), message);
}

const referenceMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM.');

const isoDate = z.string().min(1, 'Informe a data de vencimento.');

/** Hoje, no formato do input nativo de data. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Competencia do mes corrente. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Agora, no formato do input nativo de data e hora. */
function localNow(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Horario local do formulario -> ISO para o servidor. */
function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

// ---------------------------------------------------------------------------
// Categoria
// ---------------------------------------------------------------------------

const categoryFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome da categoria.')
    .max(120, 'Use no máximo 120 caracteres.'),
  kind: z.enum(CATEGORY_KINDS),
  code: z.string().trim().max(20, 'Use no máximo 20 caracteres.'),
  description: z.string().trim().max(255, 'Use no máximo 255 caracteres.'),
  active: z.boolean(),
});

export const categorySchema = categoryFields;
export type CategoryFormValues = z.infer<typeof categoryFields>;
export const CATEGORY_FIELDS: ReadonlySet<string> = new Set(Object.keys(categoryFields.shape));

export function categoryFormDefaults(): CategoryFormValues {
  return { name: '', kind: 'EXPENSE', code: '', description: '', active: true };
}

export type CategoryPayload = {
  condominiumId: string;
  name: string;
  kind: CategoryFormValues['kind'];
  code: string | null;
  description: string | null;
  active: boolean;
};

export function toCategoryPayload(
  values: CategoryFormValues,
  condominiumId: string,
): CategoryPayload {
  return {
    condominiumId,
    name: values.name,
    kind: values.kind,
    code: values.code || null,
    description: values.description || null,
    active: values.active,
  };
}

export function toCategoryFormValues(category: FinancialCategory): CategoryFormValues {
  return {
    name: category.name,
    kind: category.kind,
    code: category.code ?? '',
    description: category.description ?? '',
    active: category.active,
  };
}

// ---------------------------------------------------------------------------
// Cobranca
// ---------------------------------------------------------------------------

const chargeFields = z.object({
  unitId: z.string().min(1, 'Escolha a unidade cobrada.'),
  categoryId: z.string(),
  description: z
    .string()
    .trim()
    .min(3, 'Informe a descrição da cobrança.')
    .max(180, 'Use no máximo 180 caracteres.'),
  referenceMonth,
  dueDate: isoDate,
  amount: money('O valor deve estar entre 0 e 99.999.999,99.'),
  discount: optionalMoney('O desconto deve estar entre 0 e 99.999.999,99.'),
  interest: optionalMoney('Os juros devem estar entre 0 e 99.999.999,99.'),
  penalty: optionalMoney('A multa deve estar entre 0 e 99.999.999,99.'),
  notes: z.string().trim().max(1000, 'Use no máximo 1000 caracteres.'),
});

export const chargeSchema = chargeFields;
export type ChargeFormValues = z.infer<typeof chargeFields>;
export const CHARGE_FIELDS: ReadonlySet<string> = new Set(Object.keys(chargeFields.shape));

export function chargeFormDefaults(): ChargeFormValues {
  return {
    unitId: '',
    categoryId: '',
    description: 'Taxa condominial',
    referenceMonth: currentMonth(),
    dueDate: today(),
    amount: '',
    discount: '0',
    interest: '0',
    penalty: '0',
    notes: '',
  };
}

export type ChargePayload = {
  condominiumId: string;
  unitId: string;
  categoryId: string | null;
  description: string;
  referenceMonth: string;
  dueDate: string;
  amount: number;
  discount: number;
  interest: number;
  penalty: number;
  notes: string | null;
};

export function toChargePayload(values: ChargeFormValues, condominiumId: string): ChargePayload {
  return {
    condominiumId,
    unitId: values.unitId,
    categoryId: values.categoryId || null,
    description: values.description,
    referenceMonth: values.referenceMonth,
    dueDate: values.dueDate,
    amount: Number(values.amount),
    discount: values.discount === '' ? 0 : Number(values.discount),
    interest: values.interest === '' ? 0 : Number(values.interest),
    penalty: values.penalty === '' ? 0 : Number(values.penalty),
    notes: values.notes || null,
  };
}

export function toChargeFormValues(charge: Charge): ChargeFormValues {
  return {
    unitId: charge.unitId,
    categoryId: charge.categoryId ?? '',
    description: charge.description,
    referenceMonth: charge.referenceMonth,
    dueDate: charge.dueDate,
    amount: String(charge.amount),
    discount: String(charge.discount),
    interest: String(charge.interest),
    penalty: String(charge.penalty),
    notes: charge.notes ?? '',
  };
}

/** O status nunca vai no corpo: quem o move sao `/payments` e `/cancel`. */
export const CHARGE_STATUS_VALUES = CHARGE_STATUSES;

// ---------------------------------------------------------------------------
// Geracao em lote
// ---------------------------------------------------------------------------

const generateFields = z
  .object({
    referenceMonth,
    dueDate: isoDate,
    categoryId: z.string(),
    description: z
      .string()
      .trim()
      .min(3, 'Informe a descrição das cobranças.')
      .max(180, 'Use no máximo 180 caracteres.'),
    /** Vazio usa a taxa cadastrada na unidade. */
    fixedAmount: optionalMoney('O valor deve estar entre 0 e 99.999.999,99.'),
    /** Vazio nao rateia. */
    totalToApportion: optionalMoney('O total deve estar entre 0 e 99.999.999,99.'),
    onlyOccupied: z.boolean(),
  })
  .refine((values) => !(values.fixedAmount && values.totalToApportion), {
    path: ['totalToApportion'],
    message: 'Escolha um dos dois: valor fixo por unidade ou total a ratear.',
  });

export const generateChargesSchema = generateFields;
export type GenerateFormValues = z.infer<typeof generateFields>;
export const GENERATE_FIELDS: ReadonlySet<string> = new Set([
  'referenceMonth',
  'dueDate',
  'categoryId',
  'description',
  'fixedAmount',
  'totalToApportion',
  'onlyOccupied',
]);

export function generateFormDefaults(): GenerateFormValues {
  return {
    referenceMonth: currentMonth(),
    dueDate: today(),
    categoryId: '',
    description: 'Taxa condominial',
    fixedAmount: '',
    totalToApportion: '',
    onlyOccupied: false,
  };
}

export type GeneratePayload = {
  condominiumId: string;
  referenceMonth: string;
  dueDate: string;
  categoryId: string | null;
  description: string;
  fixedAmount?: number;
  totalToApportion?: number;
  onlyOccupied: boolean;
};

/**
 * Os dois valores opcionais sao **omitidos** quando vazios, e nao enviados como
 * zero: zero e um valor valido para o servidor e geraria cobrancas de R$ 0,00,
 * enquanto a ausencia manda ele usar a taxa cadastrada na unidade.
 */
export function toGeneratePayload(
  values: GenerateFormValues,
  condominiumId: string,
): GeneratePayload {
  return {
    condominiumId,
    referenceMonth: values.referenceMonth,
    dueDate: values.dueDate,
    categoryId: values.categoryId || null,
    description: values.description,
    ...(values.fixedAmount ? { fixedAmount: Number(values.fixedAmount) } : {}),
    ...(values.totalToApportion ? { totalToApportion: Number(values.totalToApportion) } : {}),
    onlyOccupied: values.onlyOccupied,
  };
}

// ---------------------------------------------------------------------------
// Baixa de pagamento
// ---------------------------------------------------------------------------

const paymentFields = z.object({
  amount: money('O valor deve estar entre 0 e 99.999.999,99.').refine(
    (value) => Number(value) > 0,
    'O valor do pagamento deve ser maior que zero.',
  ),
  paidAt: z.string().min(1, 'Informe quando o pagamento foi recebido.'),
  method: z.enum(PAYMENT_METHODS),
  transactionId: z.string().trim().max(80, 'Use no máximo 80 caracteres.'),
  notes: z.string().trim().max(1000, 'Use no máximo 1000 caracteres.'),
});

export const registerPaymentSchema = paymentFields;
export type PaymentFormValues = z.infer<typeof paymentFields>;
export const PAYMENT_FIELDS: ReadonlySet<string> = new Set(Object.keys(paymentFields.shape));

/** O valor ja vem preenchido com o saldo: a baixa total e o caso comum. */
export function paymentFormDefaults(outstanding: number): PaymentFormValues {
  return {
    amount: String(outstanding),
    paidAt: localNow(),
    method: 'PIX',
    transactionId: '',
    notes: '',
  };
}

export type PaymentPayload = {
  amount: number;
  paidAt: string;
  method: PaymentFormValues['method'];
  transactionId: string | null;
  notes: string | null;
};

export function toPaymentPayload(values: PaymentFormValues): PaymentPayload {
  return {
    amount: Number(values.amount),
    paidAt: toIso(values.paidAt),
    method: values.method,
    transactionId: values.transactionId || null,
    notes: values.notes || null,
  };
}

// ---------------------------------------------------------------------------
// Despesa
// ---------------------------------------------------------------------------

const expenseFields = z.object({
  categoryId: z.string(),
  serviceProviderId: z.string(),
  description: z
    .string()
    .trim()
    .min(3, 'Informe a descrição da despesa.')
    .max(180, 'Use no máximo 180 caracteres.'),
  competence: referenceMonth,
  dueDate: isoDate,
  amount: money('O valor deve estar entre 0 e 99.999.999,99.'),
  documentNumber: z.string().trim().max(60, 'Use no máximo 60 caracteres.'),
  isRecurring: z.boolean(),
  notes: z.string().trim().max(1000, 'Use no máximo 1000 caracteres.'),
});

export const expenseSchema = expenseFields;
export type ExpenseFormValues = z.infer<typeof expenseFields>;
export const EXPENSE_FIELDS: ReadonlySet<string> = new Set(Object.keys(expenseFields.shape));

export function expenseFormDefaults(): ExpenseFormValues {
  return {
    categoryId: '',
    serviceProviderId: '',
    description: '',
    competence: currentMonth(),
    dueDate: today(),
    amount: '',
    documentNumber: '',
    isRecurring: false,
    notes: '',
  };
}

export type ExpensePayload = {
  condominiumId: string;
  categoryId: string | null;
  serviceProviderId: string | null;
  description: string;
  competence: string;
  dueDate: string;
  amount: number;
  documentNumber: string | null;
  isRecurring: boolean;
  notes: string | null;
};

/**
 * `status` fica de fora de proposito: a despesa nasce a pagar e quem a liquida e
 * `/expenses/:id/pay`, que grava a data e a forma de pagamento junto. Manda-lo
 * daqui criaria um segundo caminho para a mesma transicao, sem esses campos.
 */
export function toExpensePayload(values: ExpenseFormValues, condominiumId: string): ExpensePayload {
  return {
    condominiumId,
    categoryId: values.categoryId || null,
    serviceProviderId: values.serviceProviderId || null,
    description: values.description,
    competence: values.competence,
    dueDate: values.dueDate,
    amount: Number(values.amount),
    documentNumber: values.documentNumber || null,
    isRecurring: values.isRecurring,
    notes: values.notes || null,
  };
}

export function toExpenseFormValues(expense: Expense): ExpenseFormValues {
  return {
    categoryId: expense.categoryId ?? '',
    serviceProviderId: expense.serviceProviderId ?? '',
    description: expense.description,
    competence: expense.competence,
    dueDate: expense.dueDate,
    amount: String(expense.amount),
    documentNumber: expense.documentNumber ?? '',
    isRecurring: expense.isRecurring,
    notes: expense.notes ?? '',
  };
}

export const EXPENSE_STATUS_VALUES = EXPENSE_STATUSES;

// ---------------------------------------------------------------------------
// Liquidacao de despesa
// ---------------------------------------------------------------------------

const payExpenseFields = z.object({
  paidAt: z.string().min(1, 'Informe quando a despesa foi paga.'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(1000, 'Use no máximo 1000 caracteres.'),
});

export const payExpenseSchema = payExpenseFields;
export type PayExpenseFormValues = z.infer<typeof payExpenseFields>;
export const PAY_EXPENSE_FIELDS: ReadonlySet<string> = new Set(Object.keys(payExpenseFields.shape));

export function payExpenseFormDefaults(): PayExpenseFormValues {
  return { paidAt: localNow(), paymentMethod: 'TRANSFER', notes: '' };
}

export type PayExpensePayload = {
  paidAt: string;
  paymentMethod: PayExpenseFormValues['paymentMethod'];
  notes: string | null;
};

export function toPayExpensePayload(values: PayExpenseFormValues): PayExpensePayload {
  return {
    paidAt: toIso(values.paidAt),
    paymentMethod: values.paymentMethod,
    notes: values.notes || null,
  };
}
