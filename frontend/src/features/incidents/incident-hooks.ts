/**
 * Camada de dados da tela de ocorrencias: a fabrica do ADR-008 para a superficie
 * CRUD uniforme, mais os tres endpoints proprios do recurso — o resumo por
 * status, a mudanca de status e a atribuicao — escritos como hooks comuns,
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
import type {
  Incident,
  IncidentAssignee,
  IncidentSummaryEntry,
  IncidentStatus,
} from '@/types/incident';
import type { AssignPayload, ChangeStatusPayload, IncidentPayload } from './incident-schema';

export const INCIDENTS_KEY = 'incidents';

/**
 * Whitelist de filtros do `IncidentRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 */
export const incidentFilters = [
  'condominiumId',
  'unitId',
  'status',
  'category',
  'priority',
  'assignedToId',
  'reportedById',
] as const;

export const incidentHooks = createResourceHooks<
  Incident,
  IncidentPayload,
  Partial<IncidentPayload>
>(INCIDENTS_KEY);

/**
 * Recorte por condominio dos usuarios elegiveis como responsaveis.
 *
 * `/users` e por tenant: nem o repositorio o escopa por condominio, nem
 * `condominiumId` esta entre os filtros que ele aceita — mandar a chave nao
 * faria nada, e o seletor pareceria escopado sem estar. O vinculo vem embutido
 * na resposta, e o recorte acontece aqui.
 *
 * Lista de condominios vazia significa "todos do tenant", que e como perfis
 * administrativos sao cadastrados. E a mesma leitura que o servidor faz em
 * `recipientsService.usersOfCondominium`, onde o vinculo ausente entra no
 * resultado.
 */
export function scopeAssignees(
  users: readonly IncidentAssignee[],
  condominiumId: string | null,
): IncidentAssignee[] {
  if (!condominiumId) return [];
  return users.filter((user) => {
    const scope = user.condominiums ?? [];
    return scope.length === 0 || scope.some((item) => item.id === condominiumId);
  });
}

/**
 * Usuarios ativos do tenant, para o seletor de responsavel e para o filtro.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer aqui e a colecao
 * inteira de uma vez, ordenada por nome, e nao uma pagina navegavel.
 *
 * A chave nao carrega o condominio porque a resposta nao depende dele — o
 * endpoint e por tenant. Inclui-la faria a mesma colecao ser buscada de novo a
 * cada troca no shell, e prometeria uma variacao que nao existe. Quem recorta e
 * `scopeAssignees`, sobre o resultado.
 */
export function useAssigneeOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<IncidentAssignee>, ApiError> {
  return useQuery<Paginated<IncidentAssignee>, ApiError>({
    queryKey: ['users', 'options'],
    queryFn: () =>
      apiGetPaginated<IncidentAssignee>('/users', {
        params: {
          perPage: MAX_PER_PAGE,
          // Escopar por condominio e do cliente; o que o servidor aceita filtrar
          // aqui e o status, e atribuir a quem esta bloqueado nao serve a nada.
          status: 'ACTIVE',
          sortBy: 'name',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

/**
 * Resumo por status, de `GET /incidents/summary`.
 *
 * A forma e propria: `incidentService.statusSummary` devolve um array de
 * `{ status, total }`, e nao um objeto de contadores nomeados — e um status sem
 * ocorrencias fica de fora em vez de vir zerado. A chave comeca com o recurso,
 * entao a invalidacao das mutacoes e das acoes de fluxo ja a alcanca.
 *
 * A consulta e separada da listagem para que uma falha aqui nao leve a tela
 * junto: a lista continua utilizavel com os indicadores em erro.
 */
export function useIncidentSummary(
  condominiumId: string | null,
): UseQueryResult<IncidentSummaryEntry[], ApiError> {
  return useQuery<IncidentSummaryEntry[], ApiError>({
    queryKey: [INCIDENTS_KEY, 'summary', condominiumId],
    queryFn: () =>
      apiGet<IncidentSummaryEntry[]>('/incidents/summary', {
        // O servidor valida a query e exige o condominio: e um uuid obrigatorio.
        params: { condominiumId: condominiumId ?? '' },
      }),
    enabled: Boolean(condominiumId),
  });
}

export type ChangeStatusVariables = { id: string; data: ChangeStatusPayload };
export type AssignVariables = { id: string; data: AssignPayload };

export type FlowCallbacks<TVariables> = {
  onError?: (error: ApiError, variables: TVariables) => void;
  onSuccess?: (data: Incident, variables: TVariables) => void;
};

/**
 * Mudanca de status. Exige `incident:update`.
 *
 * As transicoes validas sao do servidor (`STATUS_FLOW`) e nao sao duplicadas
 * aqui: a recusa dele e um desfecho normal e aparece no proprio dialogo
 * (ADR-003).
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5, e
 * o toast sumiria sem nada no lugar.
 */
export function useChangeIncidentStatus(
  callbacks: FlowCallbacks<ChangeStatusVariables> = {},
): UseMutationResult<Incident, ApiError, ChangeStatusVariables> {
  const queryClient = useQueryClient();

  return useMutation<Incident, ApiError, ChangeStatusVariables>({
    mutationFn: ({ id, data }) => apiPost<Incident>(`/incidents/${id}/status`, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/**
 * Atribuicao de responsavel. Exige **`incident:manage`**, e nao `update`
 * (ADR-002): um papel que pode mudar o status nao necessariamente pode escolher
 * quem atende.
 */
export function useAssignIncident(
  callbacks: FlowCallbacks<AssignVariables> = {},
): UseMutationResult<Incident, ApiError, AssignVariables> {
  const queryClient = useQueryClient();

  return useMutation<Incident, ApiError, AssignVariables>({
    mutationFn: ({ id, data }) => apiPost<Incident>(`/incidents/${id}/assign`, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/** Total de ocorrencias num status, lido do resumo. Ausente no resumo e zero. */
export function totalOf(
  summary: readonly IncidentSummaryEntry[] | undefined,
  status: IncidentStatus,
): number {
  return summary?.find((entry) => entry.status === status)?.total ?? 0;
}
