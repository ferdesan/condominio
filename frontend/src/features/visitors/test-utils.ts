/**
 * Fixtures e duble de transporte dos testes de visitantes (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/visitor.ts`: aquele arquivo e compartilhado entre
 * as tasks do tier 2 e ja foi ponto de quebra. Como a fixture e tipada contra o
 * contrato, uma divergencia quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { ApiError, apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta, makeUnit } from '@/test/fixtures';
import type { Unit } from '@/types/api';
import type { Visitor } from '@/types/visitor';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeVisitor(overrides: Partial<Visitor> = {}): Visitor {
  return {
    id: 'visitor-1',
    condominiumId: 'cond-1',
    unitId: 'unit-1',
    name: 'Joana Ribeiro',
    document: '12345678909',
    phone: '11988887777',
    type: 'VISITOR',
    status: 'EXPECTED',
    company: 'Entrega Rapida',
    vehiclePlate: 'ABC1D23',
    expectedAt: '2026-03-14T18:00:00.000Z',
    expectedUntil: '2026-03-14T22:00:00.000Z',
    checkedInAt: null,
    checkedOutAt: null,
    authorizedById: 'user-1',
    authorizedByName: 'Marina Alves',
    registeredById: 'user-1',
    badgeNumber: 'C-014',
    photoUrl: null,
    accessCode: 'A1B2C3',
    notes: null,
    unit: makeUnit(),
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type VisitorWorld = {
  visitors: Visitor[];
  units: Unit[];
  /** Corpo de `/visitors/inside-count`, que e um objeto e nao `meta.total`. */
  inside: number;
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as quatro rotas que a tela alcanca a partir de uma unica descricao do
 * mundo. O objeto devolvido e o mesmo que os mocks leem, entao mutar um campo
 * dele muda o que a proxima requisicao ve.
 */
export function serveVisitors(initial: Partial<VisitorWorld> = {}): VisitorWorld {
  const world: VisitorWorld = {
    visitors: [],
    units: [makeUnit()],
    inside: 0,
    ...initial,
  };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/units') {
      return { data: world.units, meta: makeMeta({ total: world.units.length, perPage: 200 }) };
    }
    if (url !== '/visitors') throw new Error(`URL de listagem nao prevista no teste: ${url}`);

    return {
      data: world.visitors,
      meta: makeMeta({
        total: world.total ?? world.visitors.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/visitors/inside-count') return { inside: world.inside } as never;

    /**
     * A consulta do balcao. O servidor procura **apenas entre os `EXPECTED`** e
     * recusa o resto com `BusinessRuleError` (409) — quem ja entrou tambem "nao
     * existe" para ela. O duble reproduz as duas regras, porque e justamente
     * essa distincao que a tela precisa apresentar como resposta, e nao como
     * falha.
     */
    const match = /^\/visitors\/access-code\/(.+)$/.exec(url);
    if (match) {
      const code = decodeURIComponent(match[1] ?? '');
      const found = world.visitors.find(
        (visitor) =>
          visitor.accessCode === code && visitor.status === 'EXPECTED' && !visitor.deletedAt,
      );
      if (!found) {
        throw new ApiError(
          'Codigo de acesso invalido ou ja utilizado.',
          409,
          'BUSINESS_RULE_VIOLATION',
        );
      }
      return found as never;
    }

    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem de visitantes pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/visitors');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Consultas feitas ao endpoint dedicado de contagem. */
export function insideCountRequests(): RequestParams[] {
  return vi
    .mocked(apiGet)
    .mock.calls.filter(([url]) => url === '/visitors/inside-count')
    .map(([, config]) => (config?.params ?? {}) as RequestParams);
}
