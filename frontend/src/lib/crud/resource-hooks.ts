/**
 * Fabrica de hooks para os recursos servidos pelo roteador CRUD compartilhado
 * (ADR-008). Ela e dona da composicao das query keys, da montagem dos
 * parametros e da invalidacao — e de nada mais. Endpoints especificos de um
 * recurso (geracao em lote, disponibilidade, aprovacao) sao escritos como
 * hooks comuns ao lado da feature que os usa.
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  apiDelete,
  apiGet,
  apiGetPaginated,
  apiPatch,
  apiPost,
  type ApiError,
  type Paginated,
} from '@/lib/api';
import { toQueryParams, type Filters, type ListParams } from './query-params';

export type { ListParams } from './query-params';

/**
 * Callbacks por instancia de mutacao.
 *
 * `onError` existe para os formularios. No React Query v5 quem define `onError`
 * no proprio `useMutation` **substitui** o handler global — que levanta um toast
 * —, enquanto um callback passado ao `mutate` apenas soma a ele. Sem este ponto
 * de entrada um erro de formulario apareceria duas vezes: inline e em toast.
 *
 * Acoes de linha continuam omitindo `onError` e herdando o toast, que e a
 * apresentacao certa para um 409 que traz so uma mensagem.
 */
export type MutationCallbacks<TData, TVariables> = {
  onError?: (error: ApiError, variables: TVariables) => void;
  onSuccess?: (data: TData, variables: TVariables) => void;
};

export type ResourceHooks<T, TCreate, TUpdate> = {
  useList: (
    params: ListParams,
    options?: { enabled?: boolean },
  ) => UseQueryResult<Paginated<T>, ApiError>;
  useOne: (id: string | null) => UseQueryResult<T, ApiError>;
  useCreate: (
    callbacks?: MutationCallbacks<T, TCreate>,
  ) => UseMutationResult<T, ApiError, TCreate>;
  useUpdate: (
    callbacks?: MutationCallbacks<T, { id: string; data: TUpdate }>,
  ) => UseMutationResult<T, ApiError, { id: string; data: TUpdate }>;
  useRemove: (
    callbacks?: MutationCallbacks<void, string>,
  ) => UseMutationResult<void, ApiError, string>;
  useRestore: (
    callbacks?: MutationCallbacks<T, string>,
  ) => UseMutationResult<T, ApiError, string>;
  /**
   * Indicadores numericos: nao existe endpoint de agregacao, entao pedimos uma
   * pagina de um registro e lemos `meta.total`.
   */
  useCount: (
    filters?: Filters,
    options?: { enabled?: boolean },
  ) => UseQueryResult<number, ApiError>;
};

export type ResourceHooksOptions = {
  /**
   * Chaves adicionais a invalidar apos cada mutacao. Existe para o seletor do
   * shell (`['condominiums', 'options']`), que le a mesma colecao da listagem.
   */
  extraInvalidate?: readonly (readonly unknown[])[];
};

export function createResourceHooks<T, TCreate, TUpdate>(
  resource: string,
  options: ResourceHooksOptions = {},
): ResourceHooks<T, TCreate, TUpdate> {
  const basePath = `/${resource}`;
  const { extraInvalidate = [] } = options;

  /** Mutacoes invalidam `[resource]`, que cobre tanto a lista quanto o detalhe. */
  function useInvalidate(): () => void {
    const queryClient = useQueryClient();
    return () => {
      queryClient.invalidateQueries({ queryKey: [resource] });
      for (const queryKey of extraInvalidate) {
        queryClient.invalidateQueries({ queryKey });
      }
    };
  }

  /**
   * Monta as opcoes da mutacao preservando a invalidacao.
   *
   * `onError` so entra no objeto quando existe: escrever `onError: undefined`
   * tambem sobrescreveria o handler global, porque o merge com os defaults e por
   * chave presente, nao por valor definido — e o toast sumiria sem substituto.
   */
  function withCallbacks<TData, TVariables>(
    invalidate: () => void,
    callbacks: MutationCallbacks<TData, TVariables>,
  ) {
    return {
      onSuccess: (data: TData, variables: TVariables) => {
        invalidate();
        callbacks.onSuccess?.(data, variables);
      },
      ...(callbacks.onError ? { onError: callbacks.onError } : {}),
    };
  }

  return {
    useList(params, listOptions) {
      return useQuery<Paginated<T>, ApiError>({
        queryKey: [resource, 'list', params],
        queryFn: () => apiGetPaginated<T>(basePath, { params: toQueryParams(params) }),
        enabled: listOptions?.enabled ?? true,
        // Trocar pagina, filtro ou busca cria uma query key nova. Sem os dados
        // anteriores no lugar, a tabela esvazia e a paginacao some a cada tecla
        // digitada — a tela precisa segurar a posicao enquanto o proximo
        // resultado nao chega.
        placeholderData: keepPreviousData,
      });
    },

    useOne(id) {
      return useQuery<T, ApiError>({
        queryKey: [resource, 'detail', id],
        queryFn: () => apiGet<T>(`${basePath}/${id}`),
        enabled: id !== null && id !== undefined && id !== '',
      });
    },

    useCreate(callbacks = {}) {
      const invalidate = useInvalidate();
      return useMutation<T, ApiError, TCreate>({
        mutationFn: (data) => apiPost<T>(basePath, data),
        ...withCallbacks(invalidate, callbacks),
      });
    },

    useUpdate(callbacks = {}) {
      const invalidate = useInvalidate();
      return useMutation<T, ApiError, { id: string; data: TUpdate }>({
        // O id vai na URL: `apiPatch` nao aceita configuracao de request.
        mutationFn: ({ id, data }) => apiPatch<T>(`${basePath}/${id}`, data),
        ...withCallbacks(invalidate, callbacks),
      });
    },

    useRemove(callbacks = {}) {
      const invalidate = useInvalidate();
      return useMutation<void, ApiError, string>({
        mutationFn: (id) => apiDelete(`${basePath}/${id}`),
        ...withCallbacks(invalidate, callbacks),
      });
    },

    useRestore(callbacks = {}) {
      const invalidate = useInvalidate();
      return useMutation<T, ApiError, string>({
        mutationFn: (id) => apiPost<T>(`${basePath}/${id}/restore`),
        ...withCallbacks(invalidate, callbacks),
      });
    },

    useCount(filters = {}, countOptions) {
      return useQuery<number, ApiError>({
        queryKey: [resource, 'count', filters],
        queryFn: async () => {
          const page = await apiGetPaginated<T>(basePath, {
            params: toQueryParams({ page: 1, perPage: 1, filters }),
          });
          return page.meta.total;
        },
        enabled: countOptions?.enabled ?? true,
      });
    },
  };
}
