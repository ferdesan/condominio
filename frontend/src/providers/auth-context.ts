import { createContext } from 'react';
import type { AuthUser } from '@/types/api';

export type AuthContextValue = {
  user: AuthUser | null;
  /** True enquanto a sessao guardada ainda esta sendo revalidada no boot. */
  initializing: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Substitui o usuario da sessao pelo que o servidor acabou de devolver.
   *
   * Existe para o perfil: `PATCH /auth/me` responde com o `AuthUser` inteiro, e
   * sem isto a topbar continuaria mostrando o nome antigo ate o proximo boot.
   * Nao busca nada — quem chama ja tem a resposta em maos.
   */
  updateUser: (user: AuthUser) => void;
  can: (permission?: string) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
