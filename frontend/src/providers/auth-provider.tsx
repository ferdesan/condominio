import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiGet, apiPost, tokenStorage, trySilentLogin } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import type { AuthUser, LoginResponse } from '@/types/api';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Boot: access vive so em memoria, entao apos reload tenta o refresh via
  // cookie httpOnly antes de desistir — e so chama /auth/me se isso funcionar
  // (ou se o access ainda estiver na memoria da mesma sessao).
  useEffect(() => {
    let active = true;

    async function restoreSession(): Promise<void> {
      try {
        const restored = await trySilentLogin();
        if (!restored) {
          if (active) setInitializing(false);
          return;
        }
        const profile = await apiGet<AuthUser>('/auth/me');
        if (active) setUser(profile);
      } catch {
        tokenStorage.clear();
      } finally {
        if (active) setInitializing(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  // O interceptor do axios avisa quando o refresh falhou de vez.
  useEffect(() => {
    const onExpired = (): void => {
      tokenStorage.clear();
      setUser(null);
    };
    window.addEventListener('auth:session-expired', onExpired);
    return () => window.removeEventListener('auth:session-expired', onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiPost<LoginResponse>('/auth/login', { email, password });
    tokenStorage.set(result.tokens.accessToken, result.tokens.refreshToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      // O cookie httpOnly ja identifica a sessao; o corpo e opcional.
      await apiPost('/auth/logout', {});
    } catch {
      // Sessao ja invalida no servidor: encerrar localmente basta.
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  /**
   * O perfil ja recebeu o usuario atualizado do servidor; aqui so o contexto
   * passa a refleti-lo. Sem refetch de proposito: uma segunda ida a `/auth/me`
   * poderia responder antes da primeira e restaurar o valor antigo.
   */
  const updateUser = useCallback((next: AuthUser) => setUser(next), []);

  const can = useCallback(
    (permission?: string) => hasPermission(user?.permissions ?? [], permission),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isAuthenticated: Boolean(user),
      login,
      logout,
      updateUser,
      can,
    }),
    [user, initializing, login, logout, updateUser, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
