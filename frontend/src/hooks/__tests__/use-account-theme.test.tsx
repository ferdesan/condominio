/**
 * UT-028 — adocao do tema da conta por `useAccountTheme`.
 *
 * So adota quando o dispositivo nunca escolheu (`hasDeviceChoice` falso) e so
 * uma vez por montagem (o trinco). Estados do caso:
 *  - UT-028: conta com tema e dispositivo sem escolha -> adota no boot.
 *  - UT-028.E1: dispositivo ja escolheu -> a escolha do dispositivo vence.
 *  - UT-028.E2: apos adotar, mudancas nos efeitos nao reaplicam (trinco).
 *
 * Nota de interpretacao: "re-monta" aqui quer dizer "o efeito volta a rodar
 * dentro da mesma montagem" — uma montagem nova reseta o trinco de proposito,
 * porque e assim que a adocao volta a funcionar no proximo boot do dispositivo
 * (US-020.AC-1). Senao o recurso morreria no primeiro reload.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { ThemeProvider } from '@/providers/theme-provider';
import { makeAuthUser } from '@/test/fixtures';
import type { AuthUser } from '@/types/api';
import { useTheme } from '@/hooks/use-theme';
import { useAccountTheme } from '../use-account-theme';

const STORAGE_KEY = 'condomínio.theme';

function authValue(user: AuthUser | null): AuthContextValue {
  return {
    user,
    initializing: false,
    isAuthenticated: Boolean(user),
    login: async () => undefined,
    logout: async () => undefined,
    updateUser: () => undefined,
    can: () => false,
  };
}

/**
 * O usuario do caso vive num fecho, e nao numa prop do wrapper: o `renderHook`
 * so conhece `{ children }` como props do wrapper, e a troca de usuario do caso
 * E2 precisa ser visivel no `rerender` seguinte.
 */
function createHarness(getUser: () => AuthUser | null) {
  function Harness({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={authValue(getUser())}>
        <ThemeProvider>{children}</ThemeProvider>
      </AuthContext.Provider>
    );
  }
  return Harness;
}

describe('useAccountTheme (UT-028)', () => {
  it('UT-028: adota o tema da conta num dispositivo que nunca escolheu', async () => {
    const getUser = () => makeAuthUser({ role: 'ADMIN', preferences: { theme: 'dark' } });

    const { result } = renderHook(
      () => {
        useAccountTheme();
        return useTheme();
      },
      { wrapper: createHarness(getUser) },
    );

    // A adocao acontece no efeito, que o renderHook ja aplica: sem escolha
    // guardada no dispositivo, o tema da conta passa a valer e e persistido.
    await waitFor(() => expect(result.current.theme).toBe('dark'));
    expect(result.current.hasDeviceChoice).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('UT-028.E1: a escolha já guardada no dispositivo vence a da conta', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const getUser = () => makeAuthUser({ role: 'ADMIN', preferences: { theme: 'dark' } });

    const { result } = renderHook(
      () => {
        useAccountTheme();
        return useTheme();
      },
      { wrapper: createHarness(getUser) },
    );

    // Os efeitos rodam e podem decidir adotar; o trinco/condicao deve impedir.
    await act(async () => {});
    expect(result.current.hasDeviceChoice).toBe(true);
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('UT-028.E2: após adotar, o efeito não reaplica ao mudar as dependências', async () => {
    let user: AuthUser = makeAuthUser({ role: 'ADMIN', preferences: { theme: 'dark' } });

    const { result, rerender } = renderHook(
      () => {
        useAccountTheme();
        return useTheme();
      },
      { wrapper: createHarness(() => user) },
    );

    await waitFor(() => expect(result.current.theme).toBe('dark'));

    // `preferred` muda de `dark` para `light`, entao o efeito volta a rodar —
    // mas o trinco impede a reaplicacao: o tema permanece o adotado.
    user = makeAuthUser({ role: 'ADMIN', preferences: { theme: 'light' } });
    rerender();
    await act(async () => {});

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });
});
