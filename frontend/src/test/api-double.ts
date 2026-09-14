/**
 * Duble de transporte compartilhado pelos testes transversais (ADR-010).
 *
 * Os testes de um modulo so conhecem as colecoes daquele modulo. Os desta camada
 * montam as quatro telas no mesmo caso — a matriz de papeis, o escopo de
 * condominio — e por isso precisam de um duble que atenda todas as rotas de uma
 * vez, e que registre o que foi pedido para que o escopo possa ser conferido
 * requisicao a requisicao.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated, type Paginated } from '@/lib/api';
import { makeMeta } from './fixtures';
import type {
  AvailabilityEntry,
  Block,
  CommonArea,
  Condominium,
  CondominiumStats,
  Reservation,
  Resident,
  Unit,
} from '@/types/api';

export type RequestParams = Record<string, unknown>;

/** As rotas de listagem que as quatro telas alcancam. */
export type Collections = {
  condominiums?: Condominium[];
  blocks?: Block[];
  units?: Unit[];
  residents?: Resident[];
  reservations?: Reservation[];
  commonAreas?: CommonArea[];
  /** `meta.total` das consultas de contagem (`perPage=1`), que alimentam indicadores. */
  count?: number;
  stats?: CondominiumStats;
  availability?: AvailabilityEntry[];
};

const ZERO_STATS: CondominiumStats = {
  units: 0,
  occupiedUnits: 0,
  residents: 0,
  vehicles: 0,
  openIncidents: 0,
  pendingCharges: 0,
  pendingReservations: 0,
};

const LIST_ROUTES = {
  '/condominiums': 'condominiums',
  '/blocks': 'blocks',
  '/units': 'units',
  '/residents': 'residents',
  '/reservations': 'reservations',
  '/common-areas': 'commonAreas',
} as const satisfies Record<string, keyof Collections>;

function page<T>(data: T[], params: RequestParams): Paginated<T> {
  return {
    data,
    meta: makeMeta({
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 20),
      total: data.length,
    }),
  };
}

/**
 * Responde todas as rotas de leitura a partir de uma unica descricao do mundo.
 *
 * Uma consulta de contagem pede `perPage=1` pela mesma rota da listagem, entao
 * ela e respondida com a lista vazia e o total pedido — que e exatamente o que a
 * tela le nesse caso.
 */
export function serveAll(collections: Collections = {}): void {
  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;
    const key = LIST_ROUTES[url as keyof typeof LIST_ROUTES];
    if (key === undefined) throw new Error(`URL de listagem nao prevista no teste: ${url}`);

    if (Number(params.perPage) === 1) {
      return {
        data: [],
        meta: makeMeta({ page: 1, perPage: 1, total: collections.count ?? 0 }),
      };
    }

    return page((collections[key] as unknown[]) ?? [], params) as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/reservations/availability') return (collections.availability ?? []) as never;
    if (url.endsWith('/stats')) return (collections.stats ?? ZERO_STATS) as never;

    const detail = url.match(/^\/condominiums\/([^/]+)$/);
    if (detail) {
      const found = (collections.condominiums ?? []).find((item) => item.id === detail[1]);
      if (found) return found as never;
    }

    throw new Error(`URL nao prevista no teste: ${url}`);
  });
}

/** Parametros de cada consulta de listagem feita a uma rota. */
export function listRequests(url: string): RequestParams[] {
  return vi
    .mocked(apiGetPaginated)
    .mock.calls.filter(([called]) => called === url)
    .map(([, config]) => (config?.params ?? {}) as RequestParams);
}

/** Parametros de toda consulta feita, de qualquer rota, com a URL junto. */
export function allRequests(): Array<{ url: string; params: RequestParams }> {
  const paginated = vi
    .mocked(apiGetPaginated)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  const plain = vi
    .mocked(apiGet)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  return [...paginated, ...plain];
}
