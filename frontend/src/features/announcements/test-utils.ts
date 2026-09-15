/**
 * Fixtures e duble de transporte dos testes de comunicados (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/announcement.ts`: aquele arquivo e compartilhado
 * entre as tasks deste tier e ja foi ponto de quebra. Como a fixture e tipada
 * contra o contrato, uma divergencia quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeBlock, makeMeta } from '@/test/fixtures';
import type { Announcement } from '@/types/announcement';
import type { Block } from '@/types/api';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'announcement-1',
    condominiumId: 'cond-1',
    title: 'Manutencao do elevador',
    content: 'O elevador da Torre A ficara parado na terca-feira, das 8h as 12h.',
    category: 'MAINTENANCE',
    status: 'DRAFT',
    audience: 'ALL',
    targetBlockIds: null,
    pinned: false,
    publishedAt: null,
    expiresAt: null,
    authorId: 'user-1',
    authorName: 'Marina Alves',
    attachmentUrl: null,
    readsCount: 0,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type AnnouncementWorld = {
  announcements: Announcement[];
  blocks: Block[];
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as duas rotas de leitura que a tela alcanca a partir de uma unica
 * descricao do mundo. O objeto devolvido e o mesmo que os mocks leem, entao
 * mutar um campo dele muda o que a proxima requisicao ve.
 */
export function serveAnnouncements(initial: Partial<AnnouncementWorld> = {}): AnnouncementWorld {
  const world: AnnouncementWorld = {
    announcements: [],
    blocks: [makeBlock()],
    ...initial,
  };

  /**
   * O mural e uma leitura propria da tela, e precisa ser servida: um `vi.fn()`
   * sem implementacao devolve `undefined`, e o React Query trata resultado
   * indefinido como falha — a tela inteira ganharia um toast de erro que nao
   * tem nada a ver com o caso em teste.
   *
   * Serve o recorte que `listPublished` faz: publicados, nao expirados, fixados
   * primeiro.
   */
  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/announcements/board') {
      const now = Date.now();
      const published = world.announcements.filter(
        (item) =>
          item.status === 'PUBLISHED' &&
          !item.deletedAt &&
          (!item.expiresAt || new Date(item.expiresAt).getTime() > now),
      );
      return [...published].sort((a, b) => Number(b.pinned) - Number(a.pinned)) as never;
    }
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/blocks') {
      return { data: world.blocks, meta: makeMeta({ total: world.blocks.length, perPage: 200 }) };
    }
    if (url !== '/announcements') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.announcements,
      meta: makeMeta({
        total: world.total ?? world.announcements.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  return world;
}

/** As consultas feitas ao mural. */
export function boardRequests(): RequestParams[] {
  return vi
    .mocked(apiGet)
    .mock.calls.filter(([url]) => url === '/announcements/board')
    .map(([, config]) => (config?.params ?? {}) as RequestParams);
}

/** Os parametros da ultima listagem de comunicados pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/announcements');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}
