import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSidebarCollapsed } from '../use-sidebar-collapsed';

const STORAGE_KEY = 'condominio-sidebar-collapsed';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSidebarCollapsed', () => {
  it('estado inicial sem localStorage: collapsed = false', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it('le valor do localStorage no mount', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });

  it('toggle inverte o estado', () => {
    const { result } = renderHook(() => useSidebarCollapsed());

    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  it('setCollapsed define explicitamente', () => {
    const { result } = renderHook(() => useSidebarCollapsed());

    act(() => result.current.setCollapsed(true));
    expect(result.current.collapsed).toBe(true);

    act(() => result.current.setCollapsed(true));
    expect(result.current.collapsed).toBe(true);
  });

  it('persiste mudanca no localStorage', () => {
    const { result } = renderHook(() => useSidebarCollapsed());

    act(() => result.current.toggle());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

    act(() => result.current.toggle());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('ignora erro de localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
  });
});
