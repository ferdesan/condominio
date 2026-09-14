/**
 * Rotulos do modulo financeiro, compartilhados pelas tres secoes, os filtros e
 * os formularios.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type {
  CategoryKind,
  Charge,
  ChargeStatus,
  Expense,
  ExpenseStatus,
  FinancialCategory,
  PaymentMethod,
} from '@/types/financial';

/**
 * Os cinco estados de uma cobranca.
 *
 * Nenhum rotulo repete um cabecalho de coluna ("Cobranca", "Unidade",
 * "Competencia", "Vencimento", "Valor", "Situacao", "Acoes") nem o rotulo de um
 * filtro — a colisao que ja quebrou consultas por texto em telas anteriores.
 * "Quitada" e "Parcial" em vez de "Paga"/"Pago", que colidiriam com a acao
 * "Pagar" das despesas.
 */
export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  PENDING: 'Em aberto',
  PAID: 'Quitada',
  PARTIAL: 'Parcial',
  OVERDUE: 'Vencida',
  CANCELED: 'Cancelada',
};

/** Os quatro estados de uma despesa. */
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'A pagar',
  PAID: 'Liquidada',
  OVERDUE: 'Atrasada',
  CANCELED: 'Cancelada',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartao de credito',
  DEBIT_CARD: 'Cartao de debito',
  TRANSFER: 'Transferencia',
  CASH: 'Dinheiro',
  OTHER: 'Outro',
};

/**
 * Receita e despesa no plano de contas.
 *
 * O texto e o do plano de contas, e nao "Entrada"/"Saida": e o vocabulario que
 * aparece na prestacao de contas do condominio.
 */
export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
};

/** As tres secoes da tela. */
export const SECTIONS = [
  { id: 'charges', label: 'Cobrancas' },
  { id: 'expenses', label: 'Despesas' },
  { id: 'categories', label: 'Plano de contas' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

/** Dito quando a cobranca ou despesa nao esta classificada. */
export const NO_CATEGORY = 'Sem categoria';

/** Dito quando a despesa nao tem prestador vinculado. */
export const NO_PROVIDER = 'Sem prestador';

/** Dito quando a categoria referida nao esta na colecao carregada. */
export const CATEGORY_UNAVAILABLE = 'Categoria indisponivel';

/** Dito quando a unidade referida nao veio aninhada na resposta. */
export const UNIT_UNAVAILABLE = 'Unidade indisponivel';

/** Identifica a cobranca nos rotulos acessiveis das acoes de linha. */
export function chargeLabel(charge: Charge): string {
  const unit = charge.unit?.number;
  return unit ? `${charge.description} da unidade ${unit}` : charge.description;
}

/** Identifica a despesa nos rotulos acessiveis das acoes de linha. */
export function expenseLabel(expense: Expense): string {
  return expense.description;
}

/** Identifica a categoria nos rotulos acessiveis das acoes de linha. */
export function categoryLabel(category: FinancialCategory): string {
  return category.name;
}

/**
 * O que a cobranca ainda deve.
 *
 * Nao e `amount`: o servidor cobra o valor de face mais juros e multa, menos o
 * desconto, e abate o que ja foi pago. Repetir a conta aqui e o unico jeito de a
 * coluna dizer a mesma coisa que o boleto — o endpoint de resumo agrega o
 * condominio inteiro, e nao devolve o saldo linha a linha.
 */
export function outstandingAmount(charge: Charge): number {
  const total = charge.amount + charge.interest + charge.penalty - charge.discount;
  return Math.max(0, total - charge.paidAmount);
}

/** Competencia AAAA-MM como o servidor a grava; vazio quando ausente. */
export function isReferenceMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
