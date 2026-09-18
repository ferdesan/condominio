import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { makeCondominium, makeMeta } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { Condominium } from '@/types/api';
import { CondominiumsPage } from '../condominiums-page';

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

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

function serve(rows: Condominium[]): void {
  mockGetPaginated.mockResolvedValue({ data: rows, meta: makeMeta({ total: rows.length }) });
}

/** Corpo da ultima criacao pedida. */
function lastCreateBody(): Record<string, unknown> {
  return (mockPost.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

/** Corpo da ultima atualizacao pedida. */
function lastUpdateBody(): Record<string, unknown> {
  return (mockPatch.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

/** Abre o dialogo de cadastro e espera o formulario aparecer. */
async function openCreateDialog(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Novo condomínio' }));
  await screen.findByLabelText('Nome');
}

/** Abre o dialogo de edicao do registro e espera os valores carregados. */
async function openEditDialog(name: string): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Editar ${name}` }));
  await screen.findByLabelText('Nome');
}

/**
 * O botao de envio. O nome acessivel e casado por trecho porque o `Button`
 * acrescenta "Carregando" enquanto a requisicao esta no ar.
 */
function submitButton(label: 'Cadastrar' | 'Salvar'): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', {
    name: new RegExp(`${label}$`),
  });
}

function submit(label: 'Cadastrar' | 'Salvar'): void {
  clickTrigger(submitButton(label));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Cadastro de condomínio', () => {
  it('IT-010: cadastra, fecha o dialogo e atualiza a lista', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    const created = makeCondominium({ id: 'cond-9', name: 'Residencial Bosque' });
    mockPost.mockResolvedValue(created);

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    await user.type(screen.getByLabelText('CNPJ'), '12345678000199');
    serve([created]);
    submit('Cadastrar');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      '/condominiums',
      expect.objectContaining({ name: 'Residencial Bosque', document: '12345678000199' }),
    );
    expect(await screen.findByText('Residencial Bosque')).toBeInTheDocument();
  });

  it('IT-316: o saldo de abertura aceita virgula decimal e chega como numero', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    mockPost.mockResolvedValue(makeCondominium({ id: 'cond-8' }));

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Vertice');

    const balance = screen.getByLabelText('Saldo de abertura');
    await user.clear(balance);
    await user.type(balance, '1500,50');
    submit('Cadastrar');

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // `type="number"` engoliria a virgula e enviaria 150050 — cem vezes o valor.
    expect(lastCreateBody().openingBalance).toBe(1500.5);
  });

  it('IT-011: 409 de CNPJ duplicado aparece no formulário, sem marcar campo', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    mockPost.mockRejectedValue(
      new ApiError('Já existe um condomínio cadastrado com este CNPJ.', 409, 'CONFLICT'),
    );

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    submit('Cadastrar');

    expect(
      await screen.findByText('Já existe um condomínio cadastrado com este CNPJ.'),
    ).toBeInTheDocument();
    // Sem detalhe de campo, nenhum controle e marcado como invalido.
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
    // A mensagem inline substitui o toast global, nao soma a ele.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('IT-012: conflito com registro removido indica a restauração e preserva o preenchido', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    mockPost.mockRejectedValue(
      new ApiError('Já existe um condomínio cadastrado com este CNPJ.', 409, 'CONFLICT'),
    );

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    await user.type(screen.getByLabelText('CNPJ'), '12345678000199');
    submit('Cadastrar');

    await screen.findByText('Já existe um condomínio cadastrado com este CNPJ.');
    expect(screen.getByText(/restaure o registro/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Residencial Bosque');
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12345678000199');
  });

  it('IT-013: recusa por limite de plano mostra a mensagem do servidor', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    const message = 'O plano BASIC permite até 1 condomínio(s). Faca upgrade para cadastrar mais.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE_VIOLATION'));

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    submit('Cadastrar');

    expect(await screen.findByText(message)).toBeInTheDocument();
    // Conflito de unicidade e violacao de regra usam o mesmo status; so o
    // primeiro tem restauracao como saida.
    expect(screen.queryByText(/restaure o registro/i)).not.toBeInTheDocument();
  });

  it('IT-014: nome curto e dia de vencimento fora da faixa param antes da requisição', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Ab');
    await user.clear(screen.getByLabelText('Dia de vencimento'));
    await user.type(screen.getByLabelText('Dia de vencimento'), '29');
    submit('Cadastrar');

    expect(await screen.findByText('Informe o nome do condomínio.')).toBeInTheDocument();
    expect(screen.getByText('O dia de vencimento deve estar entre 1 e 28.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-015: CNPJ de 13 digitos e recusado no próprio campo', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    await user.type(screen.getByLabelText('CNPJ'), '1234567800019');
    submit('Cadastrar');

    expect(await screen.findByText('CNPJ deve conter 14 digitos.')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveAttribute('aria-invalid', 'true');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-016: dois cliques seguidos produzem uma única requisição', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    let release!: (value: Condominium) => void;
    mockPost.mockImplementation(
      () =>
        new Promise<Condominium>((resolve) => {
          release = resolve;
        }),
    );

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    submit('Cadastrar');
    submit('Cadastrar');

    await waitFor(() => expect(submitButton('Cadastrar')).toBeDisabled());
    expect(mockPost).toHaveBeenCalledTimes(1);

    release(makeCondominium({ id: 'cond-9', name: 'Residencial Bosque' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('IT-017: descartar formulário alterado pede confirmação; o intocado fecha direto', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    await openCreateDialog();
    clickTrigger(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument());
    expect(screen.queryByText('Descartar alterações?')).not.toBeInTheDocument();

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    clickTrigger(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByText('Descartar alterações?')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Residencial Bosque');

    clickTrigger(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument());
  });

  it('IT-018: falha de rede mantem o preenchido e relata o erro', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    mockPost.mockRejectedValue(
      new ApiError('Não foi possível concluir a operação.', 0, 'NETWORK_ERROR'),
    );

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    await user.type(screen.getByLabelText('Cidade'), 'Campinas');
    submit('Cadastrar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a operação.',
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Residencial Bosque');
    expect(screen.getByLabelText('Cidade')).toHaveValue('Campinas');
  });

  it('IT-019: UF digitada em caixa baixa e enviada em caixa alta', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Nenhum condomínio cadastrado');

    mockPost.mockResolvedValue(makeCondominium({ id: 'cond-9' }));

    await openCreateDialog();
    await user.type(screen.getByLabelText('Nome'), 'Residencial Bosque');
    await user.type(screen.getByLabelText('UF'), 'sp');
    submit('Cadastrar');

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody().state).toBe('SP');
  });
});

describe('Edição de condomínio', () => {
  const record = makeCondominium();

  it('IT-020: edita o telefone e a lista reflete a mudança', async () => {
    serve([record]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');
    const listCallsBefore = mockGetPaginated.mock.calls.length;

    const updated = makeCondominium({ phone: '11955554444' });
    mockPatch.mockResolvedValue(updated);

    await openEditDialog('Residencial Aurora');
    // Os campos chegam preenchidos com os valores atuais.
    expect(screen.getByLabelText('Nome')).toHaveValue('Residencial Aurora');

    await user.clear(screen.getByLabelText('Telefone'));
    await user.type(screen.getByLabelText('Telefone'), '11955554444');
    serve([updated]);
    submit('Salvar');

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith('/condominiums/cond-1', expect.anything());
    expect(lastUpdateBody().phone).toBe('11955554444');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A lista nao fica com o valor velho: a mutacao invalida a consulta.
    await waitFor(() =>
      expect(mockGetPaginated.mock.calls.length).toBeGreaterThan(listCallsBefore),
    );
  });

  it('IT-021: 409 na edição mantem o dialogo aberto com o que foi digitado', async () => {
    serve([record]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    mockPatch.mockRejectedValue(
      new ApiError('Já existe um condomínio cadastrado com este CNPJ.', 409, 'CONFLICT'),
    );

    await openEditDialog('Residencial Aurora');
    await user.clear(screen.getByLabelText('CNPJ'));
    await user.type(screen.getByLabelText('CNPJ'), '98765432000188');
    submit('Salvar');

    await screen.findByText('Já existe um condomínio cadastrado com este CNPJ.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveValue('98765432000188');
  });

  it('IT-022: 404 na edição fecha o dialogo e recarrega a lista', async () => {
    serve([record]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');
    const listCallsBefore = mockGetPaginated.mock.calls.length;

    mockPatch.mockRejectedValue(new ApiError('Condomínio não encontrado.', 404, 'NOT_FOUND'));

    await openEditDialog('Residencial Aurora');
    await user.type(screen.getByLabelText('Nome'), ' II');
    serve([]);
    submit('Salvar');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(mockGetPaginated.mock.calls.length).toBeGreaterThan(listCallsBefore),
    );
    expect(await screen.findByText('Nenhum condomínio cadastrado')).toBeInTheDocument();
  });

  it('IT-023: a última escrita vence e a lista recarregada mostra o valor do servidor', async () => {
    serve([record]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    // Outro usuario ja renomeou o registro; esta edicao e feita sobre valores
    // velhos e mesmo assim e aceita.
    const serverVersion = makeCondominium({ name: 'Residencial Aurora Nova' });
    mockPatch.mockResolvedValue(serverVersion);

    await openEditDialog('Residencial Aurora');
    await user.clear(screen.getByLabelText('Cidade'));
    await user.type(screen.getByLabelText('Cidade'), 'Campinas');
    serve([serverVersion]);
    submit('Salvar');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Residencial Aurora Nova')).toBeInTheDocument();
  });

  it('IT-024: campo opcional limpo e enviado vazio, e não omitido', async () => {
    serve([record]);
    const user = createUser();
    renderWithProviders(<CondominiumsPage />);
    await screen.findByText('Residencial Aurora');

    mockPatch.mockResolvedValue(makeCondominium({ email: null }));

    await openEditDialog('Residencial Aurora');
    expect(screen.getByLabelText('E-mail')).toHaveValue('contato@aurora.com.br');
    await user.clear(screen.getByLabelText('E-mail'));
    submit('Salvar');

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    const body = lastUpdateBody();
    expect(Object.keys(body)).toContain('email');
    expect(body.email).toBeNull();
  });
});
