import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiGet, apiPost, tokenStorage } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import type { AuthUser, LoginResponse } from '@/types/api';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Boot: so revalida se houver token guardado, evitando um 401 desnecessario.
  useEffect(() => {
    let active = true;

    async function restoreSession(): Promise<void> {
      if (!tokenStorage.accessToken) {
        if (active) setInitializing(false);
        return;
      }
      try {
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
      await apiPost('/auth/logout', { refreshToken: tokenStorage.refreshToken });
    } catch {
      // Sessao ja invalida no servidor: encerrar localmente basta.
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const can = useCallback(
    (permission?: string) => hasPermission(user?.permissions ?? [], permission),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, isAuthenticated: Boolean(user), login, logout, can }),
    [user, initializing, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
