/**
 * Fixtures e duble de transporte dos testes da central de notificacoes
 * (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/notification.ts`: aquele arquivo e compartilhado
 * entre as tasks deste tier e ja foi ponto de quebra. Como a fixture e tipada
 * contra o contrato, uma divergencia quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import type { AppNotification } from '@/types/notification';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

/**
 * Notificacao do usuario da sessao.
 *
 * O padrao e uma reserva nao lida, que e a forma mais interessante: `actionUrl`
 * aponta para `/reservas/{id}`, uma rota que **nao existe** — por ADR-004 nao ha
 * detalhe de reserva —, que e exatamente o caso que a resolucao de destino
 * precisa tratar.
 */
export function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notification-1',
    userId: 'user-1',
    condominiumId: 'cond-1',
    title: 'Reserva aprovada',
    message: 'Sua reserva do Salao de Festas foi aprovada.',
    type: 'RESERVATION',
    resource: 'reservation',
    resourceId: 'reservation-1',
    actionUrl: '/reservas/reservation-1',
    readAt: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type NotificationWorld = {
  notifications: AppNotification[];
  /** Corpo de `/notifications/unread-count`, contado a parte da lista. */
  unread: number;
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as duas rotas de leitura da central a partir de uma unica descricao
 * do mundo. O objeto devolvido e o mesmo que os mocks leem, entao mutar um campo
 * dele muda o que a proxima requisicao ve — e e assim que a contagem acompanha a
 * marcacao de leitura.
 *
 * Qualquer outra URL falha de proposito: uma chamada inesperada precisa aparecer
 * como erro em vez de resolver para `undefined`.
 */
export function serveNotifications(initial: Partial<NotificationWorld> = {}): NotificationWorld {
  const world: NotificationWorld = { notifications: [], unread: 0, ...initial };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;
    if (url !== '/notifications') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.notifications,
      meta: makeMeta({
        total: world.total ?? world.notifications.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/notifications/unread-count') return { unread: world.unread } as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/notifications');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Parametros de toda consulta de leitura feita pela tela, com a URL junto. */
export function allReadRequests(): Array<{ url: string; params: RequestParams }> {
  const paginated = vi
    .mocked(apiGetPaginated)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  const plain = vi
    .mocked(apiGet)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  return [...paginated, ...plain];
}
