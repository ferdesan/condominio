export type PaginationMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type SortDirection = 'ASC' | 'DESC';

export type QueryOptions = {
  page: number;
  perPage: number;
  sortBy?: string;
  sortOrder: SortDirection;
  search?: string;
  filters: Record<string, unknown>;
  includeDeleted?: boolean;
};

export function buildPaginationMeta(total: number, page: number, perPage: number): PaginationMeta {
  const totalPages = perPage > 0 ? Math.ceil(total / perPage) : 0;
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function paginated<T>(data: T[], total: number, page: number, perPage: number): Paginated<T> {
  return { data, meta: buildPaginationMeta(total, page, perPage) };
}
