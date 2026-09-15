import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { makeBlock, makeMeta, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Block, Unit } from '@/types/api';
import { UnitsPage } from '../units/units-page';
import { BlocksPage } from './blocks-page';

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

// Abrir um portal do Radix custa dezenas de segundos neste ambiente; a nota
// completa esta em `residents-page.test.tsx`. O prazo vale para o arquivo todo.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

/** Estado do servidor durante um caso; mutavel, para que o refetch veja a mudanca. */
type World = { blocks: Block[]; units: Unit[]; total?: number };

let world: World;

function serve(blocks: Block[], units: Unit[] = []): void {
  world = { blocks, units };
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') {
      return {
        data: world.blocks,
        meta: makeMeta({
          total: world.total ?? world.blocks.length,
          page: Number(params.page ?? 1),
          perPage: Number(params.perPage ?? 20),
        }),
      } as never;
    }
    // A tela de unidades tambem consulta contagens (`perPage=1`) na regressao.
    if (Number(params.perPage) === 1) {
      return {
        data: [],
        meta: makeMeta({ page: 1, perPage: 1, total: world.units.length }),
      } as never;
    }
    return { data: world.units, meta: makeMeta({ total: world.units.length }) } as never;
  });
}

/** Os parametros da ultima listagem de blocos pedida pela tela. */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/blocks');
  return (calls.at(-1)?.[1]?.params ?? {}) as Record<string, unknown>;
}

/** Linhas de dados, sem o cabecalho. */
function dataRows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

/** Indice da coluna pelo rotulo do cabecalho, para nao depender da ordem. */
function columnIndex(label: string): number {
  const headers = within(screen.getAllByRole('row')[0]).getAllByRole('columnheader');
  return headers.findIndex((header) => header.textContent?.trim().startsWith(label));
}

/** Conteudo de uma coluna em todas as linhas, na ordem em que aparecem. */
function cellsOf(label: string): string[] {
  const index = columnIndex(label);
  return dataRows().map((row) => within(row).getAllByRole('cell')[index].textContent?.trim() ?? '');
}

/** Blocos com nomes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Block[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeBlock({
      id: `block-${position}`,
      name: `Bloco ${String(position).padStart(3, '0')}`,
    });
  });
}

/** O corpo enviado no ultimo `POST /blocks`. */
function lastCreateBody(): Record<string, unknown> {
  return (mockPost.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de blocos', () => {
  it('busca, filtro, paginacao e ordenacao chegam ao servidor como ele os aceita', async () => {
    serve(makeRoster(20));
    world.total = 60;
    const user = createUser();
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Bloco 001');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Torre');
    await waitFor(() => expect(lastListParams().search).toBe('Torre'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Tipo'), 'Torre');
    expect(lastListParams().type).toBe('TOWER');

    // A ordenacao viaja em caixa alta; a tabela fala em caixa baixa e a
    // traducao mora na camada de dados (ADR-008/ADR-009).
    clickTrigger(screen.getByRole('button', { name: /^Nome/ }));
    expect(lastListParams().sortBy).toBe('name');
    expect(lastListParams().sortOrder).toBe('ASC');

    world.blocks = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Bloco 021')).toBeInTheDocument();
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Torre',
      type: 'TOWER',
      sortOrder: 'ASC',
    });
  });

  it('lista vazia oferece cadastrar, e busca sem resultado oferece limpar', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<BlocksPage />);

    // Sem nenhum registro: o convite e cadastrar o primeiro.
    expect(await screen.findByText('Nenhum bloco cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar bloco' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar'), 'torre');

    // Com um termo aplicado: o convite e desfazer a busca. Os dois estados sao
    // distinguiveis, e nao a mesma tela vazia.
    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cadastrar bloco' })).not.toBeInTheDocument();
  });

  it('sem condominio selecionado explica a exigencia e nao consulta', async () => {
    serve([makeBlock()]);
    renderWithProviders(<BlocksPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condominio')).toBeInTheDocument();
    expect(mockGetPaginated.mock.calls.filter(([url]) => url === '/blocks')).toHaveLength(0);
  });

  it('celula nula rende o placeholder, nunca a string "null"', async () => {
    serve([makeBlock({ description: null })]);
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Torre A');

    expect(cellsOf('Descricao')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('a geometria do bloco aparece na listagem', async () => {
    serve([makeBlock({ floors: 12, unitsPerFloor: 4, hasElevator: true })]);
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Torre A');

    expect(cellsOf('Andares')).toEqual(['12']);
    expect(cellsOf('Unidades por andar')).toEqual(['4']);
    expect(cellsOf('Elevador')).toEqual(['Com elevador']);
  });
});

describe('Cadastro de bloco', () => {
  it('envia os campos e a lista se atualiza sem refetch manual', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.blocks = [makeBlock({ id: 'block-9', name: 'Torre C' })];
      return world.blocks[0] as never;
    });
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Nenhum bloco cadastrado');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar bloco' }));
    const form = within(await screen.findByRole('dialog'));

    await user.type(form.getByLabelText('Nome'), 'Torre C');
    clickTrigger(form.getByRole('button', { name: 'Criar bloco' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/blocks', expect.anything()));
    // O corpo carrega o condominio do shell e os padroes do formulario.
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      name: 'Torre C',
      type: 'BLOCK',
      floors: 1,
      unitsPerFloor: 0,
      hasElevator: false,
    });
    // A invalidacao da fabrica traz a lista nova: nenhuma tela pede refetch.
    expect(await screen.findByText('Torre C')).toBeInTheDocument();
  });

  it('422 com campo aparece no campo, sem toast', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'name', message: 'Informe o nome do bloco.' },
      ]),
    );
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Nenhum bloco cadastrado');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar bloco' }));
    const form = within(await screen.findByRole('dialog'));

    await user.type(form.getByLabelText('Nome'), 'Torre C');
    clickTrigger(form.getByRole('button', { name: 'Criar bloco' }));

    expect(await screen.findByText('Informe o nome do bloco.')).toBeInTheDocument();
    // O formulario apresenta a falha por si; o toast global duplicaria.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('409 sem campo vira mensagem do formulario e preserva o preenchido', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Ja existe um bloco com este nome neste condominio.', 409, 'CONFLICT'),
    );
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Nenhum bloco cadastrado');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar bloco' }));
    const dialog = await screen.findByRole('dialog');
    const form = within(dialog);

    await user.type(form.getByLabelText('Nome'), 'Torre A');
    await user.type(form.getByLabelText('Andares'), '3');
    clickTrigger(form.getByRole('button', { name: 'Criar bloco' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Ja existe um bloco com este nome neste condominio.');
    // O dialogo continua aberto com o que foi digitado.
    expect(form.getByLabelText('Nome')).toHaveValue('Torre A');
  });

  it('dois cliques em salvar produzem uma unica requisicao', async () => {
    serve([]);
    const user = createUser();
    // A requisicao demora o bastante para que o segundo clique caia enquanto a
    // primeira ainda esta no ar, e se resolve sozinha antes do fim do caso.
    mockPost.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeBlock()), 50)) as never,
    );
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Nenhum bloco cadastrado');
    clickTrigger(screen.getByRole('button', { name: 'Cadastrar bloco' }));
    const form = within(await screen.findByRole('dialog'));

    await user.type(form.getByLabelText('Nome'), 'Torre C');
    const submit = form.getByRole('button', { name: 'Criar bloco' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('a edicao envia o parcial e a lista reflete a mudanca', async () => {
    serve([makeBlock()]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.blocks = [makeBlock({ name: 'Torre Norte' })];
      return world.blocks[0] as never;
    });
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Torre A');
    clickTrigger(screen.getByRole('button', { name: 'Editar Torre A' }));
    const form = within(await screen.findByRole('dialog'));

    // O formulario abre preenchido com o registro existente.
    expect(form.getByLabelText('Nome')).toHaveValue('Torre A');
    expect(form.getByLabelText('Andares')).toHaveValue('12');

    await user.clear(form.getByLabelText('Nome'));
    await user.type(form.getByLabelText('Nome'), 'Torre Norte');
    clickTrigger(form.getByRole('button', { name: 'Salvar bloco' }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/blocks/block-1',
        expect.objectContaining({ name: 'Torre Norte' }),
      ),
    );
    expect(await screen.findByText('Torre Norte')).toBeInTheDocument();
  });
});

describe('Exclusao e restauracao de blocos', () => {
  it('a exclusao pede confirmacao antes de chamar o servidor', async () => {
    serve([makeBlock()]);
    mockDelete.mockImplementation(async () => {
      world.blocks = [];
    });
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Torre A');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Torre A' }));

    // O dialogo esta aberto e nada foi enviado ainda.
    expect(await screen.findByText('Excluir bloco?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/blocks/block-1'));
    await waitFor(() => expect(screen.queryByText('Torre A')).not.toBeInTheDocument());
  });

  it('excluir um bloco com unidades mostra a recusa do servidor e mantem o bloco', async () => {
    serve([makeBlock()], [makeUnit()]);
    mockDelete.mockRejectedValue(
      new ApiError(
        'Bloco possui unidades vinculadas e nao pode ser removido.',
        409,
        'BUSINESS_RULE_ERROR',
      ),
    );
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Torre A');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Torre A' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Bloco possui unidades vinculadas e nao pode ser removido.',
      ),
    );
    // A recusa nao remove nada: o bloco continua listado.
    expect(screen.getByText('Torre A')).toBeInTheDocument();
  });

  it('o filtro de removidos envia includeDeleted e restaurar devolve o registro', async () => {
    serve([makeBlock({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.blocks = [makeBlock({ deletedAt: null })];
      return world.blocks[0] as never;
    });
    renderWithProviders(<BlocksPage />);

    await screen.findByText('Torre A');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(await screen.findByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Torre A' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/blocks/block-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Permissoes', () => {
  it('um operador ve a listagem sem cadastrar, editar ou excluir', async () => {
    serve([makeBlock()]);
    renderWithProviders(<BlocksPage />, { role: 'STAFF' });

    await screen.findByText('Torre A');

    expect(screen.queryByRole('button', { name: 'Novo bloco' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador nao ve restaurar nas linhas removidas', async () => {
    serve([makeBlock({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<BlocksPage />, { role: 'STAFF' });

    await screen.findByText('Torre A');
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('a lista vazia nao oferece cadastrar a quem nao pode criar', async () => {
    serve([]);
    renderWithProviders(<BlocksPage />, { role: 'STAFF' });

    expect(await screen.findByText('Nenhum bloco cadastrado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cadastrar bloco' })).not.toBeInTheDocument();
  });
});

/**
 * A extracao tirou o schema, os hooks e os dois dialogos de dentro de
 * `features/units/`. A gestao embutida no cadastro de unidades continua sendo um
 * ponto de entrada valido (ADR-007) — esta rota e adicional, nao substituta —,
 * entao o que estes casos fixam e que os dois caminhos chegam ao mesmo
 * formulario depois da mudanca de lugar.
 *
 * A cobertura detalhada da gestao embutida segue em
 * `features/units/components/block-manager-dialog.test.tsx`, que passou intacta.
 */
describe('Regressao: a gestao de blocos dentro de Unidades', () => {
  it('continua abrindo e criando pelo mesmo formulario', async () => {
    serve([makeBlock()], [makeUnit()]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.blocks = [makeBlock(), makeBlock({ id: 'block-2', name: 'Torre B' })];
      return world.blocks[1] as never;
    });
    renderWithProviders(<UnitsPage />);

    // A gestao mora atras de um botao da tela de unidades, e nao de uma rota.
    clickTrigger(await screen.findByRole('button', { name: /blocos/i }));
    expect(await screen.findByText('Blocos do condominio')).toBeInTheDocument();

    clickTrigger(screen.getByRole('button', { name: 'Novo bloco' }));

    // O mesmo `BlockFormDialog` que a tela de blocos abre.
    const form = within(await screen.findByRole('dialog', { name: 'Novo bloco' }));
    await user.type(form.getByLabelText('Nome'), 'Torre B');
    clickTrigger(form.getByRole('button', { name: 'Criar bloco' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/blocks',
        expect.objectContaining({ condominiumId: 'cond-1', name: 'Torre B' }),
      ),
    );
    expect(await screen.findByText('Torre B')).toBeInTheDocument();
  });
});
