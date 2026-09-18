/**
 * Fixtures e duble de transporte dos testes de correspondencias (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/correspondence.ts`: aquele arquivo e
 * compartilhado entre as tasks do tier 2 e ja foi ponto de quebra. Como a
 * fixture e tipada contra o contrato, uma divergencia quebra no type check e nao
 * em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta, makeResident, makeUnit } from '@/test/fixtures';
import type { Resident, Unit } from '@/types/api';
import type { Correspondence } from '@/types/correspondence';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeCorrespondence(overrides: Partial<Correspondence> = {}): Correspondence {
  return {
    id: 'correspondence-1',
    condominiumId: 'cond-1',
    unitId: 'unit-1',
    residentId: 'resident-1',
    type: 'PACKAGE',
    status: 'PENDING',
    carrier: 'Correios',
    trackingCode: 'BR123456789BR',
    description: 'Caixa média',
    receivedAt: '2026-03-12T09:30:00.000Z',
    receivedBy: 'Marina Alves',
    deliveredAt: null,
    deliveredTo: null,
    photoUrl: null,
    notes: null,
    unit: makeUnit(),
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type CorrespondenceWorld = {
  correspondences: Correspondence[];
  units: Unit[];
  residents: Resident[];
  /** Corpo de `/correspondences/pending-count`, que e um objeto e nao `meta.total`. */
  pending: number;
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as quatro rotas que a tela alcanca a partir de uma unica descricao do
 * mundo. O objeto devolvido e o mesmo que os mocks leem, entao mutar um campo
 * dele muda o que a proxima requisicao ve.
 */
export function serveCorrespondences(
  initial: Partial<CorrespondenceWorld> = {},
): CorrespondenceWorld {
  const world: CorrespondenceWorld = {
    correspondences: [],
    units: [makeUnit()],
    residents: [makeResident()],
    pending: 0,
    ...initial,
  };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/units') {
      return { data: world.units, meta: makeMeta({ total: world.units.length, perPage: 200 }) };
    }
    if (url === '/residents') {
      return {
        data: world.residents,
        meta: makeMeta({ total: world.residents.length, perPage: 200 }),
      };
    }
    if (url !== '/correspondences') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.correspondences,
      meta: makeMeta({
        total: world.total ?? world.correspondences.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/correspondences/pending-count') return { pending: world.pending } as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem de correspondencias pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/correspondences');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Consultas feitas ao endpoint dedicado de contagem. */
export function pendingCountRequests(): RequestParams[] {
  return vi
    .mocked(apiGet)
    .mock.calls.filter(([url]) => url === '/correspondences/pending-count')
    .map(([, config]) => (config?.params ?? {}) as RequestParams);
}
