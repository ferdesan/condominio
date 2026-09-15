import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { makeBlock, makeMeta, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  openSelect,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Block, Unit } from '@/types/api';
import { UnitsPage } from '../units-page';
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

/** Ver a nota em `units-page.test.tsx`: fechar um select do Radix trava o ambiente. */
vi.setConfig({ testTimeout: 60_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

const TOWER_A = makeBlock({ id: 'block-1', name: 'Torre A' });
const TOWER_B = makeBlock({ id: 'block-2', name: 'Torre B' });

/** Responde a listagem, os blocos e as contagens dos indicadores. */
function serve(units: Unit[] = [], blocks: Block[] = [TOWER_A, TOWER_B]): void {
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') return { data: blocks, meta: makeMeta({ total: blocks.length }) };
    if (params.perPage === 1) {
      return { data: [], meta: makeMeta({ page: 1, perPage: 1, total: units.length }) };
    }
    return { data: units, meta: makeMeta({ total: units.length }) };
  });
}

/**
 * O dialogo montado sozinho. A maioria dos casos nao fala da lista, e um DOM
 * menor deixa a abertura do select — cara neste ambiente — bem mais barata.
 */
function renderForm(options: { unit?: Unit; blocks?: Block[]; onClose?: () => void } = {}) {
  return renderWithProviders(
    <UnitFormDialog
      condominiumId="cond-1"
      unit={options.unit}
      blocks={options.blocks ?? [TOWER_A]}
      blocksLoading={false}
      onClose={options.onClose ?? (() => undefined)}
    />,
  );
}

function submit(label: 'Cadastrar' | 'Salvar'): void {
  clickTrigger(
    within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(`${label}$`) }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Cadastro de unidade', () => {
  it('IT-052: cadastra a unidade no condominio do shell e atualiza a lista', async () => {
    serve([], [TOWER_A]);
    const created = makeUnit({ id: 'unit-9', number: '101', block: TOWER_A });
    mockPost.mockResolvedValue(created);
    const user = createUser();
    renderWithProviders(<UnitsPage />);
    await screen.findByText('Nenhuma unidade cadastrada');

    clickTrigger(screen.getByRole('button', { name: 'Cadastrar unidade' }));
    await screen.findByLabelText('Numero');
    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '101');

    // Os blocos pedidos pela tela ja vieram escopados ao condominio do shell.
    expect(mockGetPaginated).toHaveBeenCalledWith(
      '/blocks',
      expect.objectContaining({ params: expect.objectContaining({ condominiumId: 'cond-1' }) }),
    );

    // Com um unico bloco cadastrado ele ja vem escolhido: nao ha outra opcao.
    expect(within(screen.getByRole('dialog')).getByLabelText('Bloco')).toHaveTextContent('Torre A');

    serve([created], [TOWER_A]);
    submit('Cadastrar');

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith(
      '/units',
      expect.objectContaining({ condominiumId: 'cond-1', blockId: 'block-1', number: '101' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('101')).toBeInTheDocument();
  });

  it('IT-053: 409 de numero duplicado aparece no formulario e preserva o preenchido', async () => {
    const message = 'Ja existe uma unidade com este numero neste bloco.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));
    const user = createUser();
    renderForm();

    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '101');
    submit('Cadastrar');

    expect(await screen.findByText(message)).toBeInTheDocument();
    // Sem detalhe de campo, nenhum controle e marcado como invalido.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Numero')).toHaveValue('101');
    // A mensagem inline substitui o toast global, nao soma a ele.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('IT-054: o seletor oferece apenas os blocos do condominio selecionado', async () => {
    serve([makeUnit()], [TOWER_A, TOWER_B]);
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    expect(mockGetPaginated).toHaveBeenCalledWith(
      '/blocks',
      expect.objectContaining({ params: expect.objectContaining({ condominiumId: 'cond-1' }) }),
    );

    clickTrigger(screen.getByRole('button', { name: 'Nova unidade' }));
    await screen.findByLabelText('Numero');

    openSelect(within(screen.getByRole('dialog')).getByLabelText('Bloco'));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Torre A', 'Torre B']);
  });

  it('IT-055: 409 de bloco em outro condominio aparece com a mensagem do servidor', async () => {
    const message = 'O bloco informado pertence a outro condominio.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE_VIOLATION'));
    const user = createUser();
    renderForm();

    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '101');
    submit('Cadastrar');

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('IT-056: andar 201 e fracao 1.5 param antes da requisicao', async () => {
    const user = createUser();
    renderForm();

    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '101');
    await user.clear(screen.getByLabelText('Andar'));
    await user.type(screen.getByLabelText('Andar'), '201');
    await user.type(screen.getByLabelText('Fracao ideal'), '1.5');
    submit('Cadastrar');

    expect(await screen.findByText('O andar deve estar entre -10 e 200.')).toBeInTheDocument();
    expect(screen.getByText('A fracao ideal deve estar entre 0 e 1.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-057: dois cliques seguidos produzem uma unica requisicao', async () => {
    mockPost.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeUnit()), 50)),
    );
    const user = createUser();
    renderForm();

    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '101');
    submit('Cadastrar');
    submit('Cadastrar');

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('IT-058: 409 por numero de unidade removida mostra a mensagem do servidor', async () => {
    const message = 'Ja existe uma unidade com este numero neste bloco.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));
    const user = createUser();
    renderForm();

    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '999');
    submit('Cadastrar');

    // Nada de "falha inesperada": a explicacao do servidor e a que aparece.
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('IT-059: sem blocos, o seletor oferece a criacao no lugar de uma lista vazia', async () => {
    renderForm({ blocks: [] });

    expect(screen.getByRole('button', { name: 'Cadastrar o primeiro bloco' })).toBeInTheDocument();
    expect(screen.getByText(/ainda nao tem blocos/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Bloco' })).not.toBeInTheDocument();
  });
});

describe('Edicao de unidade', () => {
  it('IT-068: edita numero e taxa e a lista reflete a mudanca', async () => {
    const unit = makeUnit({ number: '101', monthlyFee: 850, block: TOWER_A });
    serve([unit], [TOWER_A]);
    const updated = makeUnit({ ...unit, number: '102', monthlyFee: 900 });
    mockPatch.mockResolvedValue(updated);
    const user = createUser();
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    clickTrigger(screen.getByRole('button', { name: 'Editar unidade 101' }));
    await screen.findByLabelText('Numero');
    // Os valores atuais ja chegam preenchidos, bloco inclusive.
    expect(screen.getByLabelText('Numero')).toHaveValue('101');
    expect(within(screen.getByRole('dialog')).getByLabelText('Bloco')).toHaveTextContent('Torre A');

    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '102');
    await user.clear(screen.getByLabelText('Taxa mensal'));
    await user.type(screen.getByLabelText('Taxa mensal'), '900');
    serve([updated], [TOWER_A]);
    submit('Salvar');

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith(
      '/units/unit-1',
      expect.objectContaining({ number: '102', monthlyFee: 900 }),
    );
    expect(await screen.findByText('102')).toBeInTheDocument();
  });

  it('IT-069: 409 de numero em uso mantem o dialogo aberto', async () => {
    const message = 'Ja existe uma unidade com este numero neste bloco.';
    mockPatch.mockRejectedValue(new ApiError(message, 409, 'CONFLICT'));
    const user = createUser();
    renderForm({ unit: makeUnit({ number: '101' }) });

    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '102');
    submit('Salvar');

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Numero')).toHaveValue('102');
  });

  it('IT-070: status enviado como ocupada aparece como o servidor devolveu', async () => {
    const unit = makeUnit({ number: '101', status: 'VACANT', block: TOWER_A });
    serve([unit], [TOWER_A]);
    // Sem moradores ativos, o servidor recalcula para vaga e devolve isso.
    const saved = makeUnit({ ...unit, status: 'VACANT' });
    mockPatch.mockResolvedValue(saved);
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    clickTrigger(screen.getByRole('button', { name: 'Editar unidade 101' }));
    await screen.findByLabelText('Numero');
    // A tela explica a interacao em vez de deixar o campo parecer livre.
    expect(screen.getByText(/recalculadas a partir dos moradores/i)).toBeInTheDocument();

    serve([saved], [TOWER_A]);
    selectOption(within(screen.getByRole('dialog')).getByLabelText('Status'), 'Ocupada');
    submit('Salvar');

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith(
      '/units/unit-1',
      expect.objectContaining({ status: 'OCCUPIED' }),
    );
    // O que a linha mostra e o status devolvido, nao o enviado.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const row = (await screen.findByText('101')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Vaga')).toBeInTheDocument();
    expect(within(row).queryByText('Ocupada')).not.toBeInTheDocument();
  });

  it('IT-071: status em reforma persiste, porque o recalculo nao o sobrescreve', async () => {
    const unit = makeUnit({ number: '101', status: 'VACANT', block: TOWER_A });
    serve([unit], [TOWER_A]);
    const saved = makeUnit({ ...unit, status: 'RENOVATION' });
    mockPatch.mockResolvedValue(saved);
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    clickTrigger(screen.getByRole('button', { name: 'Editar unidade 101' }));
    await screen.findByLabelText('Numero');

    serve([saved], [TOWER_A]);
    selectOption(within(screen.getByRole('dialog')).getByLabelText('Status'), 'Em reforma');
    submit('Salvar');

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith(
      '/units/unit-1',
      expect.objectContaining({ status: 'RENOVATION' }),
    );
    const row = (await screen.findByText('101')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Em reforma')).toBeInTheDocument();
  });

  it('IT-072: o campo de bloco e oferecido na edicao e validado contra o condominio', async () => {
    mockPatch.mockResolvedValue(makeUnit({ blockId: 'block-2' }));
    renderForm({
      unit: makeUnit({ number: '101', blockId: 'block-1' }),
      blocks: [TOWER_A, TOWER_B],
    });

    // Oferecido — nunca exibido e ignorado —, e com os blocos do condominio atual.
    const blockField = within(screen.getByRole('dialog')).getByLabelText('Bloco');
    expect(blockField).toHaveTextContent('Torre A');

    selectOption(blockField, 'Torre B');
    submit('Salvar');

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith(
      '/units/unit-1',
      expect.objectContaining({ blockId: 'block-2', condominiumId: 'cond-1' }),
    );
  });

  it('IT-073: 404 na edicao fecha o dialogo e recarrega a lista', async () => {
    const unit = makeUnit({ number: '101', block: TOWER_A });
    serve([unit], [TOWER_A]);
    mockPatch.mockRejectedValue(new ApiError('Unidade nao encontrado.', 404, 'NOT_FOUND'));
    const user = createUser();
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    clickTrigger(screen.getByRole('button', { name: 'Editar unidade 101' }));
    await screen.findByLabelText('Numero');
    await user.clear(screen.getByLabelText('Numero'));
    await user.type(screen.getByLabelText('Numero'), '102');

    const listCallsBefore = mockGetPaginated.mock.calls.length;
    serve([], [TOWER_A]);
    submit('Salvar');

    // Insistir no formulario nao leva a lugar nenhum: a lista conta o que ha.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(mockGetPaginated.mock.calls.length).toBeGreaterThan(listCallsBefore),
    );
    expect(await screen.findByText('Nenhuma unidade cadastrada')).toBeInTheDocument();
  });
});
