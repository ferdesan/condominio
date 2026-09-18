/**
 * O que acontece quando o servidor discorda da tela.
 *
 * A guarda do cliente e de experiencia; a autoridade e o servidor (TechSpec,
 * "Autorisacao"). Onde as duas divergem a recusa precisa aparecer — uma acao que
 * falha em silencio e pior do que uma acao que nao existe. E o 401 e o caso
 * oposto: ele nao e uma recusa da acao, e a sessao que acabou, entao apresenta-lo
 * como falha da acao culpa o usuario por algo que nao foi ele.
 */

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGet, tokenStorage } from '@/lib/api';
import { AuthProvider } from '@/providers/auth-provider';
import { CondominiumContext } from '@/providers/condominium-context';
import { QueryProvider } from '@/providers/query-provider';
import { ProtectedRoute } from '@/routes/protected-route';
import { CondominiumsPage } from '@/features/condominiums/condominiums-page';
import { CondominiumDetailPage } from '@/features/condominiums/condominium-detail-page';
import { makeAuthUser, makeCondominium } from '@/test/fixtures';
import { serveAll } from '@/test/api-double';
import { clickTrigger, render, renderWithProviders, screen, waitFor } from '@/test/render';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiGet: vi.fn(),
    apiGetPaginated: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

const mockDelete = vi.mocked(apiDelete);
const mockGet = vi.mocked(apiGet);
const mockToastError = vi.mocked(toast.error);

const AURORA = makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' });

/** Abre a confirmacao de exclusao e confirma. */
async function deleteAurora(): Promise<void> {
  clickTrigger(await screen.findByRole('button', { name: 'Excluir Residencial Aurora' }));
  clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  serveAll({ condominiums: [AURORA] });
});

describe('Recusa do servidor a uma ação oferecida', () => {
  it('IT-178: um 403 numa ação oferecida aparece, em vez de falhar em silencio', async () => {
    const message = 'Você não tem permissao para excluir este condomínio.';
    mockDelete.mockRejectedValue(new ApiError(message, 403, 'FORBIDDEN'));

    renderWithProviders(<CondominiumsPage />, { permissions: ['condominium:manage'] });
    await deleteAurora();

    // A acao de linha nao traz `onError` proprio, entao herda o toast global —
    // que e a apresentacao certa para uma recusa que so traz a mensagem.
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(message));

    // O registro continua na lista: a recusa nao pode parecer sucesso.
    expect(screen.getByText('Residencial Aurora')).toBeInTheDocument();
  });

  it('IT-178: a recusa leva a mensagem do servidor, e não uma generica', async () => {
    // Um 409 chega pelo mesmo caminho e e onde a mensagem do servidor mais
    // importa: so ela diz por que a exclusao foi barrada.
    const message = 'O condomínio possui unidades ativas e não pode ser excluido.';
    mockDelete.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));

    renderWithProviders(<CondominiumsPage />, { permissions: ['condominium:manage'] });
    await deleteAurora();

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(message));
  });
});

describe('Sessão expirada no meio de uma ação', () => {
  /**
   * A app de verdade nesta parte: o `AuthProvider` real escuta o evento que o
   * interceptor dispara, e e o guarda de rota que decide para onde ir. Um duble
   * de contexto nao exercitaria nenhum dos dois.
   */
  function SessionApp() {
    return (
      <QueryProvider>
        <AuthProvider>
          <CondominiumContext.Provider
            value={{
              condominiums: [AURORA],
              selected: AURORA,
              selectedId: AURORA.id,
              select: () => undefined,
              isLoading: false,
            }}
          >
            <MemoryRouter initialEntries={['/condominios']}>
              <Routes>
                <Route path="/login" element={<p>Entrar na plataforma</p>} />
                <Route element={<ProtectedRoute permission="condominium:read" />}>
                  <Route path="/condominios" element={<CondominiumsPage />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </CondominiumContext.Provider>
        </AuthProvider>
      </QueryProvider>
    );
  }

  it('IT-179: um 401 no meio da ação leva ao login sem toast de erro', async () => {
    tokenStorage.set('access', 'refresh');
    mockGet.mockImplementation(async (url) => {
      if (url === '/auth/me') {
        return makeAuthUser({ role: 'ADMIN', permissions: ['*'] }) as never;
      }
      throw new Error(`URL nao prevista no teste: ${url}`);
    });

    // O que o transporte de verdade faz quando o refresh tambem falha: avisa a
    // sessao perdida e devolve o 401 a quem pediu (`lib/api.ts`).
    mockDelete.mockImplementation(async () => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      throw new ApiError('Não autenticado.', 401, 'UNAUTHORIZED');
    });

    render(<SessionApp />);
    await deleteAurora();

    // O usuario volta para o login...
    expect(await screen.findByText('Entrar na plataforma')).toBeInTheDocument();
    // ...e nada o acusa de ter falhado numa acao que ele nao chegou a fazer.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(tokenStorage.accessToken).toBeNull();
  });
});

describe('Registro fora do escopo por link direto', () => {
  /** A rota de detalhe e a unica que aceita identificador (ADR-004). */
  function renderDetail(id: string) {
    return renderWithProviders(
      <Routes>
        <Route path="/condominios/:id" element={<CondominiumDetailPage />} />
      </Routes>,
      { route: `/condominios/${id}`, permissions: ['condominium:manage'] },
    );
  }

  it('IT-181: um 403 no link direto rende o acesso negado, sem nada parcial', async () => {
    mockGet.mockRejectedValue(new ApiError('Acesso negado.', 403, 'FORBIDDEN'));

    renderDetail('cond-de-outro-tenant');

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
    // Nem o cadastro nem os indicadores aparecem pela metade.
    expect(
      screen.queryByText('Cadastro completo e indicadores operacionais.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Residencial Aurora')).not.toBeInTheDocument();
  });

  it('IT-181: um 404 no link direto rende o não encontrado, com volta para a lista', async () => {
    // Para quem chegou pelo link, o registro inexistente e o removido sao a
    // mesma coisa — e nenhum dos dois pode renderizar dado pela metade.
    mockGet.mockRejectedValue(new ApiError('Registro não encontrado.', 404, 'NOT_FOUND'));

    renderDetail('cond-inexistente');

    expect(await screen.findByText('Condomínio não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para a listagem' })).toBeInTheDocument();
    expect(screen.queryByText('Residencial Aurora')).not.toBeInTheDocument();
  });
});
