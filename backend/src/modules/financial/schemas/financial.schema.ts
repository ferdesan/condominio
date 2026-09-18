import { z } from 'zod';
import { moneySchema, uuidSchema } from '@/shared/dto/common.schema';
import { CATEGORY_KINDS } from '../entities/financial-category.entity';
import { CHARGE_STATUSES, PAYMENT_METHODS } from '../entities/charge.entity';
import { EXPENSE_STATUSES } from '../entities/expense.entity';

const referenceMonthSchema = z
  .string()
  .regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, 'Competencia invalida. Use o formato AAAA-MM.');

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export const createFinancialCategorySchema = z.object({
  condominiumId: uuidSchema,
  name: z.string().min(2, 'Informe o nome da categoria.').max(120),
  kind: z.enum(CATEGORY_KINDS).default('EXPENSE'),
  code: z.string().max(20).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  description: z.string().max(255).optional().nullable(),
  active: z.boolean().default(true),
});

export const updateFinancialCategorySchema = createFinancialCategorySchema.partial();

// ---------------------------------------------------------------------------
// Cobrancas
// ---------------------------------------------------------------------------

export const createChargeSchema = z.object({
  condominiumId: uuidSchema,
  unitId: uuidSchema,
  residentId: uuidSchema.optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  description: z.string().min(3, 'Informe a descricao da cobranca.').max(180),
  referenceMonth: referenceMonthSchema,
  dueDate: z.string().date('Data de vencimento invalida.'),
  amount: moneySchema,
  discount: moneySchema.default(0),
  interest: moneySchema.default(0),
  penalty: moneySchema.default(0),
  barcode: z.string().max(60).optional().nullable(),
  invoiceUrl: z.string().url().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateChargeSchema = createChargeSchema.partial().extend({
  status: z.enum(CHARGE_STATUSES).optional(),
});

/** Geracao em massa das taxas condominiais do mes. */
export const generateChargesSchema = z.object({
  condominiumId: uuidSchema,
  referenceMonth: referenceMonthSchema,
  dueDate: z.string().date('Data de vencimento invalida.'),
  categoryId: uuidSchema.optional().nullable(),
  description: z.string().max(180).default('Taxa condominial'),
  /** Quando informado, substitui o valor cadastrado na unidade. */
  fixedAmount: moneySchema.optional(),
  /** Rateia o valor total pelas fracoes ideais das unidades. */
  totalToApportion: moneySchema.optional(),
  onlyOccupied: z.boolean().default(false),
});

export const registerPaymentSchema = z.object({
  amount: moneySchema.refine((value) => value > 0, 'O valor do pagamento deve ser maior que zero.'),
  paidAt: z.coerce.date().default(() => new Date()),
  method: z.enum(PAYMENT_METHODS).default('PIX'),
  receiptUrl: z.string().url().max(255).optional().nullable(),
  transactionId: z.string().max(80).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Despesas
// ---------------------------------------------------------------------------

export const createExpenseSchema = z.object({
  condominiumId: uuidSchema,
  categoryId: uuidSchema.optional().nullable(),
  serviceProviderId: uuidSchema.optional().nullable(),
  description: z.string().min(3, 'Informe a descricao da despesa.').max(180),
  competence: referenceMonthSchema,
  dueDate: z.string().date('Data de vencimento invalida.'),
  amount: moneySchema,
  status: z.enum(EXPENSE_STATUSES).default('PENDING'),
  /**
   * Aceito na criacao para que uma despesa ja quitada possa ser registrada numa
   * requisicao so. O servico recusa a combinacao incoerente — `PAID` sem data —,
   * e nao a despesa nascer paga.
   */
  paidAt: z.coerce.date().optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  documentUrl: z.string().url().max(255).optional().nullable(),
  documentNumber: z.string().max(60).optional().nullable(),
  isRecurring: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const payExpenseSchema = z.object({
  paidAt: z.coerce.date().default(() => new Date()),
  paymentMethod: z.enum(PAYMENT_METHODS).default('TRANSFER'),
  documentUrl: z.string().url().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const financialSummaryQuerySchema = z.object({
  condominiumId: uuidSchema,
  referenceMonth: referenceMonthSchema.optional(),
});

export type CreateFinancialCategoryDTO = z.infer<typeof createFinancialCategorySchema>;
export type UpdateFinancialCategoryDTO = z.infer<typeof updateFinancialCategorySchema>;
export type CreateChargeDTO = z.infer<typeof createChargeSchema>;
export type UpdateChargeDTO = z.infer<typeof updateChargeSchema>;
export type GenerateChargesDTO = z.infer<typeof generateChargesSchema>;
export type RegisterPaymentDTO = z.infer<typeof registerPaymentSchema>;
export type CreateExpenseDTO = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDTO = z.infer<typeof updateExpenseSchema>;
export type PayExpenseDTO = z.infer<typeof payExpenseSchema>;
export type FinancialSummaryQuery = z.infer<typeof financialSummaryQuerySchema>;

// ---------------------------------------------------------------------------
// Balancete mensal
// ---------------------------------------------------------------------------

export const closingMonthParamsSchema = z.object({ referenceMonth: referenceMonthSchema });

export const closingQuerySchema = z.object({ condominiumId: uuidSchema });

/**
 * `validate` **substitui** `req.query` pelo objeto parseado, entao um schema
 * estrito descartaria `page` e `perPage` e a listagem devolveria sempre a
 * primeira pagina, sem erro nenhum a apontar o motivo. Dai o `passthrough`.
 */
export const closingListQuerySchema = closingQuerySchema.passthrough();

/** Corpo de fechar e reabrir: o condominio, e nada mais. */
export const closingBodySchema = z.object({ condominiumId: uuidSchema });

export type ClosingMonthParams = z.infer<typeof closingMonthParamsSchema>;
export type ClosingQuery = z.infer<typeof closingQuerySchema>;
