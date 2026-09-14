/**
 * Camada de dados da central de notificacoes.
 *
 * **Nao usa a fabrica do ADR-008.** Ela expoe as seis operacoes do roteador CRUD
 * compartilhado, e `notification.routes.ts` tem tres rotas proprias: a listagem,
 * a contagem de nao lidas e a marcacao de leitura. Nao existe criar, editar,
 * excluir nem restaurar — as notificacoes sao geradas pelo servidor a partir de
 * eventos de negocio, e montar a fabrica so pela listagem deixaria as quatro
 * mutacoes ao alcance de quem escrever a proxima tela, apontando para endpoints
 * que respondem 404.
 *
 * **A central e pessoal.** O servidor injeta o usuario da sessao em toda leitura
 * (`notificationService.list` sobrescreve o filtro `userId`), entao o cliente
 * nao manda destinatario — mandar prometeria um recorte que ele nao controla.
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiGetPaginated, apiPost, type ApiError, type Paginated } from '@/lib/api';
import { toQueryParams, type ListParams } from '@/lib/crud';
import type {
  AppNotification,
  NotificationReadResult,
  NotificationUnreadCount,
} from '@/types/notification';

export const NOTIFICATIONS_KEY = 'notifications';

/**
 * Whitelist de filtros do `NotificationRepository`, menos os dois que mentiriam.
 *
 * O repositorio aceita `userId`, `type`, `resource` e `condominiumId`. `userId`
 * fica de fora porque o servidor o sobrescreve com o da sessao; `condominiumId`
 * porque as notificacoes do tenant inteiro tem a coluna nula e sumiriam do
 * resultado — a central e do usuario, e nao do predio selecionado no shell.
 *
 * `readAt` **nao** e filtravel: nao ha como pedir ao servidor so as nao lidas, e
 * por isso a tela nao oferece esse controle. O contador dedicado responde a
 * pergunta que ele responderia.
 */
export const notificationFilters = ['type', 'resource'] as const;

/**
 * O backend aceita ordenar por filtravel + buscavel + os dois timestamps
 * (`BaseRepository.applySorting`). Buscaveis: `title` e `message`.
 *
 * Note a ausencia de `readAt`: uma coluna de situacao ordenavel seria descartada
 * em silencio e o servidor voltaria para `createdAt DESC` sem avisar.
 */
export const notificationSortable = [
  'type',
  'resource',
  'title',
  'message',
  'createdAt',
  'updatedAt',
] as const;

/**
 * A lista, paginada.
 *
 * `placeholderData` segura as linhas anteriores enquanto a proxima pagina nao
 * chega: sem isso a tabela esvazia e a paginacao some a cada tecla digitada.
 */
export function useNotificationList(
  params: ListParams,
): UseQueryResult<Paginated<AppNotification>, ApiError> {
  return useQuery<Paginated<AppNotification>, ApiError>({
    queryKey: [NOTIFICATIONS_KEY, 'list', params],
    queryFn: () =>
      apiGetPaginated<AppNotification>('/notifications', { params: toQueryParams(params) }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Quantas notificacoes seguem sem leitura.
 *
 * Vem de `/notifications/unread-count`, e nao de `meta.total` de uma listagem
 * filtrada — que nem seria possivel, porque `readAt` nao e um filtro aceito. O
 * corpo e um objeto, `{ unread }`, e nao um numero solto.
 *
 * A chave comeca com o recurso, entao a invalidacao da marcacao de leitura ja a
 * alcanca sem codigo extra. Ela **nao** carrega o condominio selecionado: a
 * resposta e do usuario e nao varia com ele, e incluir a chave refaria a busca a
 * cada troca no shell prometendo uma variacao inexistente.
 */
export function useUnreadCount(): UseQueryResult<number, ApiError> {
  return useQuery<number, ApiError>({
    queryKey: [NOTIFICATIONS_KEY, 'unread-count'],
    queryFn: async () => {
      const result = await apiGet<NotificationUnreadCount>('/notifications/unread-count');
      return result.unread;
    },
  });
}

/**
 * Marcar como lida. Exige `notification:update`.
 *
 * `ids` ausente marca **todas** as nao lidas do usuario: e o contrato de
 * `markAsReadSchema`, onde o campo e opcional. A tela usa as duas formas — uma
 * linha de cada vez, e o botao que zera a fila.
 */
export type MarkAsReadVariables = {
  /** Ausente ou vazio: todas as nao lidas do usuario. */
  ids?: string[];
};

export type MarkAsReadCallbacks = {
  onError?: (error: ApiError, variables: MarkAsReadVariables) => void;
  onSuccess?: (data: NotificationReadResult, variables: MarkAsReadVariables) => void;
};

/**
 * Invalida o recurso inteiro, entao a listagem e a contagem de nao lidas saem
 * juntas do ar e voltam coerentes — e o que faz o contador acompanhar a acao.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5, e
 * o toast sumiria sem nada no lugar.
 */
export function useMarkAsRead(
  callbacks: MarkAsReadCallbacks = {},
): UseMutationResult<NotificationReadResult, ApiError, MarkAsReadVariables> {
  const queryClient = useQueryClient();

  return useMutation<NotificationReadResult, ApiError, MarkAsReadVariables>({
    mutationFn: ({ ids }) =>
      apiPost<NotificationReadResult>('/notifications/read', ids?.length ? { ids } : {}),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
