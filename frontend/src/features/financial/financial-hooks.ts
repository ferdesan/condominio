/**
 * Camada de dados do modulo financeiro: a fabrica do ADR-008 para os tres
 * recursos CRUD — categorias, cobrancas e despesas —, mais as leituras
 * agregadas e as acoes proprias, escritas como hooks comuns porque a fabrica so
 * expoe as seis operacoes do roteador compartilhado.
 *
 * Os tres recursos vivem sob `/financial`, mas sao **recursos distintos** com
 * chaves separadas: liquidar uma despesa nao muda nenhuma cobranca, e recarregar
 * as duas a cada acao seria desperdicio. O resumo e a inadimplencia ficam sob a
 * chave de cobrancas, porque e delas que derivam — e assim a baixa de um
 * pagamento ja os atualiza sem codigo extra.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiGetPaginated, apiPost, type ApiError, type Paginated } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { ServiceProvider, Unit } from '@/types/api';
import type {
  ApplyLateFeesResult,
  Charge,
  ChargeSummary,
  DelinquencyRow,
  Expense,
  FinancialCategory,
  GenerateChargesResult,
  MonthlyStatement,
  Payment,
  RegisterPaymentResult,
} from '@/types/financial';
import type {
  CategoryPayload,
  ChargePayload,
  ExpensePayload,
  GeneratePayload,
  PaymentPayload,
  PayExpensePayload,
} from './financial-schema';

export const CHARGES_KEY = 'financial/charges';
export const EXPENSES_KEY = 'financial/expenses';
export const CATEGORIES_KEY = 'financial/categories';

/**
 * Whitelists de filtros dos tres repositorios.
 *
 * Moram aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque
 * aquele modulo e compartilhado. A regra que elas servem e a mesma: o backend
 * descarta em silencio o que estiver fora da lista, entao um controle a mais
 * pareceria funcionar sem filtrar nada.
 */
export const chargeFilters = [
  'condominiumId',
  'unitId',
  'residentId',
  'categoryId',
  'status',
  'referenceMonth',
] as const;

export const expenseFilters = [
  'condominiumId',
  'categoryId',
  'serviceProviderId',
  'status',
  'competence',
] as const;

export const categoryFilters = ['condominiumId', 'kind', 'active'] as const;

/**
 * O backend aceita ordenar por filtravel + buscavel + os dois timestamps.
 *
 * Note a ausencia de `dueDate` nas duas primeiras: e o `defaultSort` de ambas e
 * **nao** entra no conjunto ordenavel — uma coluna ordenavel por ele seria
 * descartada em silencio e o servidor cairia para a ordem padrao. `amount`
 * tambem fica de fora, pelo mesmo motivo.
 */
export const chargeSortable = [
  ...chargeFilters,
  'description',
  'barcode',
  'createdAt',
  'updatedAt',
] as const;

export const expenseSortable = [
  ...expenseFilters,
  'description',
  'documentNumber',
  'createdAt',
  'updatedAt',
] as const;

export const categorySortable = [
  ...categoryFilters,
  'name',
  'code',
  'description',
  'createdAt',
  'updatedAt',
] as const;

export const chargeHooks = createResourceHooks<Charge, ChargePayload, Partial<ChargePayload>>(
  CHARGES_KEY,
);

export const expenseHooks = createResourceHooks<Expense, ExpensePayload, Partial<ExpensePayload>>(
  EXPENSES_KEY,
);

export const categoryHooks = createResourceHooks<
  FinancialCategory,
  CategoryPayload,
  Partial<CategoryPayload>
>(CATEGORIES_KEY);

/**
 * O resumo do mes, de `GET /financial/charges/summary`.
 *
 * Os numeros vem agregados do banco, e nao de uma conta sobre as linhas
 * carregadas: a lista mostra uma pagina de vinte e um recorte de filtros, entao
 * soma-la responderia outra pergunta. A competencia e opcional — sem ela, o
 * resumo cobre todas.
 */
export function useChargeSummary(
  condominiumId: string | null,
  referenceMonth?: string,
): UseQueryResult<ChargeSummary, ApiError> {
  return useQuery<ChargeSummary, ApiError>({
    queryKey: [CHARGES_KEY, 'summary', condominiumId, referenceMonth ?? null],
    queryFn: () =>
      apiGet<ChargeSummary>('/financial/charges/summary', {
        params: {
          condominiumId: condominiumId ?? '',
          ...(referenceMonth ? { referenceMonth } : {}),
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

/**
 * A inadimplencia por unidade, de `GET /financial/charges/delinquency`.
 *
 * Array cru, ja ordenado pelo maior saldo e limitado a dez pelo servidor — o
 * recorte e dele e nao se refaz no cliente.
 */
export function useDelinquency(
  condominiumId: string | null,
): UseQueryResult<DelinquencyRow[], ApiError> {
  return useQuery<DelinquencyRow[], ApiError>({
    queryKey: [CHARGES_KEY, 'delinquency', condominiumId],
    queryFn: () =>
      apiGet<DelinquencyRow[]>('/financial/charges/delinquency', {
        params: { condominiumId: condominiumId ?? '' },
      }),
    enabled: Boolean(condominiumId),
  });
}

/**
 * Os pagamentos de **uma** cobranca, de `GET /financial/payments`.
 *
 * **Somente leitura, e so aqui.** A rota nao tem criacao, edicao nem exclusao: a
 * baixa acontece por `POST /financial/charges/:id/payments`, que ja tem tela
 * (`RegisterPaymentDialog`). O que faltava era **ver** o que foi baixado — uma
 * cobranca aceita pagamentos parciais, entao "quanto ja entrou" pode ser a soma
 * de varios lancamentos que a listagem de cobrancas nao mostra.
 *
 * `chargeId` esta na whitelist de filtros de `PaymentRepository`; a ordenacao
 * padrao dele e `paidAt DESC`, do mais recente para o mais antigo. **Nao se pede
 * ordenacao**: `paidAt` nao esta no conjunto ordenavel do servidor — ele soma
 * filtraveis, buscaveis e os dois timestamps — e a chave seria descartada em
 * silencio.
 *
 * Fica fora da fabrica de proposito (ADR-008): a fabrica monta seis operacoes
 * sobre um recurso, e aqui ha exatamente uma leitura. `MAX_PER_PAGE` porque o
 * que se quer e o historico inteiro da cobranca, e nao uma pagina dele.
 */
export function useChargePayments(
  chargeId: string | null,
): UseQueryResult<Paginated<Payment>, ApiError> {
  return useQuery<Paginated<Payment>, ApiError>({
    queryKey: [CHARGES_KEY, 'payments', chargeId],
    queryFn: () =>
      apiGetPaginated<Payment>('/financial/payments', {
        params: { chargeId: chargeId ?? '', perPage: MAX_PER_PAGE },
      }),
    enabled: Boolean(chargeId),
  });
}

/**
 * Unidades do condominio, para o seletor do formulario e para o filtro.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer e a colecao inteira
 * de uma vez, ordenada por numero, e nao uma pagina navegavel.
 */
export function useUnitOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<Unit>, ApiError> {
  return useQuery<Paginated<Unit>, ApiError>({
    queryKey: ['units', 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<Unit>('/units', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          sortBy: 'number',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

/** Prestadores do condominio, pelo mesmo motivo e com a mesma forma. */
export function useProviderOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<ServiceProvider>, ApiError> {
  return useQuery<Paginated<ServiceProvider>, ApiError>({
    queryKey: ['service-providers', 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<ServiceProvider>('/service-providers', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          sortBy: 'companyName',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

/**
 * O plano de contas inteiro, para os seletores das duas outras secoes.
 *
 * Chave propria (`options`), e nao a da listagem: a secao de categorias pagina e
 * filtra, e este seletor quer tudo. Ambas comecam com o mesmo recurso, entao uma
 * mutacao de categoria invalida as duas de uma vez.
 */
export function useCategoryOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<FinancialCategory>, ApiError> {
  return useQuery<Paginated<FinancialCategory>, ApiError>({
    queryKey: [CATEGORIES_KEY, 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<FinancialCategory>('/financial/categories', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          sortBy: 'name',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

export type MutationCallbacks<TData, TVariables> = {
  onError?: (error: ApiError, variables: TVariables) => void;
  onSuccess?: (data: TData, variables: TVariables) => void;
};

/** Cobrancas e o resumo compartilham a raiz da chave, entao uma invalidacao basta. */
function useInvalidateCharges(): () => void {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [CHARGES_KEY] });
}

/**
 * Geracao em lote das taxas do mes. Exige `charge:create`.
 *
 * Devolve quantas foram criadas e quantas foram puladas — uma unidade que ja
 * tinha cobranca naquela competencia nao ganha outra —, e e esse numero que a
 * tela precisa mostrar: "gerou" sem quantidade nao diz se funcionou.
 */
export function useGenerateCharges(
  callbacks: MutationCallbacks<GenerateChargesResult, GeneratePayload> = {},
): UseMutationResult<GenerateChargesResult, ApiError, GeneratePayload> {
  const invalidate = useInvalidateCharges();

  return useMutation<GenerateChargesResult, ApiError, GeneratePayload>({
    mutationFn: (data) => apiPost<GenerateChargesResult>('/financial/charges/generate', data),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

export type RegisterPaymentVariables = { id: string; data: PaymentPayload };

/**
 * Baixa de pagamento. Exige **`payment:create`**, e nao `charge:update`: quem
 * corrige a descricao de uma cobranca nao necessariamente da baixa nela.
 */
export function useRegisterPayment(
  callbacks: MutationCallbacks<RegisterPaymentResult, RegisterPaymentVariables> = {},
): UseMutationResult<RegisterPaymentResult, ApiError, RegisterPaymentVariables> {
  const invalidate = useInvalidateCharges();

  return useMutation<RegisterPaymentResult, ApiError, RegisterPaymentVariables>({
    mutationFn: ({ id, data }) =>
      apiPost<RegisterPaymentResult>(`/financial/charges/${id}/payments`, data),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

export type CancelChargeVariables = { id: string; reason?: string };

/** Cancelamento da cobranca. Exige `charge:update`. */
export function useCancelCharge(
  callbacks: MutationCallbacks<Charge, CancelChargeVariables> = {},
): UseMutationResult<Charge, ApiError, CancelChargeVariables> {
  const invalidate = useInvalidateCharges();

  return useMutation<Charge, ApiError, CancelChargeVariables>({
    mutationFn: ({ id, reason }) =>
      apiPost<Charge>(`/financial/charges/${id}/cancel`, reason ? { reason } : {}),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/**
 * Multa e juros sobre o que esta vencido. Exige **`charge:manage`**.
 *
 * O job diario ja faz isso; a acao sob demanda existe para quando alguem precisa
 * do numero atualizado antes do horario. Os percentuais sao do tenant, e nao
 * desta tela — por isso nao ha campo nenhum a preencher.
 */
export function useApplyLateFees(
  callbacks: MutationCallbacks<ApplyLateFeesResult, { condominiumId: string }> = {},
): UseMutationResult<ApplyLateFeesResult, ApiError, { condominiumId: string }> {
  const invalidate = useInvalidateCharges();

  return useMutation<ApplyLateFeesResult, ApiError, { condominiumId: string }>({
    mutationFn: (data) => apiPost<ApplyLateFeesResult>('/financial/charges/apply-late-fees', data),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

export type PayExpenseVariables = { id: string; data: PayExpensePayload };

/** Liquidacao da despesa. Exige `expense:update`. */
export function usePayExpense(
  callbacks: MutationCallbacks<Expense, PayExpenseVariables> = {},
): UseMutationResult<Expense, ApiError, PayExpenseVariables> {
  const queryClient = useQueryClient();

  return useMutation<Expense, ApiError, PayExpenseVariables>({
    mutationFn: ({ id, data }) => apiPost<Expense>(`/financial/expenses/${id}/pay`, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

// ---------------------------------------------------------------------------
// Balancete mensal
// ---------------------------------------------------------------------------

export const CLOSINGS_KEY = 'financial/closings';

export type ClosingVariables = { condominiumId: string; referenceMonth: string };

/**
 * O balancete de um mes. Fica fora da fabrica do ADR-008 pelo mesmo motivo de
 * `useChargePayments`: ha uma leitura e duas acoes, e a fabrica monta as seis
 * operacoes de um roteador CRUD sobre um recurso.
 *
 * **E chamado dentro da secao, e nunca no nivel da pagina.** A secao so monta
 * quando escolhida, e e isso que mantem o boot de `/financeiro` sem esta
 * requisicao — o que `IT-315` afirma.
 */
export function useClosing(
  condominiumId: string | null,
  referenceMonth: string,
): UseQueryResult<MonthlyStatement, ApiError> {
  return useQuery<MonthlyStatement, ApiError>({
    queryKey: [CLOSINGS_KEY, 'detail', condominiumId, referenceMonth],
    queryFn: () =>
      apiGet<MonthlyStatement>(`/financial/closings/${referenceMonth}`, {
        params: { condominiumId: condominiumId ?? '' },
      }),
    enabled: Boolean(condominiumId) && Boolean(referenceMonth),
  });
}

/**
 * Fecha o mes. Exige **`financial-closing:create`**.
 *
 * Invalida tambem a raiz de cobrancas e despesas: depois do fechamento, toda
 * escrita que moveria o caixa daquele mes passa a ser recusada, e as telas
 * precisam refletir o estado novo.
 */
export function useCloseMonth(
  callbacks: MutationCallbacks<MonthlyStatement, ClosingVariables> = {},
): UseMutationResult<MonthlyStatement, ApiError, ClosingVariables> {
  const queryClient = useQueryClient();

  return useMutation<MonthlyStatement, ApiError, ClosingVariables>({
    mutationFn: ({ condominiumId, referenceMonth }) =>
      apiPost<MonthlyStatement>(`/financial/closings/${referenceMonth}/close`, { condominiumId }),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [CLOSINGS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/**
 * Reabre o mes. Exige **`financial-closing:manage`**, estritamente mais forte do
 * que a permissao de fechar: fechar e rotina mensal, desfazer uma prestacao de
 * contas publicada nao e.
 */
export function useReopenMonth(
  callbacks: MutationCallbacks<MonthlyStatement, ClosingVariables> = {},
): UseMutationResult<MonthlyStatement, ApiError, ClosingVariables> {
  const queryClient = useQueryClient();

  return useMutation<MonthlyStatement, ApiError, ClosingVariables>({
    mutationFn: ({ condominiumId, referenceMonth }) =>
      apiPost<MonthlyStatement>(`/financial/closings/${referenceMonth}/reopen`, { condominiumId }),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [CLOSINGS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
