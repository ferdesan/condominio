import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
