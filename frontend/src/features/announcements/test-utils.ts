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
import { apiGetPaginated } from '@/lib/api';
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

/** Os parametros da ultima listagem de comunicados pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/announcements');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}
