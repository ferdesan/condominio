import { createContext } from 'react';
import type { AuthUser } from '@/types/api';

export type AuthContextValue = {
  user: AuthUser | null;
  /** True enquanto a sessao guardada ainda esta sendo revalidada no boot. */
  initializing: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission?: string) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
