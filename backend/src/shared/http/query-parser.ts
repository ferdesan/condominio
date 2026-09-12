import type { Request } from 'express';
import type { QueryOptions, SortDirection } from '@/shared/types/pagination';

const RESERVED_QUERY_KEYS = new Set([
  'page',
  'perPage',
  'per_page',
  'limit',
  'sortBy',
  'sort_by',
  'sortOrder',
  'sort_order',
  'search',
  'q',
  'includeDeleted',
  'include_deleted',
]);

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 200;

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function toStringValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Translates the HTTP query string into the transport-agnostic `QueryOptions`
 * consumed by repositories. Unknown keys are forwarded as filters and are
 * whitelisted later by each repository, never interpolated into SQL.
 */
export function parseQueryOptions(req: Request): QueryOptions {
  const query = req.query as Record<string, unknown>;

  const page = toNumber(query.page, 1);
  const perPage = Math.min(
    toNumber(query.perPage ?? query.per_page ?? query.limit, DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );

  const rawOrder = (toStringValue(query.sortOrder ?? query.sort_order) ?? 'DESC').toUpperCase();
  const sortOrder: SortDirection = rawOrder === 'ASC' ? 'ASC' : 'DESC';

  const filters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.has(key)) continue;
    if (value === undefined || value === '') continue;
    if (typeof value === 'string' && value.includes(',')) {
      filters[key] = value.split(',').map((item) => item.trim()).filter(Boolean);
    } else {
      filters[key] = value;
    }
  }

  return {
    page,
    perPage,
    sortBy: toStringValue(query.sortBy ?? query.sort_by),
    sortOrder,
    search: toStringValue(query.search ?? query.q),
    filters,
    includeDeleted:
      toStringValue(query.includeDeleted ?? query.include_deleted)?.toLowerCase() === 'true',
  };
}
