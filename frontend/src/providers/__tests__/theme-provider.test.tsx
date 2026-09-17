/**
 * UT-027 — persistencia e deteccao de tema do `ThemeProvider`.
 *
 * O valor persistido mora na chave `condominio.theme` (mesma chave da app inteira);
 * `_tests.md` nomeia a preferencia guardada como `theme`. O contrato e o
 * comportamento: escuro restaurado, valor invalido caindo no sistema, escolha
 * inexistente seguindo o `prefers-color-scheme`, e toggle/set.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../theme-provider';
import { useTheme } from '@/hooks/use-theme';

const STORAGE_KEY = 'condominio.theme';

/** Preenche a lacuna de matchMedia do jsdom com uma preferencia controlada. */
function setSystemPrefersDark(dark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-color-scheme') ? dark : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function ThemeHarness({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeProvider (UT-027)', () => {
  beforeEach(() => {
    setSystemPrefersDark(false);
  });

  it('UT-027: o tema escuro guardado no dispositivo e restaurado', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeHarness });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(result.current.hasDeviceChoice).toBe(true);
    // O efeito aplica a classe no documento; `waitFor` deixa o efeito acontecer.
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });

  it('UT-027.E1: valor invalido no storage cai na preferencia do sistema', () => {
    localStorage.setItem(STORAGE_KEY, 'azul-escuro');

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeHarness });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(result.current.hasDeviceChoice).toBe(false);
  });

  it('UT-027.E2: sem escolha guardada, segue o sistema', () => {
    setSystemPrefersDark(true);

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeHarness });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('UT-027.E3: o toggle alterna entre claro e escuro', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeHarness });
    expect(result.current.theme).toBe('light');

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });

  it('UT-027.E4: setTheme grava a escolha no lugar', () => {
    setSystemPrefersDark(false);

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeHarness });

    act(() => result.current.setTheme('dark'));

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(result.current.hasDeviceChoice).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });
});