/**
 * Fixtures e duble de transporte dos testes do acervo (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/document.ts`: aquele arquivo e compartilhado
 * entre tasks. Como a fixture e tipada contra o contrato, uma divergencia
 * quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { api, apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import type { DocumentFile } from '@/types/document';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeDocument(overrides: Partial<DocumentFile> = {}): DocumentFile {
  return {
    id: 'document-1',
    condominiumId: 'cond-1',
    title: 'Convencao do condominio',
    description: 'Texto registrado em cartorio.',
    category: 'CONVENTION',
    visibility: 'RESIDENTS',
    fileName: 'convencao.pdf',
    filePath: 'tenant-1/6f1c.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 524_288,
    version: 1,
    uploadedById: 'user-1',
    expiresAt: null,
    downloadsCount: 12,
    tags: ['cartorio'],
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type DocumentWorld = {
  documents: DocumentFile[];
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde a unica rota de leitura da tela a partir de uma descricao do mundo.
 * O objeto devolvido e o mesmo que o mock le, entao mutar um campo dele muda o
 * que a proxima requisicao ve.
 *
 * `apiGet` tambem e coberto e sempre falha: esta tela nao tem endpoint auxiliar
 * de leitura simples — o download passa por `api.get`, que e outro caminho —, e
 * uma chamada inesperada precisa aparecer como erro em vez de resolver para
 * `undefined`.
 */
export function serveDocuments(initial: Partial<DocumentWorld> = {}): DocumentWorld {
  const world: DocumentWorld = { documents: [], ...initial };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;
    if (url !== '/documents') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.documents,
      meta: makeMeta({
        total: world.total ?? world.documents.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  // O download nao passa por `apiGet`: ele pede o arquivo cru pelo cliente
  // axios, porque a rota devolve bytes e nao um envelope JSON.
  vi.mocked(api.get).mockResolvedValue({ data: new Blob(['conteudo']) });

  return world;
}

/** Os parametros da ultima listagem pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/documents');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** O corpo multipart do ultimo envio, ja legivel como pares chave/valor. */
export function uploadedFields(data: unknown): Record<string, unknown> {
  if (!(data instanceof FormData)) throw new Error('O envio nao foi multipart.');
  return Object.fromEntries(data.entries());
}
