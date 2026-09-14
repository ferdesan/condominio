/**
 * Camada de dados da tela de correspondencias: a fabrica do ADR-008 para a
 * superficie CRUD uniforme, mais os dois endpoints proprios do recurso — a
 * contagem de pendentes e a baixa de entrega — escritos como hooks comuns,
 * porque a fabrica so expoe as seis operacoes do roteador compartilhado.
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
import type { Resident, Unit } from '@/types/api';
import type { Correspondence, CorrespondencePendingCount } from '@/types/correspondence';
import type { CorrespondencePayload, DeliverPayload } from './correspondence-schema';

export const CORRESPONDENCES_KEY = 'correspondences';

/**
 * Whitelist de filtros do `CorrespondenceRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 */
export const correspondenceFilters = [
  'condominiumId',
  'unitId',
  'residentId',
  'status',
  'type',
] as const;

export const correspondenceHooks = createResourceHooks<
  Correspondence,
  CorrespondencePayload,
  Partial<CorrespondencePayload>
>(CORRESPONDENCES_KEY);

/**
 * Unidades do condominio selecionado, para o seletor do formulario e para o
 * filtro da listagem.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer aqui e a colecao
 * inteira de uma vez, ordenada por numero, e nao uma pagina navegavel.
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

/**
 * Moradores do condominio selecionado, pelo mesmo motivo e com a mesma forma.
 *
 * O destinatario nominal e independente da unidade: o servidor nao exige que um
 * implique o outro, entao o seletor oferece todos os moradores do condominio.
 */
export function useResidentOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<Resident>, ApiError> {
  return useQuery<Paginated<Resident>, ApiError>({
    queryKey: ['residents', 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<Resident>('/residents', {
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

/**
 * Quantas correspondencias aguardam retirada.
 *
 * Vem de `/correspondences/pending-count`, e nao de `meta.total` de uma
 * listagem filtrada: e um endpoint dedicado, mais barato, e o corpo dele e um
 * objeto — `{ pending }` — e nao um numero solto. A chave comeca com o recurso,
 * entao a invalidacao das mutacoes e da baixa ja a alcanca.
 */
export function usePendingCount(
  condominiumId: string | null,
  options: { enabled?: boolean } = {},
): UseQueryResult<number, ApiError> {
  return useQuery<number, ApiError>({
    queryKey: [CORRESPONDENCES_KEY, 'pending-count', condominiumId],
    queryFn: async () => {
      const result = await apiGet<CorrespondencePendingCount>('/correspondences/pending-count', {
        params: { condominiumId: condominiumId ?? '' },
      });
      return result.pending;
    },
    enabled: (options.enabled ?? true) && Boolean(condominiumId),
  });
}

export type DeliverVariables = {
  id: string;
  data: DeliverPayload;
};

export type DeliverCallbacks = {
  onError?: (error: ApiError, variables: DeliverVariables) => void;
  onSuccess?: (data: Correspondence, variables: DeliverVariables) => void;
};

/**
 * Baixa de entrega. Exige `correspondence:update`.
 *
 * Invalida o recurso inteiro, entao a listagem e a contagem de pendentes saem
 * juntas do ar e voltam coerentes.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5,
 * e o toast sumiria sem nada no lugar.
 */
export function useDeliverCorrespondence(
  callbacks: DeliverCallbacks = {},
): UseMutationResult<Correspondence, ApiError, DeliverVariables> {
  const queryClient = useQueryClient();

  return useMutation<Correspondence, ApiError, DeliverVariables>({
    mutationFn: ({ id, data }) =>
      apiPost<Correspondence>(`/correspondences/${id}/deliver`, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [CORRESPONDENCES_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
