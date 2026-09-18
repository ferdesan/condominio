import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SEARCH_DEBOUNCE_MS, useListState } from './list-state';

describe('useListState', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('UT-016: comeca na pagina 1, sem busca, sem ordenação, sem filtros e sem removidos', () => {
    const { result } = renderHook(() => useListState());

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe('');
    expect(result.current.searchInput).toBe('');
    expect(result.current.sort).toBeUndefined();
    expect(result.current.filters).toEqual({});
    expect(result.current.includeDeleted).toBe(false);
  });

  it('UT-017: searchInput muda na hora; search so depois do debounce', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setSearch('aurora'));
    expect(result.current.searchInput).toBe('aurora');
    expect(result.current.search).toBe('');

    act(() => vi.advanceTimersByTime(DEFAULT_SEARCH_DEBOUNCE_MS - 1));
    expect(result.current.search).toBe('');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.search).toBe('aurora');
  });

  it('UT-018: setPage(0) e setPage(-1) sao limitados a 1', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(3));
    act(() => result.current.setPage(-1));
    expect(result.current.page).toBe(1);
  });

  it('UT-019: guarda o que a tabela reporta e não alterna a direção sozinho', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setSort('name', 'asc'));
    expect(result.current.sort).toEqual({ column: 'name', direction: 'asc' });

    act(() => result.current.setSort('name', 'asc'));
    expect(result.current.sort).toEqual({ column: 'name', direction: 'asc' });
  });

  it('UT-020: setIncludeDeleted(true) volta para a pagina 1', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setPage(4));
    act(() => result.current.setIncludeDeleted(true));

    expect(result.current.includeDeleted).toBe(true);
    expect(result.current.page).toBe(1);
  });

  it('UT-021: paginar não limpa o alternador de removidos', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setIncludeDeleted(true));
    act(() => result.current.setPage(3));

    expect(result.current.page).toBe(3);
    expect(result.current.includeDeleted).toBe(true);
  });

  it('UT-022: clearFilters esvazia os filtros e volta para a pagina 1', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setFilter('status', 'ACTIVE'));
    act(() => result.current.setPage(5));
    act(() => result.current.clearFilters());

    expect(result.current.filters).toEqual({});
    expect(result.current.page).toBe(1);
  });

  it('UT-026: filtros sucessivos se acumulam e mantem a pagina em 1', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setPage(2));
    act(() => result.current.setFilter('status', 'ACTIVE'));
    act(() => result.current.setFilter('type', 'OWNER'));

    expect(result.current.filters).toEqual({ status: 'ACTIVE', type: 'OWNER' });
    expect(result.current.page).toBe(1);
  });

  it('UT-027: setFilter(key, undefined) remove a chave em vez de enviar vazio', () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setFilter('unitId', 'unit-1'));
    expect(result.current.filters).toEqual({ unitId: 'unit-1' });

    act(() => result.current.setFilter('unitId', undefined));
    expect(result.current.filters).toEqual({});
    expect(Object.hasOwn(result.current.filters, 'unitId')).toBe(false);
  });
});
