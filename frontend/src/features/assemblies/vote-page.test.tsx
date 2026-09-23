/**
 * A tela de voto na rota propria `/votacoes/:pollId` (ADR-001).
 *
 * O parametro entra montando um `<Routes>` local com a mesma guarda da
 * producao (`ProtectedRoute permission="vote:read"`), como
 * `balancete-page.test.tsx` faz. A existencia da rota no roteador de verdade e
 * afirmada em `routes.test.tsx` (UT-137 / IT-391 / IT-392); aqui o alvo e a
 * pagina e seus estados.
 */

import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGet, apiPost, tokenStorage } from '@/lib/api';
import { AuthProvider } from '@/providers/auth-provider';
import { CondominiumContext } from '@/providers/condominium-context';
import { QueryProvider } from '@/providers/query-provider';
import { ProtectedRoute } from '@/routes/protected-route';
import { resolveActionUrl } from '@/features/notifications/notification-links';
import { makeAuthUser, makeCondominium } from '@/test/fixtures';
import {
  createUser,
  fireEvent,
  render,
  renderWithProviders,
  screen,
  waitFor,
  within,
  type RenderWithProvidersOptions,
} from '@/test/render';
import { VotePage } from './vote-page';
import {
  makeOpenPoll,
  makePoll,
  makePollResults,
  serveAssemblies,
  type AssemblyWorld,
} from './test-utils';

// O duble fica so na camada de transporte (ADR-010); `ApiError` continua real.
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

/** Mesmo custo de portal do Radix medido nas demais telas. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);
const mockToastError = vi.mocked(toast.error);

let world: AssemblyWorld;

const POLL_TITLE = 'Aprovação das contas de 2025';
const AURORA = makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' });

/**
 * Monta a pagina com a mesma guarda da producao.
 *
 * `vote:read` e a guarda da rota (ADR-001); os casos que exercitam a guarda
 * sobrescrevem `permissions`.
 */
function renderVote(options: RenderWithProvidersOptions = {}) {
  return renderWithProviders(
    <Routes>
      <Route element={<ProtectedRoute permission="vote:read" />}>
        <Route path="/votacoes/:pollId" element={<VotePage />} />
      </Route>
    </Routes>,
    { route: '/votacoes/poll-1', condominium: AURORA, condominiums: [AURORA], ...options },
  );
}

/** Seleciona a primeira alternativa e envia. */
async function voteFirstOption(): Promise<void> {
  const user = createUser();
  await user.click(await screen.findByLabelText('Aprovo'));
  await user.click(screen.getByRole('button', { name: 'Enviar voto' }));
}

/** So as leituras da pagina, sem POST. */
function serveOpenVotable(extra: Partial<AssemblyWorld> = {}): AssemblyWorld {
  return serveAssemblies({
    polls: [makeOpenPoll()],
    myVote: { voted: false },
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('VotePage — estados de carregamento e acesso', () => {
  it('IT-347: votacao aberta votavel mostra titulo, alternativas e envia para a rota de voto', async () => {
    serveOpenVotable();
    mockPost.mockResolvedValue(makePollResults() as never);
    renderVote();

    expect(await screen.findByRole('heading', { level: 1, name: POLL_TITLE })).toBeInTheDocument();
    expect(screen.getByLabelText('Aprovo')).toBeInTheDocument();
    expect(screen.getByLabelText('Rejeito')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para as assembleias' })).toHaveAttribute(
      'href',
      '/assembleias',
    );

    await voteFirstOption();

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/polls/poll-1/vote', { optionId: 'option-1' }),
    );
    expect(await screen.findByText('Voto registrado')).toBeInTheDocument();
  });

  it('IT-349: sem vote:read na rota o acesso e negado, sem formulario', async () => {
    serveOpenVotable();
    renderVote({ permissions: ['assembly:read', 'poll:read'] });

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
    expect(screen.queryByText(POLL_TITLE)).not.toBeInTheDocument();
  });

  it('IT-350: votacao inexistente mostra o nao-encontrado, com volta para as assembleias', async () => {
    serveAssemblies({ polls: [] });
    renderVote();

    expect(await screen.findByText('Votação não encontrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para as assembleias' })).toHaveAttribute(
      'href',
      '/assembleias',
    );
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
  });

  it('IT-351: votacao fechada mostra o nao-aberta e nao oferece envio', async () => {
    serveAssemblies({
      polls: [makePoll({ status: 'CLOSED' })],
      myVote: { voted: false },
    });
    renderVote();

    expect(await screen.findByText('Votação não está aberta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Aprovo')).not.toBeInTheDocument();
  });

  it('IT-352: aberta mas fora da janela mostra o periodo, sem envio', async () => {
    serveAssemblies({
      polls: [makeOpenPoll({ endsAt: '2026-01-01T00:00:00.000Z' })],
      myVote: { voted: false },
    });
    renderVote();

    expect(await screen.findByText('Votação fora do período de votação')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
  });

  it('IT-353: sessao expirada no boot das leituras leva ao login', async () => {
    /*
      App de verdade nesta parte: AuthProvider real escuta o evento que o
      transporte dispara, e o guarda de rota decide para onde ir — um duble de
      contexto nao exercitaria nenhum dos dois (molde IT-179).
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
              <MemoryRouter initialEntries={['/votacoes/poll-1']}>
                <Routes>
                  <Route path="/login" element={<p>Entrar na plataforma</p>} />
                  <Route element={<ProtectedRoute permission="vote:read" />}>
                    <Route path="/votacoes/:pollId" element={<VotePage />} />
                  </Route>
                </Routes>
              </MemoryRouter>
            </CondominiumContext.Provider>
          </AuthProvider>
        </QueryProvider>
      );
    }

    tokenStorage.set('access', 'refresh');
    serveOpenVotable();
    mockGet.mockImplementation(async (url) => {
      if (url === '/auth/me') {
        return makeAuthUser({ role: 'ADMIN', permissions: ['*'] }) as never;
      }
      // O que o transporte de verdade faz quando o refresh tambem falha.
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      throw new ApiError('Não autenticado.', 401, 'UNAUTHORIZED');
    });

    const view = render(<SessionApp />);

    expect(await screen.findByText('Entrar na plataforma')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
    expect(tokenStorage.accessToken).toBeNull();
    view.unmount();
  });

  it('IT-355: recusa 403 do servidor aparece legivel, sem quebrar o formulario', async () => {
    serveOpenVotable();
    mockPost.mockRejectedValue(
      new ApiError('Apenas proprietarios podem votar nesta deliberacao.', 403, 'FORBIDDEN'),
    );
    renderVote();

    await voteFirstOption();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Apenas proprietarios podem votar nesta deliberacao.');
    // O formulario permanece: a recusa e do servidor, nao um estado da tela.
    expect(screen.getByRole('button', { name: 'Enviar voto' })).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('IT-357: no estado votavel o envio e um botao com nome acessivel', async () => {
    serveOpenVotable();
    const user = createUser();
    renderVote();

    // O botao existe desde a montagem, ainda desabilitado sem alternativa.
    expect(await screen.findByRole('button', { name: 'Enviar voto' })).toBeInTheDocument();

    // Com alternativa escolhida ele fica acionavel — o proxy de
    // alcancabilidade mobile e o controle com nome, e nao o viewport.
    await user.click(screen.getByLabelText('Aprovo'));
    const submit = screen.getByRole('button', { name: 'Enviar voto' });
    expect(submit).toBeEnabled();
    expect(submit.tagName).toBe('BUTTON');
  });
});

describe('VotePage — confirmacao e apuracao', () => {
  it('IT-362: envio bem-sucedido mostra a copia de confirmacao', async () => {
    serveOpenVotable();
    mockPost.mockResolvedValue(makePollResults() as never);
    renderVote();

    await voteFirstOption();

    expect(await screen.findByText('Voto registrado')).toBeInTheDocument();
    // A confirmacao e um status para leitores de tela.
    expect(screen.getByText('Voto registrado').closest('[role="status"]')).not.toBeNull();
  });

  it('IT-363: com poll:read a confirmacao traz a apuracao com participacao, quorum e barras', async () => {
    serveOpenVotable();
    mockPost.mockResolvedValue(makePollResults() as never);
    renderVote();

    await voteFirstOption();
    await screen.findByText('Voto registrado');

    const region = await screen.findByRole('region', { name: 'Apuração' });
    expect(within(region).getByText('30 de 48 unidades')).toBeInTheDocument();
    expect(within(region).getByText(/quorum atingido/)).toBeInTheDocument();
    expect(within(region).getByText('Aprovo')).toBeInTheDocument();
    expect(within(region).getByText('Rejeito')).toBeInTheDocument();
    expect(
      allResultsRequests().some((request) => request.url === '/polls/poll-1/results'),
    ).toBe(true);
  });

  it('IT-364: votacao secreta confirma sem caminho que exija exibir a escolha', async () => {
    serveOpenVotable({
      polls: [makeOpenPoll({ isSecret: true })],
      results: makePollResults(),
    });
    mockPost.mockResolvedValue(makePollResults() as never);
    renderVote();

    await voteFirstOption();

    expect(await screen.findByText('Voto registrado')).toBeInTheDocument();
    // A apuracao agregada continua; a escolha individual nao aparece.
    expect(await screen.findByRole('region', { name: 'Apuração' })).toBeInTheDocument();
    expect(screen.queryByText(/Opção escolhida/)).not.toBeInTheDocument();
  });

  it('IT-365: falha na apuracao mantem a confirmacao e expoe o erro da area de resultados', async () => {
    serveOpenVotable();
    // Erro de cliente (400): o retry do QueryProvider nao repete.
    const serveGet = mockGet.getMockImplementation();
    mockGet.mockImplementation(async (url) => {
      if (url === '/polls/poll-1/results') {
        throw new ApiError('Apuracao indisponivel.', 400, 'BAD_REQUEST');
      }
      return serveGet?.(url) as never;
    });
    mockPost.mockResolvedValue(makePollResults() as never);
    renderVote();

    await voteFirstOption();

    expect(await screen.findByText('Voto registrado')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a apuração desta deliberação.',
    );
    // A confirmacao nao e desfeita pela falha da apuracao.
    expect(screen.getByText('Voto registrado')).toBeInTheDocument();
  });

  it('IT-366: votacao apurada durante a leitura reexibe a apuracao de CLOSED', async () => {
    world = serveOpenVotable();
    mockPost.mockImplementation(async () => {
      // O mundo muda entre a leitura do POST e a da apuracao.
      const closed = makePollResults({ status: 'CLOSED' });
      world.results = closed;
      world.polls = [
        makeOpenPoll({ status: 'CLOSED', resultsPublishedAt: '2026-09-22T12:00:00.000Z' }),
      ];
      return closed as never;
    });
    renderVote();

    await voteFirstOption();
    await screen.findByText('Voto registrado');

    const region = await screen.findByRole('region', { name: 'Apuração' });
    expect(within(region).getByText('30 de 48 unidades')).toBeInTheDocument();
    // O rotulo de situacao acompanha a votacao refeita apos a invalidacao.
    expect(await screen.findByText('Apurada')).toBeInTheDocument();
  });

  it('IT-367: sem poll:read a confirmacao fica sozinha, sem bloco de apuracao nem spam de erro', async () => {
    serveOpenVotable();
    mockPost.mockResolvedValue(makePollResults() as never);
    renderVote({ permissions: ['vote:read', 'vote:create'] });

    await voteFirstOption();

    expect(await screen.findByText('Voto registrado')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Apuração' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe('VotePage — ja votou, conflito e sumiamento', () => {
  it('IT-354: my-vote dizendo que ja votou mostra o estado, sem segundo envio, com apuracao', async () => {
    serveAssemblies({
      polls: [makeOpenPoll()],
      myVote: { voted: true, optionId: 'option-1' },
    });
    renderVote();

    expect(await screen.findByText('Você já votou nesta votação')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Apuração' })).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-368: retorno com optionId nao-secreto reflete a escolha na mensagem', async () => {
    serveAssemblies({
      polls: [makeOpenPoll()],
      myVote: { voted: true, optionId: 'option-2', votedAt: '2026-09-22T10:00:00.000Z' },
    });
    renderVote();

    expect(await screen.findByText('Você já votou nesta votação')).toBeInTheDocument();
    expect(screen.getByText('Opção escolhida: Rejeito')).toBeInTheDocument();
  });

  it('IT-356: duplo envio — o segundo 409 nao duplica nem derruba a confirmacao', async () => {
    serveOpenVotable();
    mockPost
      .mockResolvedValueOnce(makePollResults() as never)
      .mockRejectedValueOnce(new ApiError('Voto ja registrado.', 409, 'CONFLICT'));
    renderVote();

    const user = createUser();
    await user.click(await screen.findByLabelText('Aprovo'));

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    // Envios imediatos, antes do primeiro resolver: o botao nao desabilita.
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Voto registrado')).toBeInTheDocument();
    // 409 e convergencia, nao erro: nenhum alerta nem toast.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
    // Uma confirmacao so — nao ha caminho de escrita duplicada na UI.
    expect(screen.getAllByText('Voto registrado')).toHaveLength(1);
  });

  it('IT-371: my-vote falso com POST 409 converge para ja-votou', async () => {
    serveOpenVotable();
    mockPost.mockRejectedValue(new ApiError('Voto ja registrado.', 409, 'CONFLICT'));
    renderVote();

    await voteFirstOption();

    expect(await screen.findByText('Você já votou nesta votação')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('409 de regra de negocio mostra a mensagem e nao vira ja-votou', async () => {
    serveOpenVotable();
    mockPost.mockRejectedValue(
      new ApiError('Esta votacao nao esta aberta.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderVote();

    await voteFirstOption();

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta votacao nao esta aberta.');
    expect(screen.queryByText('Você já votou nesta votação')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar voto' })).toBeInTheDocument();
  });

  it('IT-372: votacao some depois do voto — nao-encontrado, sem crash', async () => {
    world = serveOpenVotable();
    mockPost.mockImplementation(async () => {
      world.polls = [];
      return makePollResults() as never;
    });
    renderVote();

    await voteFirstOption();

    // A invalidacao refez o detalhe com 404; o 404 derruba ate a confirmacao.
    expect(await screen.findByText('Votação não encontrada')).toBeInTheDocument();
    expect(screen.queryByText('Voto registrado')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para as assembleias' })).toBeInTheDocument();
  });
});

describe('VotePage — deep-link de notificacao', () => {
  /** Sonda do login: expoe `state.from` sem depender da tela real. */
  function LoginProbe() {
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from;
    return <p>{from ? `Retorno para ${from}` : 'Entrar na plataforma'}</p>;
  }

  it('IT-389: link nao autenticado leva ao login preservando o destino de votacao', async () => {
    // O resolvedor entrega o caminho completo com id (ADR-006).
    const destination = resolveActionUrl('/votacoes/poll-1?from=push');
    expect(destination).toBe('/votacoes/poll-1');

    serveOpenVotable();
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route element={<ProtectedRoute permission="vote:read" />}>
          <Route path="/votacoes/:pollId" element={<VotePage />} />
        </Route>
      </Routes>,
      { route: destination ?? '/votacoes/poll-1', user: null, condominium: AURORA, condominiums: [AURORA] },
    );

    // Sem sessao a rota leva ao login; o pathname de origem viaja em `state.from`.
    expect(await screen.findByText('Retorno para /votacoes/poll-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
  });

  it('IT-390: link para votacao ja encerrada cai no estado fechado, sem crash', async () => {
    // Fechada "no clique": o deep-link resolve, a pagina abre, o servidor ja
    // devolve CLOSED.
    const destination = resolveActionUrl('/votacoes/poll-1');
    expect(destination).toBe('/votacoes/poll-1');

    serveAssemblies({
      polls: [makePoll({ status: 'CLOSED' })],
      myVote: { voted: false },
    });
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute permission="vote:read" />}>
          <Route path="/votacoes/:pollId" element={<VotePage />} />
        </Route>
      </Routes>,
      {
        route: destination ?? '/votacoes/poll-1',
        condominium: AURORA,
        condominiums: [AURORA],
      },
    );

    expect(await screen.findByText('Votação não está aberta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar voto' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: POLL_TITLE })).toBeInTheDocument();
  });
});

/** URLs de apuracao pedidas pela tela, para as asercoes de leitura. */
function allResultsRequests(): Array<{ url: string }> {
  return mockGet.mock.calls
    .map(([url]) => ({ url }))
    .filter((request) => request.url.endsWith('/results'));
}
