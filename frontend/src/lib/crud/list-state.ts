/**
 * Estado de visualizacao compartilhado pelas cinco listagens: pagina, busca,
 * ordenacao, filtros e o alternador de removidos.
 *
 * A tabela nao guarda estado proprio, entao este hook e o unico dono — e por
 * isso e ele quem devolve a pagina para 1 quando o conjunto de resultados muda.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SortDirection, SortState } from '@/components/common/data-table';
import { toSortOrder, type Filters, type FilterValue, type ListParams } from './query-params';

export const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

export type ListState = {
  page: number;
  /** Valor com debounce: seguro para enviar a API. */
  search: string;
  /** Valor imediato: e o que fica no input. */
  searchInput: string;
  sort: SortState | undefined;
  filters: Filters;
  includeDeleted: boolean;
  setPage: (page: number) => void;
  setSearch: (term: string) => void;
  setSort: (column: string, direction: SortDirection) => void;
  setFilter: (key: string, value: FilterValue) => void;
  clearFilters: () => void;
  setIncludeDeleted: (include: boolean) => void;
  toListParams: (perPage: number) => ListParams;
};

export type ListStateOptions = {
  initialFilters?: Filters;
  initialSort?: SortState;
  debounceMs?: number;
};

export function useListState(options: ListStateOptions = {}): ListState {
  const { initialFilters, initialSort, debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS } = options;

  const [page, setPageState] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearchValue] = useState('');
  const [sort, setSortState] = useState<SortState | undefined>(initialSort);
  const [filters, setFilters] = useState<Filters>(() => ({ ...initialFilters }));
  const [includeDeleted, setIncludeDeletedState] = useState(false);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => setSearchValue(searchInput), debounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, search, debounceMs]);

  const setPage = useCallback((next: number) => {
    setPageState(Number.isFinite(next) && next > 1 ? Math.floor(next) : 1);
  }, []);

  const setSearch = useCallback((term: string) => {
    setSearchInput(term);
    setPageState(1);
  }, []);

  /** Guarda o que a tabela reportou; alternar a direcao e papel dela. */
  const setSort = useCallback((column: string, direction: SortDirection) => {
    setSortState({ column, direction });
  }, []);

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setFilters((current) => {
      const next = { ...current };
      // Remover a chave e diferente de enviar vazio: vazio o backend descarta.
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
    setPageState(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPageState(1);
  }, []);

  const setIncludeDeleted = useCallback((include: boolean) => {
    setIncludeDeletedState(include);
    setPageState(1);
  }, []);

  const toListParams = useCallback(
    (perPage: number): ListParams => ({
      page,
      perPage,
      search: search || undefined,
      sortBy: sort?.column ?? undefined,
      sortOrder: sort?.column ? toSortOrder(sort.direction) : undefined,
      includeDeleted,
      filters,
    }),
    [page, search, sort, includeDeleted, filters],
  );

  return useMemo(
    () => ({
      page,
      search,
      searchInput,
      sort,
      filters,
      includeDeleted,
      setPage,
      setSearch,
      setSort,
      setFilter,
      clearFilters,
      setIncludeDeleted,
      toListParams,
    }),
    [
      page,
      search,
      searchInput,
      sort,
      filters,
      includeDeleted,
      setPage,
      setSearch,
      setSort,
      setFilter,
      clearFilters,
      setIncludeDeleted,
      toListParams,
    ],
  );
}
