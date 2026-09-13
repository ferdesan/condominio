/**
 * Traducao entre o estado de visualizacao das telas e o contrato de query da
 * API. Vive em um lugar so porque os cinco recursos compartilham o mesmo
 * roteador CRUD no backend (ADR-008).
 *
 * Referencia executavel do contrato: `backend/src/shared/http/query-parser.ts`
 * e `backend/src/shared/repositories/base.repository.ts`.
 */

import type { SortDirection } from '@/components/common/data-table';

export const DEFAULT_PER_PAGE = 20;
/** Teto aplicado pelo parser do backend; pedir mais nao traz mais. */
export const MAX_PER_PAGE = 200;

export type FilterValue = string | string[] | undefined;
export type Filters = Record<string, FilterValue>;

export type ListParams = {
  page: number;
  perPage: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  includeDeleted?: boolean;
  filters?: Filters;
};

/** Valores aceitos pelo `params` do axios depois da serializacao. */
export type QueryParams = Record<string, string | number | boolean>;

/**
 * A tabela reporta a direcao em caixa baixa e a API espera caixa alta. A
 * traducao mora aqui, e nao no componente, para que ele mantenha o proprio
 * vocabulario (ADR-009).
 */
export function toSortOrder(direction: SortDirection | undefined): 'ASC' | 'DESC' | undefined {
  if (!direction) return undefined;
  return direction === 'asc' ? 'ASC' : 'DESC';
}

/** Um array vira lista separada por virgula: o backend le como teste de pertinencia. */
function serialiseFilter(value: FilterValue): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const items = value.filter((item) => item !== '');
    return items.length > 0 ? items.join(',') : undefined;
  }
  return value === '' ? undefined : value;
}

function clampPerPage(perPage: number): number {
  if (!Number.isFinite(perPage) || perPage < 1) return DEFAULT_PER_PAGE;
  return Math.min(Math.floor(perPage), MAX_PER_PAGE);
}

function clampPage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

/**
 * Monta o objeto enviado ao axios. Chaves cujo valor esta vazio sao omitidas,
 * porque o backend as descarta de qualquer forma — mas `'0'` e um valor valido
 * e permanece.
 */
export function toQueryParams(params: ListParams): QueryParams {
  const query: QueryParams = {
    page: clampPage(params.page),
    perPage: clampPerPage(params.perPage),
  };

  const search = params.search?.trim();
  if (search) query.search = search;
  if (params.sortBy) {
    query.sortBy = params.sortBy;
    query.sortOrder = params.sortOrder ?? 'DESC';
  }
  // O padrao do servidor ja e `false`; so vale a pena enviar quando true.
  if (params.includeDeleted) query.includeDeleted = true;

  for (const [key, value] of Object.entries(params.filters ?? {})) {
    const serialised = serialiseFilter(value);
    if (serialised !== undefined) query[key] = serialised;
  }

  return query;
}

// ---------------------------------------------------------------------------
// Whitelists por recurso
//
// Filtros fora da whitelist e colunas nao ordenaveis sao ignorados em silencio
// pelo backend: o controle parece funcionar sem fazer nada. So ofereca o que
// esta listado aqui. Espelha o `RepositoryConfig` de cada repositorio.
// ---------------------------------------------------------------------------

export const condominiumFilters = ['status', 'type', 'city', 'state'] as const;
export const blockFilters = ['condominiumId', 'type'] as const;
export const unitFilters = ['condominiumId', 'blockId', 'status', 'type', 'floor'] as const;
export const residentFilters = ['condominiumId', 'unitId', 'type', 'status', 'userId'] as const;
export const reservationFilters = [
  'condominiumId',
  'commonAreaId',
  'unitId',
  'status',
  'requestedById',
] as const;
export const commonAreaFilters = ['condominiumId', 'status', 'requiresApproval'] as const;

const condominiumSearchable = ['name', 'document', 'city', 'district'] as const;
const blockSearchable = ['name', 'description'] as const;
const unitSearchable = ['number'] as const;
const residentSearchable = ['name', 'email', 'document', 'phone'] as const;
const reservationSearchable = ['requestedByName', 'notes'] as const;
const commonAreaSearchable = ['name', 'description'] as const;

/** O backend aceita ordenar por filtravel + buscavel + os dois timestamps. */
function sortable(
  filters: readonly string[],
  searchable: readonly string[],
): readonly string[] {
  return [...new Set([...filters, ...searchable, 'createdAt', 'updatedAt'])];
}

export const condominiumSortable = sortable(condominiumFilters, condominiumSearchable);
export const blockSortable = sortable(blockFilters, blockSearchable);
export const unitSortable = sortable(unitFilters, unitSearchable);
export const residentSortable = sortable(residentFilters, residentSearchable);
export const reservationSortable = sortable(reservationFilters, reservationSearchable);
export const commonAreaSortable = sortable(commonAreaFilters, commonAreaSearchable);

/** Descarta chaves fora da whitelist antes que virem uma query inocua. */
export function pickFilters(whitelist: readonly string[], filters: Filters): Filters {
  const allowed = new Set(whitelist);
  return Object.fromEntries(
    Object.entries(filters).filter(([key]) => allowed.has(key)),
  );
}
