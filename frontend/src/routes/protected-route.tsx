import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { FullPageLoader } from '@/features/misc/full-page-loader';
import { ForbiddenPage } from '@/features/misc/forbidden-page';

/**
 * Exige sessao valida e, quando informada, a permissao da rota. A checagem aqui
 * e de experiencia: o backend continua sendo a autoridade em cada requisicao.
 */
export function ProtectedRoute({ permission }: { permission?: string }) {
  const { isAuthenticated, initializing, can } = useAuth();
  const location = useLocation();

  // Sem esperar a revalidacao, um F5 jogaria o usuario logado para o login.
  if (initializing) return <FullPageLoader label="Restaurando sessão" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!can(permission)) return <ForbiddenPage />;

  return <Outlet />;
}
