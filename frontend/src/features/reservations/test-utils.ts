/**
 * Duble de transporte compartilhado pelos testes de reservas (ADR-010).
 *
 * A tela conversa com quatro colecoes ao mesmo tempo — reservas, areas comuns,
 * unidades e disponibilidade — e ainda pede contagens pela mesma rota da
 * listagem, distinguidas apenas por `perPage=1`. Concentrar o roteamento aqui
 * evita repetir essa triagem em cada arquivo de teste.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated, type Paginated } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import type { AvailabilityEntry, CommonArea, Reservation, Unit } from '@/types/api';

export type RequestParams = Record<string, unknown>;

export type ReservationPage = {
  data: Reservation[];
  total?: number;
  totalPages?: number;
};

export type ServeOptions = {
  reservations?: Reservation[] | ((params: RequestParams) => ReservationPage);
  areas?: CommonArea[];
  units?: Unit[];
  /** `meta.total` devolvido as consultas de contagem (`perPage=1`). */
  count?: (params: RequestParams) => number;
  availability?:
    | AvailabilityEntry[]
    | ((params: RequestParams) => AvailabilityEntry[] | Promise<AvailabilityEntry[]>);
};

function page<T>(data: T[], meta: Partial<ReturnType<typeof makeMeta>> = {}): Paginated<T> {
  return { data, meta: makeMeta({ total: data.length, ...meta }) };
}

/** Uma consulta de contagem pede exatamente um registro. */
export function isCountRequest(params: RequestParams): boolean {
  return Number(params.perPage) === 1;
}

export function serveApi(options: ServeOptions = {}): void {
  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/common-areas') return page(options.areas ?? [], { perPage: 200 });
    if (url === '/units') return page(options.units ?? [], { perPage: 200 });

    if (url === '/reservations') {
      if (isCountRequest(params)) {
        return { data: [], meta: makeMeta({ page: 1, perPage: 1, total: options.count?.(params) ?? 0 }) };
      }
      const resolved =
        typeof options.reservations === 'function'
          ? options.reservations(params)
          : { data: options.reservations ?? [] };
      return page(resolved.data, {
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
        total: resolved.total ?? resolved.data.length,
        ...(resolved.totalPages === undefined ? {} : { totalPages: resolved.totalPages }),
      });
    }

    throw new Error(`URL de listagem nao prevista no teste: ${url}`);
  });

  vi.mocked(apiGet).mockImplementation(async (url, config) => {
    if (url === '/reservations/availability') {
      const params = (config?.params ?? {}) as RequestParams;
      const entries =
        typeof options.availability === 'function'
          ? await options.availability(params)
          : (options.availability ?? []);
      return entries as never;
    }

    throw new Error(`URL nao prevista no teste: ${url}`);
  });
}

/** Parametros de cada consulta feita a uma rota. */
function paramsOf(url: string, predicate: (params: RequestParams) => boolean): RequestParams[] {
  return vi
    .mocked(apiGetPaginated)
    .mock.calls.filter(([called]) => called === url)
    .map(([, config]) => (config?.params ?? {}) as RequestParams)
    .filter(predicate);
}

/** Consultas de listagem de reservas, sem as de contagem. */
export function listRequests(): RequestParams[] {
  return paramsOf('/reservations', (params) => !isCountRequest(params));
}

export function lastListParams(): RequestParams {
  return listRequests().at(-1) ?? {};
}

/** Consultas de contagem de reservas. */
export function countRequests(): RequestParams[] {
  return paramsOf('/reservations', isCountRequest);
}

/** Consultas ao endpoint de disponibilidade. */
export function availabilityRequests(): RequestParams[] {
  return vi
    .mocked(apiGet)
    .mock.calls.filter(([url]) => url === '/reservations/availability')
    .map(([, config]) => (config?.params ?? {}) as RequestParams);
}
