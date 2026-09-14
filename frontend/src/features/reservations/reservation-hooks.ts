/**
 * Camada de dados da tela de reservas: a fabrica do ADR-008 para a superficie
 * CRUD uniforme, mais os quatro endpoints proprios do recurso — disponibilidade,
 * aprovacao, recusa e cancelamento — escritos como hooks comuns, porque a
 * fabrica so expoe as seis operacoes do roteador compartilhado.
 *
 * As areas comuns entram aqui tambem: sao somente leitura nesta entrega e
 * existem para alimentar o seletor e os parametros das regras do formulario.
 */

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiGetPaginated, apiPost, type ApiError } from '@/lib/api';
import { createResourceHooks, toQueryParams, type Filters } from '@/lib/crud';
import type { AvailabilityEntry, CommonArea, Reservation, Unit } from '@/types/api';
import type { ReservationPayload } from './reservation-rules';

export const RESERVATIONS_KEY = 'reservations';

export const reservationHooks = createResourceHooks<
  Reservation,
  ReservationPayload,
  Partial<ReservationPayload>
>(RESERVATIONS_KEY);

/**
 * Areas comuns: leitura apenas. O formulario le daqui os oito parametros das
 * regras locais (ADR-011), entao o registro inteiro importa, nao so o nome.
 */
export const commonAreaHooks = createResourceHooks<CommonArea, never, never>('common-areas');

/**
 * Unidades: leitura apenas, para o seletor do formulario e o filtro da lista.
 * A tela propria das unidades e outra entrega; aqui basta a colecao.
 */
export const unitHooks = createResourceHooks<Unit, never, never>('units');

export type AvailabilityParams = {
  condominiumId: string;
  from: Date;
  to: Date;
  commonAreaId?: string;
};

/**
 * Agenda do mes para o calendario.
 *
 * O endpoint devolve uma projecao achatada — e nao a entidade — com os nomes da
 * area e da unidade ja resolvidos, e apenas reservas pendentes e confirmadas.
 * A listagem continua sendo a visao exaustiva.
 *
 * A query key carrega o intervalo. E isso que protege contra a resposta de um
 * mes anterior chegando depois da de um mes posterior: cada mes tem a propria
 * entrada no cache, entao uma resposta atrasada preenche a dela e nunca
 * sobrescreve a do mes que esta na tela.
 */
export function useAvailability(
  params: AvailabilityParams | null,
  options: { enabled?: boolean } = {},
): UseQueryResult<AvailabilityEntry[], ApiError> {
  const from = params?.from.toISOString();
  const to = params?.to.toISOString();

  return useQuery<AvailabilityEntry[], ApiError>({
    queryKey: [RESERVATIONS_KEY, 'availability', params?.condominiumId, from, to, params?.commonAreaId ?? null],
    queryFn: () =>
      apiGet<AvailabilityEntry[]>('/reservations/availability', {
        params: {
          condominiumId: params?.condominiumId,
          from,
          to,
          ...(params?.commonAreaId ? { commonAreaId: params.commonAreaId } : {}),
        },
      }),
    enabled: (options.enabled ?? true) && params !== null,
  });
}

export type DecisionVariables = {
  id: string;
  reason?: string | null;
};

export type DecisionCallbacks = {
  onError?: (error: ApiError, variables: DecisionVariables) => void;
  onSuccess?: (data: Reservation, variables: DecisionVariables) => void;
};

/**
 * Base das tres decisoes. Todas postam o mesmo corpo opcional e invalidam o
 * recurso inteiro — listagem, contadores e calendario saem juntos do ar.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5,
 * e o toast — que e a apresentacao certa para um 409 que traz so a mensagem —
 * sumiria sem nada no lugar.
 */
function useDecision(
  action: 'approve' | 'reject' | 'cancel',
  callbacks: DecisionCallbacks = {},
): UseMutationResult<Reservation, ApiError, DecisionVariables> {
  const queryClient = useQueryClient();

  return useMutation<Reservation, ApiError, DecisionVariables>({
    mutationFn: ({ id, reason }) =>
      apiPost<Reservation>(`/reservations/${id}/${action}`, { reason: reason ?? null }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [RESERVATIONS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/** Aprovar exige `reservation:manage`. Revalida o horario e pode recusar. */
export function useApproveReservation(callbacks?: DecisionCallbacks) {
  return useDecision('approve', callbacks);
}

/** Recusar exige `reservation:manage`. */
export function useRejectReservation(callbacks?: DecisionCallbacks) {
  return useDecision('reject', callbacks);
}

/** Cancelar exige apenas `reservation:update`: um operador cancela, mas nao decide. */
export function useCancelReservation(callbacks?: DecisionCallbacks) {
  return useDecision('cancel', callbacks);
}

/**
 * Contagem de reservas por filtro.
 *
 * Nao existe endpoint de agregacao, entao pedimos uma pagina de um registro e
 * lemos `meta.total` — o mesmo caminho que `useCount` da fabrica, repetido aqui
 * so porque o detalhamento por area precisa disparar N consultas de uma vez, o
 * que exige `useQueries` em vez de um hook por chamada. A forma da chave e a
 * mesma, entao a invalidacao do recurso alcanca as duas.
 *
 * Os indicadores enviam tambem o intervalo do mes. Atencao: hoje o repositorio
 * de reservas nao tem filtro por data — `from` e `to` nao estao na whitelist e
 * o backend os descarta em silencio, entao os numeros saem no escopo do
 * condominio inteiro ate que exista um filtro de periodo no servidor. O
 * intervalo e enviado porque e o contrato desta tela; a lacuna esta registrada
 * como trabalho futuro.
 */
export function reservationCountQueryOptions(filters: Filters) {
  return {
    queryKey: [RESERVATIONS_KEY, 'count', filters] as const,
    queryFn: async (): Promise<number> => {
      const page = await apiGetPaginated<Reservation>('/reservations', {
        params: toQueryParams({ page: 1, perPage: 1, filters }),
      });
      return page.meta.total;
    },
  };
}

export function useReservationCount(
  filters: Filters,
  options: { enabled?: boolean } = {},
): UseQueryResult<number, ApiError> {
  return useQuery<number, ApiError>({
    ...reservationCountQueryOptions(filters),
    enabled: options.enabled ?? true,
  });
}

/** Varias contagens de uma vez, para o detalhamento por area comum. */
export function useReservationCounts(
  filterSets: Filters[],
  options: { enabled?: boolean } = {},
): UseQueryResult<number, ApiError>[] {
  return useQueries({
    queries: filterSets.map((filters) => ({
      ...reservationCountQueryOptions(filters),
      enabled: options.enabled ?? true,
    })),
  }) as UseQueryResult<number, ApiError>[];
}

/** Intervalo do mes no formato que os filtros de contagem transportam. */
export function monthFilters(from: Date, to: Date): Filters {
  return { from: from.toISOString(), to: to.toISOString() };
}
