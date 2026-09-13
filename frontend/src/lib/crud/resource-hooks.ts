/**
 * Fabrica de hooks para os recursos servidos pelo roteador CRUD compartilhado
 * (ADR-008). Ela e dona da composicao das query keys, da montagem dos
 * parametros e da invalidacao — e de nada mais. Endpoints especificos de um
 * recurso (geracao em lote, disponibilidade, aprovacao) sao escritos como
 * hooks comuns ao lado da feature que os usa.
 */

import {
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

export type ResourceHooks<T, TCreate, TUpdate> = {
  useList: (
    params: ListParams,
    options?: { enabled?: boolean },
  ) => UseQueryResult<Paginated<T>, ApiError>;
  useOne: (id: string | null) => UseQueryResult<T, ApiError>;
  useCreate: () => UseMutationResult<T, ApiError, TCreate>;
  useUpdate: () => UseMutationResult<T, ApiError, { id: string; data: TUpdate }>;
  useRemove: () => UseMutationResult<void, ApiError, string>;
  useRestore: () => UseMutationResult<T, ApiError, string>;
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
  extraInvalidate?: readonly unknown[][];
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

  return {
    useList(params, listOptions) {
      return useQuery<Paginated<T>, ApiError>({
        queryKey: [resource, 'list', params],
        queryFn: () => apiGetPaginated<T>(basePath, { params: toQueryParams(params) }),
        enabled: listOptions?.enabled ?? true,
      });
    },

    useOne(id) {
      return useQuery<T, ApiError>({
        queryKey: [resource, 'detail', id],
        queryFn: () => apiGet<T>(`${basePath}/${id}`),
        enabled: id !== null && id !== undefined && id !== '',
      });
    },

    useCreate() {
      const invalidate = useInvalidate();
      return useMutation<T, ApiError, TCreate>({
        mutationFn: (data) => apiPost<T>(basePath, data),
        onSuccess: invalidate,
      });
    },

    useUpdate() {
      const invalidate = useInvalidate();
      return useMutation<T, ApiError, { id: string; data: TUpdate }>({
        // O id vai na URL: `apiPatch` nao aceita configuracao de request.
        mutationFn: ({ id, data }) => apiPatch<T>(`${basePath}/${id}`, data),
        onSuccess: invalidate,
      });
    },

    useRemove() {
      const invalidate = useInvalidate();
      return useMutation<void, ApiError, string>({
        mutationFn: (id) => apiDelete(`${basePath}/${id}`),
        onSuccess: invalidate,
      });
    },

    useRestore() {
      const invalidate = useInvalidate();
      return useMutation<T, ApiError, string>({
        mutationFn: (id) => apiPost<T>(`${basePath}/${id}/restore`),
        onSuccess: invalidate,
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
