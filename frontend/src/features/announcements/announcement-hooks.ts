/**
 * Camada de dados da tela de comunicados: a fabrica do ADR-008 para a superficie
 * CRUD uniforme, mais as duas acoes do ciclo editorial — publicar e arquivar —
 * escritas como hooks comuns, porque a fabrica so expoe as seis operacoes do
 * roteador compartilhado. O mural (`/board`) e a terceira leitura propria.
 *
 * **`POST /announcements/:id/read` nao esta aqui, e e deliberado.** Ele nao
 * registra leitura por pessoa: `announcementService.markAsRead` chama
 * `incrementReads`, que soma 1 em `reads_count` — um contador global, sem
 * nenhum vinculo com quem pediu. Chama-lo desta tela faria cada consulta de um
 * administrador contar como leitura de morador, e o unico numero de alcance que
 * o produto tem deixaria de medir o que foi construido para medir. A rota
 * pertence ao portal do morador, que nao existe neste frontend.
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
import type { Announcement } from '@/types/announcement';
import type { Block } from '@/types/api';
import type { AnnouncementPayload } from './announcement-schema';

export const ANNOUNCEMENTS_KEY = 'announcements';

/**
 * Whitelist de filtros do `AnnouncementRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 */
export const announcementFilters = [
  'condominiumId',
  'status',
  'category',
  'audience',
  'pinned',
] as const;

/**
 * O mural: `GET /announcements/board`.
 *
 * **E uma leitura diferente da listagem, e nao um filtro dela.** O servidor
 * devolve so os `PUBLISHED` **nao expirados**, fixados primeiro e depois por
 * data de publicacao, no maximo vinte (`listPublished`). A listagem
 * administrativa nao consegue reproduzir isso: ela filtra por status, mas nao
 * tem filtro de expiracao nem ordenacao por `pinned` — entao um comunicado
 * vencido continuaria aparecendo como se estivesse no ar.
 *
 * E essa a pergunta que o mural responde para quem administra: **o que esta
 * publicado agora, na ordem em que as pessoas veem**.
 *
 * Array cru, sem envelope de paginacao: o recorte e do servidor e nao se refaz
 * no cliente.
 */
export function useAnnouncementBoard(
  condominiumId: string | null,
): UseQueryResult<Announcement[], ApiError> {
  return useQuery<Announcement[], ApiError>({
    queryKey: [ANNOUNCEMENTS_KEY, 'board', condominiumId],
    queryFn: () =>
      apiGet<Announcement[]>('/announcements/board', {
        params: { condominiumId: condominiumId ?? '' },
      }),
    enabled: Boolean(condominiumId),
  });
}

export const announcementHooks = createResourceHooks<
  Announcement,
  AnnouncementPayload,
  Partial<AnnouncementPayload>
>(ANNOUNCEMENTS_KEY);

/**
 * Blocos do condominio selecionado, para o publico-alvo `BLOCKS`.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer aqui e a colecao
 * inteira de uma vez, ordenada por nome, e nao uma pagina navegavel. Mesma forma
 * de `useUnitOptions` em correspondencias.
 */
export function useBlockOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<Block>, ApiError> {
  return useQuery<Paginated<Block>, ApiError>({
    queryKey: ['blocks', 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<Block>('/blocks', {
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

export type LifecycleVariables = { id: string };

export type LifecycleCallbacks = {
  onError?: (error: ApiError, variables: LifecycleVariables) => void;
  onSuccess?: (data: Announcement, variables: LifecycleVariables) => void;
};

/**
 * As duas acoes do ciclo editorial. Ambas exigem `announcement:update` e ambas
 * aceitam corpo vazio, entao sao clique unico na linha — sem dialogo.
 *
 * Invalidam o recurso inteiro, de modo que a listagem sai e volta coerente com o
 * novo status.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5, e
 * o toast sumiria sem nada no lugar.
 */
function useLifecycleAction(
  action: 'publish' | 'archive',
  callbacks: LifecycleCallbacks,
): UseMutationResult<Announcement, ApiError, LifecycleVariables> {
  const queryClient = useQueryClient();

  return useMutation<Announcement, ApiError, LifecycleVariables>({
    mutationFn: ({ id }) => apiPost<Announcement>(`/announcements/${id}/${action}`),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/** `POST /announcements/:id/publish`. O servidor recusa o ja publicado e o arquivado. */
export function usePublishAnnouncement(
  callbacks: LifecycleCallbacks = {},
): UseMutationResult<Announcement, ApiError, LifecycleVariables> {
  return useLifecycleAction('publish', callbacks);
}

/** `POST /announcements/:id/archive`. */
export function useArchiveAnnouncement(
  callbacks: LifecycleCallbacks = {},
): UseMutationResult<Announcement, ApiError, LifecycleVariables> {
  return useLifecycleAction('archive', callbacks);
}
