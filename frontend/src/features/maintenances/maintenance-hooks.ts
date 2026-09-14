/**
 * Camada de dados da tela de manutencoes: a fabrica do ADR-008 para a superficie
 * CRUD uniforme, mais os quatro endpoints proprios do recurso — as tres acoes do
 * ciclo e a leitura do que esta por vir — escritas como hooks comuns, porque a
 * fabrica so expoe as seis operacoes do roteador compartilhado.
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
import type { CompletedMaintenance, Maintenance } from '@/types/maintenance';
import type { ServiceProvider } from '@/types/api';
import type { User } from '@/types/user';
import type { MaintenancePayload } from './maintenance-schema';

export const MAINTENANCES_KEY = 'maintenances';

/**
 * Whitelist de filtros do `MaintenanceRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 */
export const maintenanceFilters = [
  'condominiumId',
  'status',
  'type',
  'recurrence',
  'serviceProviderId',
  'responsibleId',
] as const;

export const maintenanceHooks = createResourceHooks<
  Maintenance,
  MaintenancePayload,
  Partial<MaintenancePayload>
>(MAINTENANCES_KEY);

/**
 * Prestadores do condominio, para o seletor e para o filtro.
 *
 * Aqui o escopo e do servidor: `ServiceProviderRepository` declara
 * `condominiumField` e aceita `condominiumId` entre os filtros, entao mandar a
 * chave escopa de verdade — ao contrario do que acontece com `/users`.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer e a colecao inteira
 * de uma vez, ordenada por nome, e nao uma pagina navegavel.
 */
export function useServiceProviderOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<ServiceProvider>, ApiError> {
  return useQuery<Paginated<ServiceProvider>, ApiError>({
    queryKey: ['service-providers', 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<ServiceProvider>('/service-providers', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          status: 'ACTIVE',
          sortBy: 'companyName',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

/**
 * Usuarios ativos do tenant, para o seletor de responsavel e para o filtro.
 *
 * A chave nao carrega o condominio porque a resposta nao depende dele — o
 * endpoint e por tenant. Inclui-la faria a mesma colecao ser buscada de novo a
 * cada troca no shell, e prometeria uma variacao que nao existe. Quem recorta e
 * `scopeToCondominium`, sobre o resultado.
 */
export function useResponsibleOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<User>, ApiError> {
  return useQuery<Paginated<User>, ApiError>({
    queryKey: ['users', 'options'],
    queryFn: () =>
      apiGetPaginated<User>('/users', {
        params: {
          perPage: MAX_PER_PAGE,
          // Escopar por condominio e do cliente; o que o servidor aceita filtrar
          // aqui e o status, e designar quem esta bloqueado nao serve a nada.
          status: 'ACTIVE',
          sortBy: 'name',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

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
 *
 * A mesma regra ja existe em ocorrencias. Esta copia de seis linhas e
 * deliberada: importa-la de `features/incidents` acoplaria duas telas
 * independentes por uma funcao pura, e `lib/crud/` nao muda nesta entrega.
 */
export function scopeToCondominium(
  users: readonly User[],
  condominiumId: string | null,
): User[] {
  if (!condominiumId) return [];
  return users.filter((user) => {
    const scope = user.condominiums ?? [];
    return scope.length === 0 || scope.some((item) => item.id === condominiumId);
  });
}

/**
 * O que esta por vir, de `GET /maintenances/upcoming`.
 *
 * A forma e propria: `maintenanceService.upcoming` devolve um **array** de
 * ordens — e nao uma pagina com `meta` —, ja limitado as dez mais proximas,
 * ordenado por `scheduledFor` crescente e restrito aos status que ainda podem
 * acontecer (`SCHEDULED`, `IN_PROGRESS`, `OVERDUE`). Quem decide o recorte e o
 * servidor: filtrar a pagina carregada responderia outra pergunta, porque a
 * lista mostra vinte linhas e um recorte de filtros.
 *
 * A chave comeca com o recurso, entao a invalidacao das mutacoes e das acoes de
 * fluxo ja a alcanca — e o destaque acompanha o ciclo sem codigo extra.
 *
 * A consulta e separada da listagem para que uma falha aqui nao leve a tela
 * junto: a lista continua utilizavel com o destaque em erro.
 */
export function useUpcomingMaintenances(
  condominiumId: string | null,
): UseQueryResult<Maintenance[], ApiError> {
  return useQuery<Maintenance[], ApiError>({
    queryKey: [MAINTENANCES_KEY, 'upcoming', condominiumId],
    queryFn: () =>
      apiGet<Maintenance[]>('/maintenances/upcoming', {
        params: { condominiumId: condominiumId ?? '' },
      }),
    enabled: Boolean(condominiumId),
  });
}

/** As tres transicoes que o servidor expoe. Todas exigem `maintenance:update`. */
export type MaintenanceFlowAction = 'start' | 'complete' | 'cancel';

export type FlowVariables = { id: string; action: MaintenanceFlowAction };

export type FlowCallbacks = {
  onError?: (error: ApiError, variables: FlowVariables) => void;
  onSuccess?: (variables: FlowVariables) => void;
};

/**
 * Iniciar, concluir e cancelar.
 *
 * As tres sao clique unico: `start` e `cancel` nao tem corpo, e
 * `completeMaintenanceSchema` tem todos os campos opcionais com `scheduleNext`
 * ja em `true` — o corpo vazio e a escolha certa, e nao ha o que perguntar. Por
 * isso sao acoes de linha e nao dialogos.
 *
 * `complete` devolve `{ maintenance, nextId }`, e nao a ordem sozinha: quando a
 * manutencao e recorrente o servidor ja abre a proxima. Nada aqui le o retorno —
 * a invalidacao traz a lista com as duas ordens.
 *
 * Invalidam o recurso inteiro, o que alcanca tambem `['maintenances','upcoming']`
 * e mantem o destaque coerente com o novo status.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5, e
 * o toast sumiria sem nada no lugar.
 */
export function useMaintenanceFlow(
  callbacks: FlowCallbacks = {},
): UseMutationResult<unknown, ApiError, FlowVariables> {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, FlowVariables>({
    mutationFn: ({ id, action }) =>
      action === 'complete'
        ? // O corpo e obrigatorio na rota (`validate({ body })`), ainda que todos
          // os campos sejam opcionais: sem objeto o zod recusaria antes do servico.
          apiPost<CompletedMaintenance>(`/maintenances/${id}/complete`, {})
        : apiPost<Maintenance>(`/maintenances/${id}/${action}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [MAINTENANCES_KEY] });
      callbacks.onSuccess?.(variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
