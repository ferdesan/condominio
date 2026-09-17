import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost, tokenStorage } from '@/lib/api';
import { RenderResult, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeAuthUser } from '@/test/fixtures';
import type { LoginResponse } from '@/types/api';
import { AuthProvider } from '../auth-provider';
import { useAuth } from '@/hooks/use-auth';

/**
 * O refrescamento em si — uma rajada de 401 compartilhando uma unica chamada de
 * refresh, a reexecucao da requisicao e o `auth:session-expired` quando o refresh
 * morre — e testado no transporte, em `lib/api.test.ts` (UT-046, UT-047, UT-051).
 * Aqui mora o que o transporte nao toca: a restauracao de sessao do boot, o
 * estado da sessao durante ela e o login/logout/updateUser da interface.
 */
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
  };
});

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);

const admin = makeAuthUser({ role: 'ADMIN', permissions: ['*'] });

/** Consumidor que expoe o contexto para o caso. */
function Probe() {
  const { user, initializing, isAuthenticated, login, logout, updateUser, can } = useAuth();
  return (
    <div>
      <p data-testid="initializing">{String(initializing)}</p>
      <p data-testid="authenticated">{String(isAuthenticated)}</p>
      <p data-testid="role">{user?.role ?? 'none'}</p>
      <button
        type="button"
        onClick={() => void login('admin@exemplo.com', 'segredo')}
      >
        login
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
      <button
        type="button"
        onClick={() => user && updateUser({ ...user, role: 'RESIDENT' })}
      >
        update
      </button>
      <p data-testid="can">{String(can('role:read'))}</p>
    </div>
  );
}

let view: RenderResult;

function renderProvider(): RenderResult {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider (IT-054)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStorage.clear();
  });

  afterEach(() => {
    view.unmount();
  });

  it('inicia desautenticado sem char por token guardado', async () => {
    view = renderProvider();

    // Sem token, a revalidacao nem sai: nada de /auth/me.
    expect(screen.getByTestId('initializing').textContent).toBe('false');
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('restaura a sessao quando ha token, sem sacudir a tela', async () => {
    tokenStorage.set('access-1', 'refresh-1');
    mockGet.mockResolvedValue(admin);

    view = renderProvider();

    // A tela fica fechada o tempo do round-trip (FullPageLoader do guarda).
    expect(screen.getByTestId('initializing').textContent).toBe('true');
    expect(screen.getByTestId('authenticated').textContent).toBe('false');

    await waitFor(() => expect(screen.getByTestId('initializing').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('role').textContent).toBe('ADMIN');
    expect(mockGet).toHaveBeenCalledWith('/auth/me');
  });

  it('descarta um token rejeitado pelo servidor', async () => {
    tokenStorage.set('stale', 'refresh-1');
    mockGet.mockRejectedValue(new Error('unauthorized'));

    view = renderProvider();

    await waitFor(() => expect(screen.getByTestId('initializing').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(tokenStorage.accessToken).toBeNull();
    expect(tokenStorage.refreshToken).toBeNull();
  });

  it('login registra os tokens e o usuario; logout encerra a sessao', async () => {
    mockPost.mockResolvedValue({ user: admin, tokens: { accessToken: 'a2', refreshToken: 'r2' } } satisfies LoginResponse);

    view = renderProvider();
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));
    expect(tokenStorage.accessToken).toBe('a2');
    expect(screen.getByTestId('role').textContent).toBe('ADMIN');

    mockPost.mockResolvedValue({});
    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
    expect(tokenStorage.accessToken).toBeNull();
    // O refresh e entregue ao servidor (rota de logout), mesmo no caminho feliz.
    expect(mockPost).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'r2' });
  });

  it('logout segue encerrando quando o servidor ja nao reconhece a sessao', async () => {
    mockPost.mockRejectedValueOnce(new Error('invalid refresh'));
    tokenStorage.set('a', 'r');

    view = renderProvider();
    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
    await waitFor(() => expect(tokenStorage.accessToken).toBeNull());
    expect(screen.getByTestId('role').textContent).toBe('none');
  });

  it('updateUser atualiza o perfil no lugar, sem refetch', async () => {
    tokenStorage.set('access-1', 'refresh-1');
    mockGet.mockResolvedValue(admin);

    view = renderProvider();
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('ADMIN'));

    fireEvent.click(screen.getByText('update'));

    expect(screen.getByTestId('role').textContent).toBe('RESIDENT');
    // O perfil ja veio do servidor; uma segunda ida a /auth/me era o defeito.
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('o evento de sessao expirada do transporte derruba a sessao local', async () => {
    tokenStorage.set('access-1', 'refresh-1');
    mockGet.mockResolvedValue(admin);

    view = renderProvider();
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    window.dispatchEvent(new CustomEvent('auth:session-expired'));

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
    expect(tokenStorage.accessToken).toBeNull();
  });
});