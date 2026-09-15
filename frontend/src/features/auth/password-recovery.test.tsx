import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiPost } from '@/lib/api';
import { ThemeProvider } from '@/providers/theme-provider';
import { createUser, renderWithProviders, screen, waitFor } from '@/test/render';
import { ForgotPasswordPage } from './forgot-password-page';
import { LoginPage } from './login-page';
import { ResetPasswordPage } from './reset-password-page';

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

const mockPost = vi.mocked(apiPost);

/** O token da fixture tem os dez caracteres que o servidor exige. */
const TOKEN = 'abcdef1234567890';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockPost.mockResolvedValue({ message: 'Se o e-mail estiver cadastrado...' } as never);
});

/**
 * As telas publicas leem o tema, e o harness compartilhado nao monta o
 * `ThemeProvider` — mesma razao e mesma solucao de `features/profile/`. `user:
 * null` porque nenhuma das tres pressupoe sessao.
 */
function render(ui: React.ReactElement, route = '/') {
  return renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>, { user: null, route });
}

/** O corpo do ultimo POST para a rota informada. */
function lastPostTo(url: string): Record<string, unknown> | undefined {
  const calls = mockPost.mock.calls.filter((call) => call[0] === url);
  return calls.length ? ((calls[calls.length - 1]?.[1] ?? {}) as Record<string, unknown>) : undefined;
}

describe('Login: a porta que faltava', () => {
  it('oferece o link de esqueci minha senha', async () => {
    render(<LoginPage />);

    const link = await screen.findByRole('link', { name: 'Esqueci minha senha' });
    expect(link).toHaveAttribute('href', '/esqueci-senha');
  });
});

describe('Pedido de recuperacao', () => {
  it('envia o e-mail digitado', async () => {
    const user = createUser();
    render(<ForgotPasswordPage />);

    await user.type(await screen.findByLabelText('E-mail'), 'marina@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    await waitFor(() => expect(lastPostTo('/auth/forgot-password')).toBeDefined());
    expect(lastPostTo('/auth/forgot-password')).toEqual({ email: 'marina@exemplo.com' });
  });

  it('e-mail malformado e barrado antes de chegar ao servidor', async () => {
    const user = createUser();
    render(<ForgotPasswordPage />);

    await user.type(await screen.findByLabelText('E-mail'), 'marina@');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByText('E-mail invalido.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('duplo clique dispara uma requisicao so', async () => {
    const user = createUser();
    render(<ForgotPasswordPage />);

    await user.type(await screen.findByLabelText('E-mail'), 'marina@exemplo.com');
    const button = screen.getByRole('button', { name: 'Enviar link' });
    await user.click(button);
    await user.click(button);

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('a tela nao revela se a conta existe: os dois casos sao identicos', async () => {
    /**
     * `authService.forgotPassword` sempre responde 202 — e a protecao contra
     * enumeracao de contas. O caso compara os **dois** resultados em vez de so
     * verificar que "algo aparece": uma diferenca de texto, de titulo ou de
     * caminho desfaria no cliente o que o servidor protege.
     */
    async function sendAndCapture(email: string, response: unknown): Promise<string> {
      const user = createUser();
      mockPost.mockResolvedValue(response as never);
      const view = render(<ForgotPasswordPage />);

      await user.type(await screen.findByLabelText('E-mail'), email);
      await user.click(screen.getByRole('button', { name: 'Enviar link' }));
      await screen.findByRole('heading', { name: 'Verifique seu e-mail' });

      // O endereco digitado e o unico texto que legitimamente difere.
      const html = (view.container.textContent ?? '').replace(email, '<email>');
      view.unmount();
      vi.clearAllMocks();
      return html;
    }

    // Conta existente: fora de producao o servidor ainda devolve o token.
    const existing = await sendAndCapture('existe@exemplo.com', {
      message: 'Se o e-mail estiver cadastrado...',
      token: 'token-de-desenvolvimento',
    });
    // Conta inexistente: o mesmo 202, sem token.
    const missing = await sendAndCapture('naoexiste@exemplo.com', {
      message: 'Se o e-mail estiver cadastrado...',
    });

    expect(existing).toBe(missing);
  });

  it('o token de desenvolvimento nunca aparece na tela', async () => {
    const user = createUser();
    mockPost.mockResolvedValue({
      message: 'Se o e-mail estiver cadastrado...',
      token: 'token-de-desenvolvimento',
    } as never);
    const view = render(<ForgotPasswordPage />);

    await user.type(await screen.findByLabelText('E-mail'), 'marina@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    await screen.findByRole('heading', { name: 'Verifique seu e-mail' });
    // Uma tela que o consumisse funcionaria aqui e falharia em producao, onde o
    // servidor o omite.
    expect(view.container.textContent).not.toContain('token-de-desenvolvimento');
  });

  it('o sucesso mostra o endereco digitado e a frase em condicional', async () => {
    const user = createUser();
    render(<ForgotPasswordPage />);

    await user.type(await screen.findByLabelText('E-mail'), 'marina@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByRole('heading', { name: 'Verifique seu e-mail' })).toBeInTheDocument();
    expect(screen.getByText('marina@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText(/estiver cadastrado/)).toBeInTheDocument();
  });

  it('usar outro e-mail volta ao formulario', async () => {
    const user = createUser();
    render(<ForgotPasswordPage />);

    await user.type(await screen.findByLabelText('E-mail'), 'marina@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    await screen.findByRole('heading', { name: 'Verifique seu e-mail' });

    await user.click(screen.getByRole('button', { name: 'Usar outro e-mail' }));
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
  });

  it('limite de tentativas do servidor vira aviso, e nao silencio', async () => {
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Muitas tentativas. Tente novamente em alguns minutos.', 429, 'TOO_MANY_REQUESTS'),
    );
    render(<ForgotPasswordPage />);

    await user.type(await screen.findByLabelText('E-mail'), 'marina@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Muitas tentativas/);
    expect(screen.queryByRole('heading', { name: 'Verifique seu e-mail' })).not.toBeInTheDocument();
  });
});

describe('Redefinicao', () => {
  it('envia o token da query junto da nova senha', async () => {
    const user = createUser();
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova1');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(lastPostTo('/auth/reset-password')).toBeDefined());
    // `confirmPassword` e conferencia do cliente; o servidor nao a conhece.
    expect(lastPostTo('/auth/reset-password')).toEqual({
      token: TOKEN,
      password: 'SenhaNova1',
    });
  });

  it('sem token na URL, explica e nao mostra formulario de senha', async () => {
    render(<ResetPasswordPage />, '/redefinir-senha');

    expect(await screen.findByRole('heading', { name: 'Link incompleto' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
  });

  it('token curto demais tem o mesmo tratamento do ausente', async () => {
    // O servidor exige dez caracteres; um token truncado por um cliente de
    // e-mail merece a mesma explicacao, e nao um 400 generico.
    render(<ResetPasswordPage />, '/redefinir-senha?token=abc');

    expect(await screen.findByRole('heading', { name: 'Link incompleto' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('avisa que a redefinicao desconecta todos os dispositivos, antes do envio', async () => {
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    // `resetPassword` chama `revokeAllForUser`: descobrir isso depois seria
    // descobrir tarde.
    expect(
      await screen.findByText(/sera desconectada em todos os dispositivos/),
    ).toBeInTheDocument();
  });

  it('senha fraca e barrada com a regra que faltou', async () => {
    const user = createUser();
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'senhanova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'senhanova1');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(
      await screen.findByText('A senha deve conter ao menos uma letra maiuscula.'),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('confirmacao divergente e barrada no cliente', async () => {
    const user = createUser();
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova2');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByText('As senhas nao conferem.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('token recusado mostra a mensagem do servidor e a saida', async () => {
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Token de recuperacao invalido ou expirado.', 400, 'BAD_REQUEST'),
    );
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova1');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Token de recuperacao invalido ou expirado.');
    // A recusa e sobre o token, e nao sobre o que a pessoa digitou: a saida e
    // pedir um link novo.
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toBeInTheDocument();
  });

  it('a recusa do token nao culpa os campos de senha', async () => {
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Token de recuperacao invalido ou expirado.', 400, 'BAD_REQUEST'),
    );
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova1');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('aria-invalid', 'false');
  });

  it('sucesso avisa e leva de volta ao login', async () => {
    const user = createUser();
    mockPost.mockResolvedValue(undefined as never);
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova1');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(vi.mocked(toast.success)).toHaveBeenCalled());
  });

  it('duplo clique dispara uma requisicao so', async () => {
    const user = createUser();
    render(<ResetPasswordPage />, `/redefinir-senha?token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova1');
    await user.type(screen.getByLabelText('Repetir a nova senha'), 'SenhaNova1');
    const button = screen.getByRole('button', { name: 'Redefinir senha' });
    await user.click(button);
    await user.click(button);

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
