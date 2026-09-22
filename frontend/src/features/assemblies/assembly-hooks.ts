/**
 * Camada de dados de assembleias e votacoes: a fabrica do ADR-008 para as duas
 * superficies CRUD uniformes, mais as acoes de ciclo e as leituras proprias de
 * cada recurso, escritas como hooks comuns porque a fabrica so expoe as seis
 * operacoes do roteador compartilhado.
 *
 * Sao **dois** recursos com chaves separadas: `/assemblies` e `/polls`. Uma
 * votacao aberta nao muda a assembleia, e encerrar uma assembleia nao apura as
 * votacoes dela — misturar as chaves faria cada acao recarregar o que nao mudou.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiPost, type ApiError } from '@/lib/api';
import { createResourceHooks } from '@/lib/crud';
import type {
  Assembly,
  MyVote,
  Poll,
  PollResults,
  UnitVoteStatus,
} from '@/types/assembly';
import type { AssemblyPayload, FinishAssemblyPayload, PollPayload } from './assembly-schema';

export const ASSEMBLIES_KEY = 'assemblies';
export const POLLS_KEY = 'polls';

/**
 * Whitelists de filtros dos dois repositorios.
 *
 * Moram aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque
 * aquele modulo e compartilhado. A regra que elas servem e a mesma: o backend
 * descarta em silencio o que estiver fora da lista, entao um controle a mais
 * pareceria funcionar sem filtrar nada.
 */
export const assemblyFilters = ['condominiumId', 'status', 'type', 'mode'] as const;
export const pollFilters = ['condominiumId', 'assemblyId', 'status', 'voterType'] as const;

/**
 * O backend aceita ordenar por filtravel + buscavel + os dois timestamps
 * (`BaseRepository.applySorting`).
 *
 * Note a ausencia de `scheduledAt` em assembleias e de `startsAt` em votacoes:
 * os dois sao `defaultSort` e **nao** entram no conjunto ordenavel — uma coluna
 * ordenavel por eles seria descartada em silencio e o servidor cairia para a
 * ordem padrao sem avisar.
 */
export const assemblySortable = [
  'condominiumId',
  'status',
  'type',
  'mode',
  'title',
  'description',
  'location',
  'createdAt',
  'updatedAt',
] as const;

export const assemblyHooks = createResourceHooks<
  Assembly,
  AssemblyPayload,
  Partial<AssemblyPayload>
>(ASSEMBLIES_KEY);

export const pollHooks = createResourceHooks<Poll, PollPayload, Partial<PollPayload>>(POLLS_KEY);

/**
 * As proximas assembleias, de `GET /assemblies/upcoming`.
 *
 * Devolve um **array cru**, sem `meta`: o recorte e do servidor
 * (`listUpcoming`) e nao se refaz no cliente. A chave comeca com o recurso, para
 * que a invalidacao das mutacoes e das acoes de ciclo ja a alcance.
 */
export function useUpcomingAssemblies(
  condominiumId: string | null,
): UseQueryResult<Assembly[], ApiError> {
  return useQuery<Assembly[], ApiError>({
    queryKey: [ASSEMBLIES_KEY, 'upcoming', condominiumId],
    queryFn: () =>
      apiGet<Assembly[]>('/assemblies/upcoming', {
        params: { condominiumId: condominiumId ?? '' },
      }),
    enabled: Boolean(condominiumId),
  });
}

export type AssemblyActionVariables = { id: string };

export type AssemblyActionCallbacks = {
  onError?: (error: ApiError, variables: AssemblyActionVariables) => void;
  onSuccess?: (data: Assembly, variables: AssemblyActionVariables) => void;
};

/**
 * Monta uma acao de ciclo da assembleia.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5, e
 * o toast sumiria sem nada no lugar.
 */
function useAssemblyAction(
  action: 'start' | 'cancel',
  callbacks: AssemblyActionCallbacks,
): UseMutationResult<Assembly, ApiError, AssemblyActionVariables> {
  const queryClient = useQueryClient();

  return useMutation<Assembly, ApiError, AssemblyActionVariables>({
    mutationFn: ({ id }) => apiPost<Assembly>(`/assemblies/${id}/${action}`, {}),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [ASSEMBLIES_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/** Iniciar. Exige `assembly:update`; o servidor recusa o que nao esta agendado. */
export function useStartAssembly(callbacks: AssemblyActionCallbacks = {}) {
  return useAssemblyAction('start', callbacks);
}

/** Cancelar. Exige `assembly:update`; o servidor recusa o que ja foi encerrado. */
export function useCancelAssembly(callbacks: AssemblyActionCallbacks = {}) {
  return useAssemblyAction('cancel', callbacks);
}

export type FinishAssemblyVariables = { id: string; data: FinishAssemblyPayload };

export type FinishAssemblyCallbacks = {
  onError?: (error: ApiError, variables: FinishAssemblyVariables) => void;
  onSuccess?: (data: Assembly, variables: FinishAssemblyVariables) => void;
};

/**
 * Encerrar. Exige corpo — a ata e o numero de presentes —, e por isso e a unica
 * das tres que vira dialogo em vez de clique unico.
 */
export function useFinishAssembly(
  callbacks: FinishAssemblyCallbacks = {},
): UseMutationResult<Assembly, ApiError, FinishAssemblyVariables> {
  const queryClient = useQueryClient();

  return useMutation<Assembly, ApiError, FinishAssemblyVariables>({
    mutationFn: ({ id, data }) => apiPost<Assembly>(`/assemblies/${id}/finish`, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [ASSEMBLIES_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

export type PollActionVariables = { id: string };

export type PollActionCallbacks<TData> = {
  onError?: (error: ApiError, variables: PollActionVariables) => void;
  onSuccess?: (data: TData, variables: PollActionVariables) => void;
};

/**
 * Abrir a votacao. Exige `poll:update`.
 *
 * Devolve a votacao; encerrar devolve a **apuracao**, que e outro tipo — por
 * isso as duas nao compartilham uma fabrica como as acoes da assembleia.
 */
export function useOpenPoll(
  callbacks: PollActionCallbacks<Poll> = {},
): UseMutationResult<Poll, ApiError, PollActionVariables> {
  const queryClient = useQueryClient();

  return useMutation<Poll, ApiError, PollActionVariables>({
    mutationFn: ({ id }) => apiPost<Poll>(`/polls/${id}/open`, {}),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [POLLS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/** Encerrar e apurar. Exige `poll:update`. */
export function useClosePoll(
  callbacks: PollActionCallbacks<PollResults> = {},
): UseMutationResult<PollResults, ApiError, PollActionVariables> {
  const queryClient = useQueryClient();

  return useMutation<PollResults, ApiError, PollActionVariables>({
    mutationFn: ({ id }) => apiPost<PollResults>(`/polls/${id}/close`, {}),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [POLLS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/**
 * A apuracao de uma votacao, de `GET /polls/:id/results`.
 *
 * Fica desligada enquanto nao houver votacao escolhida. A chave comeca com o
 * recurso para que abrir ou encerrar ja a alcance: os percentuais mudam com o
 * estado, e uma apuracao antiga na tela e pior do que nenhuma.
 */
export function usePollResults(pollId: string | null): UseQueryResult<PollResults, ApiError> {
  return useQuery<PollResults, ApiError>({
    queryKey: [POLLS_KEY, 'results', pollId],
    queryFn: () => apiGet<PollResults>(`/polls/${pollId}/results`),
    enabled: Boolean(pollId),
  });
}

/**
 * O voto da pessoa na votacao, de `GET /polls/:id/my-vote`.
 *
 * Mesmo molde de `usePollResults`: desligada sem votacao escolhida, e a chave
 * comeca com o recurso para que registrar o voto ja a alcance na invalidacao.
 */
export function useMyVote(pollId: string | null): UseQueryResult<MyVote, ApiError> {
  return useQuery<MyVote, ApiError>({
    queryKey: [POLLS_KEY, 'my-vote', pollId],
    queryFn: () => apiGet<MyVote>(`/polls/${pollId}/my-vote`),
    enabled: Boolean(pollId),
  });
}

/**
 * O status de todas as unidades da votacao, de `GET /polls/:id/vote-status`.
 *
 * Exige `vote:manage` no servidor; a chave fica sob o recurso para que um
 * voto proxy registrado na sequencia ja atualize a lista.
 */
export function useVoteStatus(
  pollId: string | null,
): UseQueryResult<UnitVoteStatus[], ApiError> {
  return useQuery<UnitVoteStatus[], ApiError>({
    queryKey: [POLLS_KEY, 'vote-status', pollId],
    queryFn: () => apiGet<UnitVoteStatus[]>(`/polls/${pollId}/vote-status`),
    enabled: Boolean(pollId),
  });
}

export type CastVoteVariables = { optionId: string };

export type CastProxyVoteVariables = { unitId: string; optionId: string };

/**
 * Callbacks das mutacoes de voto.
 *
 * Mesmo molde das acoes de ciclo: `onError` so entra no objeto quando quem
 * chamou informou um — escrever `onError: undefined` tambem substituiria o
 * handler global do React Query v5, e o toast sumiria sem nada no lugar.
 */
export type PollVoteCallbacks<TVariables> = {
  onError?: (error: ApiError, variables: TVariables) => void;
  onSuccess?: (data: PollResults, variables: TVariables) => void;
};

/**
 * Registra o voto da pessoa. Exige `vote:create`.
 *
 * Devolve a apuracao e invalida `[POLLS_KEY]`: lista, detalhe, my-vote e
 * resultados mudam juntos a cada voto.
 */
export function useCastVote(
  pollId: string,
  callbacks: PollVoteCallbacks<CastVoteVariables> = {},
): UseMutationResult<PollResults, ApiError, CastVoteVariables> {
  const queryClient = useQueryClient();

  return useMutation<PollResults, ApiError, CastVoteVariables>({
    mutationFn: ({ optionId }) => apiPost<PollResults>(`/polls/${pollId}/vote`, { optionId }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [POLLS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/**
 * Registra o voto de uma unidade pela gestao. Exige `vote:manage`.
 *
 * Mesma invalidacao de `useCastVote`: o voto proxy muda apuracao e status no
 * mesmo passo.
 */
export function useCastProxyVote(
  pollId: string,
  callbacks: PollVoteCallbacks<CastProxyVoteVariables> = {},
): UseMutationResult<PollResults, ApiError, CastProxyVoteVariables> {
  const queryClient = useQueryClient();

  return useMutation<PollResults, ApiError, CastProxyVoteVariables>({
    mutationFn: ({ unitId, optionId }) =>
      apiPost<PollResults>(`/polls/${pollId}/votes`, { unitId, optionId }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [POLLS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
