import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { screen, render } from '@testing-library/react';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { ProtectedRoute } from '../protected-route';

/** Reescreve a origem na tela de login, para conferir o `from` do redirect. */
function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? 'sem-origem';
  return <p>pagina de login (origem: {from})</p>;
}

type Value = Pick<AuthContextValue, 'initializing' | 'isAuthenticated' | 'can'>;

function renderProtected(
  value: Value,
  permission: string | undefined,
  path = '/lgpd',
): void {
  const authValue: AuthContextValue = {
    user: null,
    initializing: value.initializing,
    isAuthenticated: value.isAuthenticated,
    login: async () => undefined,
    logout: async () => undefined,
    updateUser: () => undefined,
    can: value.can,
  };

  function Harness({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </AuthContext.Provider>
    );
  }

  render(
    <Harness>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route element={<ProtectedRoute permission={permission} />}>
          <Route path={path} element={<p>conteudo protegido</p>} />
        </Route>
      </Routes>
    </Harness>,
  );
}

describe('ProtectedRoute (IT-055, UT-026)', () => {
  it('segura a tela enquanto a sessao e restaurada, mesmo com token', () => {
    renderProtected(
      { initializing: true, isAuthenticated: false, can: () => false },
      undefined,
    );

    // A tela inteira fica por tras: navegacao seria um pisca para o login.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Restaurando sessao')).toBeInTheDocument();
  });

  it('redireciona desautenticados para o login guardando a origem', () => {
    renderProtected(
      { initializing: false, isAuthenticated: false, can: () => false },
      'lgpd:read',
    );

    expect(screen.getByText(/pagina de login/)).toBeInTheDocument();
    expect(screen.getByText(/origem: \/lgpd/i)).toBeInTheDocument();
  });

  it('renderiza 403 quando a sessao nao tem a permissao da rota', () => {
    renderProtected(
      { initializing: false, isAuthenticated: true, can: () => false },
      'lgpd:read',
    );

    expect(screen.getByText('Acesso negado')).toBeInTheDocument();
    expect(screen.queryByText('conteudo protegido')).not.toBeInTheDocument();
  });

  it('libera o conteudo quando a permissao existe', async () => {
    renderProtected(
      { initializing: false, isAuthenticated: true, can: () => true },
      'lgpd:read',
    );

    expect(await screen.findByText('conteudo protegido')).toBeInTheDocument();
    expect(screen.queryByText(/pagina de login/)).not.toBeInTheDocument();
  });

  it('rotas sem permissao exigem sessao apenas', async () => {
    renderProtected(
      { initializing: false, isAuthenticated: true, can: () => true },
      undefined,
    );

    expect(await screen.findByText('conteudo protegido')).toBeInTheDocument();
  });
});