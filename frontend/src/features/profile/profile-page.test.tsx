import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api';
import { createUser, renderWithProviders, screen, waitFor, within } from '@/test/render';
import { ThemeProvider } from '@/providers/theme-provider';
import { ProfilePage } from './profile-page';
import {
  lastPostTo,
  lastProfilePatch,
  makeProfileWorld,
  makeSession,
  serveProfile,
  type ProfileWorld,
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
const mockPatch = vi.mocked(apiPatch);

let world: ProfileWorld;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  world = makeProfileWorld();
  serveProfile(world);
});

/**
 * A tela le o usuario do contexto, entao o harness precisa do mesmo objeto.
 *
 * O `ThemeProvider` entra por fora, como em `test/routes.test.tsx`: o harness
 * compartilhado nao o monta porque quase nenhuma tela isolada le o tema. Esta
 * le — o seletor de tema e um campo do formulario —, e em producao o provedor
 * vem de `App.tsx`, acima de tudo, exatamente nesta posicao. Com o
 * `localStorage` limpo a cada caso, o tema inicial e sempre `system`.
 */
function render(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <ThemeProvider>
      <ProfilePage />
    </ThemeProvider>,
    { user: world.user, ...options },
  );
}

function saveButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Salvar' });
}

describe('Dados pessoais', () => {
  it('carrega o formulario com o que a sessao ja conhece, sem ir ao servidor', async () => {
    render();

    expect(await screen.findByLabelText('Nome')).toHaveValue('Marina Alves');
    expect(screen.getByLabelText('Telefone')).toHaveValue('11988887777');
    // O `AuthUser` ja veio do boot: uma leitura extra de `/auth/me` so repetiria
    // o que o contexto tem.
    const urls = mockGet.mock.calls.map((call) => call[0]);
    expect(urls).not.toContain('/auth/me');
  });

  it('salvar envia nome, telefone e tema, e avisa que gravou', async () => {
    const user = createUser();
    render();

    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Marina Alves Souza');
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/auth/me', expect.anything()));
    expect(lastProfilePatch()).toEqual({
      name: 'Marina Alves Souza',
      phone: '11988887777',
      preferences: { theme: 'system' },
    });
    await waitFor(() => expect(vi.mocked(toast.success)).toHaveBeenCalled());
  });

  it('telefone apagado vai como nulo, e nao como chave ausente', async () => {
    const user = createUser();
    render();

    await user.clear(await screen.findByLabelText('Telefone'));
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    // Chave ausente deixaria o valor antigo no banco: `updateProfile` so escreve
    // o que veio definido.
    expect(lastProfilePatch()).toMatchObject({ phone: null });
  });

  it('o botao so habilita depois de alguma mudanca', async () => {
    const user = createUser();
    render();

    expect(await saveButton()).toBeDisabled();

    await user.type(await screen.findByLabelText('Nome'), ' Souza');
    expect(await saveButton()).toBeEnabled();
  });

  it('nome curto demais e barrado antes de chegar ao servidor', async () => {
    const user = createUser();
    render();

    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Ma');
    await user.click(await saveButton());

    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('a recusa do servidor pousa no campo que a provocou', async () => {
    const user = createUser();
    mockPatch.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'UNPROCESSABLE_ENTITY', [
        { field: 'phone', message: 'Telefone invalido.' },
      ]),
    );
    render();

    await user.type(await screen.findByLabelText('Nome'), ' Souza');
    await user.click(await saveButton());

    expect(await screen.findByText('Telefone invalido.')).toBeInTheDocument();
  });

  it('e-mail e papel aparecem como leitura, sem campo editavel', async () => {
    render();

    expect(await screen.findByText('marina@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    // O servidor nao aceita nenhum dos dois em `updateProfileSchema`; um campo
    // desabilitado prometeria uma edicao que nao existe.
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Papel')).not.toBeInTheDocument();
  });
});

describe('Senha', () => {
  async function fillPassword(user: ReturnType<typeof createUser>): Promise<void> {
    await user.type(await screen.findByLabelText('Senha atual'), 'SenhaAtual1');
    await user.type(screen.getByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova1');
  }

  it('pede confirmacao antes de trocar, porque a troca desloga', async () => {
    const user = createUser();
    render();

    await fillPassword(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('Alterar a senha e sair?')).toBeInTheDocument();
    // Ainda nada foi enviado: a confirmacao e um passo de verdade.
    expect(lastPostTo('/auth/change-password')).toBeUndefined();
  });

  it('confirmada, envia so os dois campos que o servidor conhece', async () => {
    const user = createUser();
    render();

    await fillPassword(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
    await user.click(await screen.findByRole('button', { name: 'Alterar e sair' }));

    await waitFor(() => expect(lastPostTo('/auth/change-password')).toBeDefined());
    // `confirmPassword` e conferencia do cliente; o servidor nao a conhece.
    expect(lastPostTo('/auth/change-password')).toEqual({
      currentPassword: 'SenhaAtual1',
      newPassword: 'SenhaNova1',
    });
  });

  it('confirmacao divergente nao chega ao servidor', async () => {
    const user = createUser();
    render();

    await user.type(await screen.findByLabelText('Senha atual'), 'SenhaAtual1');
    await user.type(screen.getByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova2');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('As senhas nao conferem.')).toBeInTheDocument();
    expect(lastPostTo('/auth/change-password')).toBeUndefined();
  });

  it('nova senha igual a atual e barrada', async () => {
    const user = createUser();
    render();

    await user.type(await screen.findByLabelText('Senha atual'), 'SenhaIgual1');
    await user.type(screen.getByLabelText('Nova senha'), 'SenhaIgual1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaIgual1');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(
      await screen.findByText('A nova senha deve ser diferente da atual.'),
    ).toBeInTheDocument();
    expect(lastPostTo('/auth/change-password')).toBeUndefined();
  });

  it('senha fraca e barrada com a regra que faltou', async () => {
    const user = createUser();
    render();

    await user.type(await screen.findByLabelText('Senha atual'), 'SenhaAtual1');
    await user.type(screen.getByLabelText('Nova senha'), 'senhanova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'senhanova1');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(
      await screen.findByText('A senha deve conter ao menos uma letra maiuscula.'),
    ).toBeInTheDocument();
    expect(lastPostTo('/auth/change-password')).toBeUndefined();
  });

  it('401 aqui e senha atual errada, e nao sessao expirada', async () => {
    const user = createUser();
    mockPost.mockImplementation(async (url) => {
      if (url === '/auth/change-password') {
        throw new ApiError('Senha atual incorreta.', 401, 'UNAUTHORIZED');
      }
      return undefined as never;
    });
    render();

    await fillPassword(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
    await user.click(await screen.findByRole('button', { name: 'Alterar e sair' }));

    // Apontada ao campo, e nao transformada num aviso geral de sessao.
    expect(await screen.findByText('Senha atual incorreta.')).toBeInTheDocument();
  });
});

describe('Sessoes ativas', () => {
  it('lista o que o servidor devolveu', async () => {
    world.sessions = [
      makeSession({ id: 'session-1', ipAddress: '200.10.0.1' }),
      makeSession({
        id: 'session-2',
        ipAddress: null,
        userAgent: 'Mozilla/5.0 (iPhone) Version/17.0 Safari/605.1',
      }),
    ];
    render();

    expect(await screen.findByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('Safari')).toBeInTheDocument();
    expect(screen.getByText('200.10.0.1')).toBeInTheDocument();
    // Sem IP o traco diz "nao informado", e nao "veio de lugar nenhum".
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('nao oferece encerrar uma sessao isolada, porque o servidor nao oferece', async () => {
    render();

    await screen.findByText('Chrome');
    const table = screen.getByRole('table');
    expect(within(table).queryByRole('button')).not.toBeInTheDocument();
  });

  it('encerrar tudo pede confirmacao e so entao chama a rota', async () => {
    const user = createUser();
    render();

    await screen.findByText('Chrome');
    await user.click(screen.getByRole('button', { name: 'Encerrar todas as sessoes' }));

    expect(await screen.findByText('Encerrar todas as sessoes?')).toBeInTheDocument();
    expect(lastPostTo('/auth/logout-all')).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Encerrar tudo' }));
    await waitFor(() => expect(lastPostTo('/auth/logout-all')).toBeDefined());
  });

  it('sem nenhuma sessao o botao fica indisponivel', async () => {
    world.sessions = [];
    render();

    expect(await screen.findByText('Nenhuma sessao ativa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar todas as sessoes' })).toBeDisabled();
  });

  it('falha na leitura aparece na tela, e nao numa tabela vazia', async () => {
    // Um 4xx de proposito: o `retry` do QueryProvider nao repete erro de
    // cliente, entao o estado de erro aparece no primeiro ciclo. Com 5xx o caso
    // mediria o backoff da repeticao, e nao o que a tela mostra.
    mockGet.mockRejectedValue(new ApiError('Servico indisponivel.', 422, 'UNPROCESSABLE_ENTITY'));
    render();

    expect(await screen.findByText(/Nao foi possivel carregar as sessoes/)).toBeInTheDocument();
  });
});
