import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiPost } from '@/lib/api';
import { makeBlock } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { Block } from '@/types/api';
import { UnitFormDialog } from './unit-form-dialog';

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

const mockPost = vi.mocked(apiPost);
const mockToastError = vi.mocked(toast.error);

const TOWER_A = makeBlock({ id: 'block-1', name: 'Torre A' });

function renderForm(options: { blocks?: Block[]; permissions?: string[] } = {}) {
  return renderWithProviders(
    <UnitFormDialog
      condominiumId="cond-1"
      blocks={options.blocks ?? []}
      blocksLoading={false}
      onClose={() => undefined}
    />,
    { permissions: options.permissions },
  );
}

/** O dialogo do topo da pilha: o Radix esconde o de baixo dos leitores. */
function topDialog(): HTMLElement {
  return screen.getByRole('dialog');
}

/** Abre a criacao em linha a partir do campo de bloco. */
async function openInlineCreation(label = 'Cadastrar o primeiro bloco'): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: label }));
  await screen.findByLabelText('Nome');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Criação de bloco dentro do cadastro de unidade', () => {
  it('IT-194: cria o bloco sem perder o que já foi digitado e o deixa escolhido', async () => {
    const user = createUser();
    renderForm({ blocks: [] });

    await user.clear(screen.getByLabelText('Número'));
    await user.type(screen.getByLabelText('Número'), '101');
    await user.clear(screen.getByLabelText('Andar'));
    await user.type(screen.getByLabelText('Andar'), '7');

    const created = makeBlock({ id: 'block-9', name: 'Torre Nova' });
    mockPost.mockResolvedValue(created);

    await openInlineCreation();
    await user.type(within(topDialog()).getByLabelText('Nome'), 'Torre Nova');
    clickTrigger(within(topDialog()).getByRole('button', { name: /Criar bloco$/ }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/blocks',
        expect.objectContaining({ condominiumId: 'cond-1', name: 'Torre Nova' }),
      ),
    );

    // De volta ao cadastro da unidade: nada do que foi preenchido se perdeu, e o
    // bloco recem-criado ja esta escolhido.
    await waitFor(() => expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Número')).toHaveValue('101');
    expect(screen.getByLabelText('Andar')).toHaveValue('7');
    expect(screen.getByLabelText('Bloco')).toHaveTextContent('Torre Nova');
  });

  it('IT-195: nome de bloco duplicado preserva os dados da unidade já digitados', async () => {
    const message = 'Já existe um bloco com este nome neste condomínio.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));
    const user = createUser();
    renderForm({ blocks: [] });

    await user.clear(screen.getByLabelText('Número'));
    await user.type(screen.getByLabelText('Número'), '101');

    await openInlineCreation();
    await user.type(within(topDialog()).getByLabelText('Nome'), 'Torre A');
    clickTrigger(within(topDialog()).getByRole('button', { name: /Criar bloco$/ }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    // A mensagem inline substitui o toast global, nao soma a ele.
    expect(mockToastError).not.toHaveBeenCalled();

    clickTrigger(within(topDialog()).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Número')).toHaveValue('101');
  });

  it('IT-196: cancelar a criação devolve o formulário intacto e sem bloco escolhido', async () => {
    const user = createUser();
    renderForm({ blocks: [] });

    await user.clear(screen.getByLabelText('Número'));
    await user.type(screen.getByLabelText('Número'), '101');

    await openInlineCreation();
    clickTrigger(within(topDialog()).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Número')).toHaveValue('101');
    expect(mockPost).not.toHaveBeenCalled();
    // Sem bloco criado, a oferta continua sendo criar o primeiro.
    expect(screen.getByRole('button', { name: 'Cadastrar o primeiro bloco' })).toBeInTheDocument();
  });

  it('IT-197: bloco criado e unidade recusada deixa claro o que ficou salvo', async () => {
    const user = createUser();
    renderForm({ blocks: [] });

    await user.clear(screen.getByLabelText('Número'));
    await user.type(screen.getByLabelText('Número'), '101');

    mockPost.mockResolvedValueOnce(makeBlock({ id: 'block-9', name: 'Torre Nova' }));
    await openInlineCreation();
    await user.type(within(topDialog()).getByLabelText('Nome'), 'Torre Nova');
    clickTrigger(within(topDialog()).getByRole('button', { name: /Criar bloco$/ }));
    await waitFor(() => expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument());

    const message = 'Já existe uma unidade com este número neste bloco.';
    mockPost.mockRejectedValueOnce(new ApiError(message, 409, 'CONFLICT'));
    clickTrigger(within(topDialog()).getByRole('button', { name: /Cadastrar$/ }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    // O bloco continua criado, e isso e dito — nao se deixa o usuario adivinhar.
    expect(
      screen.getByText(/O bloco "Torre Nova" foi criado e continua cadastrado/),
    ).toBeInTheDocument();
  });

  it('IT-198: sem permissao de criar bloco, so os existentes sao listados', async () => {
    renderForm({ blocks: [TOWER_A], permissions: ['unit:create', 'unit:read', 'block:read'] });

    expect(screen.getByLabelText('Bloco')).toHaveTextContent('Torre A');
    expect(screen.queryByRole('button', { name: 'Novo bloco' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cadastrar o primeiro bloco' }),
    ).not.toBeInTheDocument();
  });

  it('IT-199: zero andares na criação em linha e recusado sem requisição', async () => {
    const user = createUser();
    renderForm({ blocks: [] });

    await openInlineCreation();
    await user.type(within(topDialog()).getByLabelText('Nome'), 'Torre Nova');
    await user.clear(within(topDialog()).getByLabelText('Andares'));
    await user.type(within(topDialog()).getByLabelText('Andares'), '0');
    clickTrigger(within(topDialog()).getByRole('button', { name: /Criar bloco$/ }));

    expect(
      await screen.findByText('O número de andares deve estar entre 1 e 200.'),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-204: bloco removido enquanto selecionado faz a submissao falhar com a razao', async () => {
    const user = createUser();
    renderForm({ blocks: [TOWER_A] });

    await user.clear(screen.getByLabelText('Número'));
    await user.type(screen.getByLabelText('Número'), '101');

    // O servidor confere o bloco antes de criar a unidade: removido, responde 404.
    mockPost.mockRejectedValue(new ApiError('Bloco não encontrado.', 404, 'NOT_FOUND'));
    clickTrigger(within(topDialog()).getByRole('button', { name: /Cadastrar$/ }));

    // O dialogo permanece: no cadastro, 404 e o bloco que sumiu, nao a unidade.
    expect(await screen.findByText('Bloco não encontrado.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Número')).toHaveValue('101');
  });
});
