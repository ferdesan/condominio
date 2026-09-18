import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPost } from '@/lib/api';
import { makeMeta, makeResident, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Dependent, Resident } from '@/types/api';
import { DependentsPage } from './dependents-page';

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

/**
 * Mesmo custo medido em `residents-page.test.tsx`: abrir e fechar um select do
 * Radix no jsdom ocupa a thread por dezenas de segundos, e o excedente escorre
 * para o caso seguinte. Por isso o prazo vale para o arquivo inteiro, e as
 * assercoes que seguem um `selectOption` sao sincronas — o `fireEvent` que ele
 * usa ja vem embrulhado em `act`, entao o novo pedido saiu antes do retorno.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

/**
 * Fixture local de proposito: `test/fixtures.ts` e compartilhado com as telas que
 * estao sendo escritas em paralelo, e um arquivo so para todas voltaria a
 * conflitar no merge.
 */
function makeDependent(overrides: Partial<Dependent> = {}): Dependent {
  return {
    id: 'dependent-1',
    condominiumId: 'cond-1',
    unitId: 'unit-1',
    residentId: 'resident-1',
    name: 'Lucas Pereira',
    relationship: 'CHILD',
    document: '98765432100',
    birthDate: '2012-05-04',
    phone: '11955554444',
    photoUrl: null,
    hasAccessCard: true,
    active: true,
    resident: makeResident(),
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Estado do servidor durante um caso. E mutavel de proposito: a exclusao e a
 * restauracao so aparecem no refetch que a mutacao dispara.
 */
type World = {
  dependents: Dependent[];
  residents: Resident[];
  total?: number;
};

let world: World;

function serve(dependents: Dependent[], residents: Resident[] = [makeResident()]): void {
  world = { dependents, residents };
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;

    if (url === '/residents') {
      return {
        data: world.residents,
        meta: makeMeta({ total: world.residents.length, perPage: 200 }),
      };
    }
    return {
      data: world.dependents,
      meta: makeMeta({
        total: world.total ?? world.dependents.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    };
  });
}

/** Dependentes com nomes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Dependent[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeDependent({
      id: `dependent-${position}`,
      name: `Dependente ${String(position).padStart(3, '0')}`,
      document: null,
    });
  });
}

/** Os parametros da ultima listagem de dependentes pedida pela tela. */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/dependents');
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de dependentes', () => {
  it('busca, filtros e ordenação chegam ao servidor com o nome e o formato que ele aceita', async () => {
    serve([makeDependent()]);
    const user = createUser();
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Lucas');
    await waitFor(() => expect(lastListParams().search).toBe('Lucas'));

    selectOption(screen.getByLabelText('Morador'), 'Carlos Pereira');
    expect(lastListParams().residentId).toBe('resident-1');

    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    selectOption(screen.getByLabelText('Parentesco'), 'Filho(a)');
    expect(lastListParams().relationship).toBe('CHILD');

    // `active` e uma coluna booleana; o MySQL lê `'true'` como `0` ao comparar
    // com um numero, entao o valor enviado precisa ser `'1'`.
    selectOption(screen.getByLabelText('Situação'), 'Ativo');
    expect(lastListParams().active).toBe('1');

    // A tabela fala `asc`/`desc`; quem traduz para o vocabulario da API e a
    // camada de dados, e e o resultado dela que sai na requisicao.
    clickTrigger(screen.getByRole('button', { name: 'Nome' }));
    expect(lastListParams().sortBy).toBe('name');
    expect(lastListParams().sortOrder).toBe('ASC');

    // Nenhum controle perdeu o valor pelo caminho.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Lucas',
      residentId: 'resident-1',
      unitId: 'unit-1',
      relationship: 'CHILD',
      active: '1',
    });
  });

  it('um CPF pontuado na busca e enviado apenas com os digitos', async () => {
    serve([makeDependent()]);
    const user = createUser();
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');
    await user.type(screen.getByLabelText('Buscar'), '987.654.321-00');

    await waitFor(() => expect(lastListParams().search).toBe('98765432100'));
  });

  it('trezentos dependentes paginam, e a próxima pagina e pedida ao servidor', async () => {
    serve(makeRoster(20));
    world.total = 300;
    const user = createUser();
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Dependente 001');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.dependents = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Dependente 021')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('CPF, telefone e nascimento ausentes viram placeholder, nunca "null"', async () => {
    serve([makeDependent({ document: null, phone: null, birthDate: null })]);
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');

    expect(cellsOf('CPF')).toEqual(['—']);
    expect(cellsOf('Telefone')).toEqual(['—']);
    expect(cellsOf('Nascimento')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('um dependente cujo morador sumiu ainda rende a linha, com a falta explicita', async () => {
    serve(
      [makeDependent({ resident: undefined })],
      [
        makeResident({
          id: 'resident-9',
          name: 'Outro Morador',
          unitId: 'unit-9',
          unit: makeUnit({ id: 'unit-9', number: '909' }),
        }),
      ],
    );
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');

    expect(cellsOf('Morador')).toEqual(['Morador removido']);
    // A unidade vem do morador, entao ela some junto — e a celula diz isso com
    // o mesmo placeholder de sempre, e nao com um erro.
    expect(cellsOf('Unidade')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    serve([makeDependent()]);
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');

    // Whitelist do servidor: condominiumId (vem do shell), unitId, residentId,
    // relationship e active. Qualquer outro controle pareceria funcionar
    // enquanto o backend o descarta em silencio.
    expect(screen.getByLabelText('Morador')).toBeInTheDocument();
    expect(screen.getByLabelText('Unidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Parentesco')).toBeInTheDocument();
    expect(screen.getByLabelText('Situação')).toBeInTheDocument();

    for (const absent of ['CPF', 'Telefone', 'Nascimento', 'Cartao de acesso', 'Condomínio']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });
});

describe('Estados vazios de dependentes', () => {
  it('lista vazia oferece o cadastro', async () => {
    serve([]);
    renderWithProviders(<DependentsPage />);

    expect(await screen.findByText('Nenhum dependente cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar dependente' })).toBeInTheDocument();
    // O vazio por ausencia de cadastro nao oferece limpar: nao ha o que limpar.
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e não se confunde com a lista vazia', async () => {
    serve([makeDependent()]);
    const user = createUser();
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');
    world.dependents = [];
    await user.type(screen.getByLabelText('Buscar'), 'Fulano');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum dependente cadastrado')).not.toBeInTheDocument();
  });

  it('condomínio sem moradores explica que o morador vem primeiro', async () => {
    serve([], []);
    renderWithProviders(<DependentsPage />);

    expect(
      await screen.findByText(
        'Cadastre ao menos um morador antes de registrar dependentes: todo dependente e vinculado a um morador.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo dependente' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cadastrar dependente' })).not.toBeInTheDocument();
  });
});

describe('Exclusao e restauração de dependentes', () => {
  it('a exclusao pede confirmação antes de chegar ao servidor', async () => {
    serve([makeDependent()]);
    mockDelete.mockResolvedValue(undefined);
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Lucas Pereira' }));

    expect(await screen.findByText('Excluir dependente?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    mockDelete.mockImplementation(async () => {
      world.dependents = [];
    });
    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/dependents/dependent-1'));
    await waitFor(() => expect(screen.queryByText('Lucas Pereira')).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    serve([makeDependent()]);
    mockDelete.mockRejectedValue(
      new ApiError(
        'O dependente possui acessos registrados e não pode ser excluido.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Lucas Pereira' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'O dependente possui acessos registrados e não pode ser excluido.',
      ),
    );
    expect(screen.getByText('Lucas Pereira')).toBeInTheDocument();
  });

  it('o filtro de removidos envia includeDeleted e restaurar devolve o registro', async () => {
    serve([makeDependent({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.dependents = [makeDependent({ deletedAt: null })];
      return world.dependents[0];
    });
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');
    // O padrao do servidor ja e `false`: so vale a pena enviar quando true.
    expect(lastListParams().includeDeleted).toBeUndefined();

    await user.click(screen.getByLabelText('Incluir removidos'));
    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Lucas Pereira' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/dependents/dependent-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
    expect(screen.getByText('Lucas Pereira')).toBeInTheDocument();
  });
});

describe('Escopo e permissões de dependentes', () => {
  it('sem condomínio selecionado a tela explica a exigência e não consulta', async () => {
    serve([makeDependent()]);
    renderWithProviders(<DependentsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  it('um operador ve a listagem sem cadastrar, editar ou excluir', async () => {
    serve([makeDependent()]);
    renderWithProviders(<DependentsPage />, { role: 'STAFF' });

    await screen.findByText('Lucas Pereira');

    expect(screen.queryByRole('button', { name: 'Novo dependente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    serve([makeDependent({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<DependentsPage />, { role: 'STAFF' });

    await screen.findByText('Lucas Pereira');
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('a consulta de moradores também fica presa ao condomínio do shell', async () => {
    serve([makeDependent()]);
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');

    const call = mockGetPaginated.mock.calls.find(([url]) => url === '/residents');
    expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
      condominiumId: 'cond-1',
    });
  });
});
