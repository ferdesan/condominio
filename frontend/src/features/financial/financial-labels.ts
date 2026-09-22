/**
 * Rotulos do modulo financeiro, compartilhados pelas tres secoes, os filtros e
 * os formularios.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import { BookOpen, Receipt, Scale, Wallet } from 'lucide-react';
import { formatDate, formatReferenceMonth } from '@/lib/format';
import type {
  CategoryKind,
  Charge,
  ChargeStatus,
  ClosingEntryKind,
  Expense,
  ExpenseStatus,
  FinancialCategory,
  OpeningBalanceSource,
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
  TRANSFER: 'Transferência',
  CASH: 'Dinheiro',
  OTHER: 'Outro',
};

/**
 * Os dois lados de um lancamento do balancete.
 *
 * Nao reusa `CATEGORY_KIND_LABELS`: ali o texto e o do plano de contas —
 * "Receita" e "Despesa" nomeiam a conta —, e aqui a coluna nomeia o movimento,
 * do mesmo jeito que as duas tabelas da secao ja dizem "Entradas por categoria"
 * e "Saidas por categoria". Rotulos distintos tambem sao o que faz ordenar a
 * planilha exportada por essa coluna separar os dois lados.
 */
export const CLOSING_ENTRY_KIND_LABELS: Record<ClosingEntryKind, string> = {
  INCOME: 'Entrada',
  EXPENSE: 'Saída',
};

/**
 * Forma de pagamento de um lancamento, com o traco quando a origem nao registrou
 * nenhuma — uma despesa liquidada sem meio informado e um dado ausente, e nao um
 * meio chamado "Outro", que e uma escolha de quem lancou.
 */
export function paymentMethodLabel(method: PaymentMethod | null): string {
  return method ? PAYMENT_METHOD_LABELS[method] : '—';
}

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

/**
 * As quatro secoes da tela.
 *
 * O `icon` existe para o mobile: abaixo de `sm` o rotulo inteiro estoura a
 * largura da viewport, entao a aba vira so o glifo e o nome volta na tarja
 * (`Tooltip`). Em `sm` e acima o rotulo continua o texto visivel — o icone la
 * fica oculto.
 */
export const SECTIONS = [
  { id: 'charges', label: 'Cobranças', icon: Receipt },
  { id: 'expenses', label: 'Despesas', icon: Wallet },
  { id: 'categories', label: 'Plano de contas', icon: BookOpen },
  { id: 'closing', label: 'Balancete', icon: Scale },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

/** Dito quando a cobranca ou despesa nao esta classificada. */
export const NO_CATEGORY = 'Sem categoria';

/** Dito quando a despesa nao tem prestador vinculado. */
export const NO_PROVIDER = 'Sem prestador';

/** Dito quando a categoria referida nao esta na colecao carregada. */
export const CATEGORY_UNAVAILABLE = 'Categoria indisponível';

/** Dito quando a unidade referida nao veio aninhada na resposta. */
export const UNIT_UNAVAILABLE = 'Unidade indisponível';

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

/**
 * De onde veio o saldo que abre o mes.
 *
 * O numero sozinho nao e conferivel: quem le uma prestacao de contas precisa
 * saber se ele foi herdado do mes anterior ou calculado desde a data de corte, e
 * essa e a primeira pergunta de quem confere.
 */
export function openingBalanceProvenance(openingBalance: {
  source: OpeningBalanceSource;
  from: string | null;
}): string {
  if (openingBalance.source === 'INHERITED' && openingBalance.from) {
    return `Herdado do fechamento de ${formatReferenceMonth(openingBalance.from)}`;
  }
  if (openingBalance.from) {
    return `Calculado a partir do saldo de abertura de ${formatDate(openingBalance.from)}`;
  }
  return 'Calculado a partir do saldo de abertura do condomínio';
}
