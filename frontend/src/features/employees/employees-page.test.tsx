import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPost } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Employee } from '@/types/api';
import { EmployeesPage } from './employees-page';

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
 * assercoes que seguem um `selectOption` sao sincronas.
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
function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'employee-1',
    condominiumId: 'cond-1',
    userId: null,
    name: 'Joana Ribeiro',
    document: '12345678909',
    position: 'Porteira',
    department: 'Portaria',
    contractType: 'CLT',
    status: 'ACTIVE',
    email: 'joana@exemplo.com',
    phone: '11977776666',
    admissionDate: '2024-03-01',
    terminationDate: null,
    workSchedule: '12x36 noturno',
    salary: 2500,
    photoUrl: null,
    notes: null,
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
type World = { employees: Employee[]; total?: number };
let world: World;

/**
 * A tela faz duas leituras da mesma rota: a pagina da listagem e o levantamento
 * dos departamentos existentes, que pede o teto do servidor. As duas saem da
 * mesma colecao.
 */
function serve(employees: Employee[]): void {
  world = { employees };
  mockGetPaginated.mockImplementation(async (_url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    return {
      data: world.employees,
      meta: makeMeta({
        total: world.total ?? world.employees.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    };
  });
}

/** Funcionarios com nomes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Employee[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeEmployee({
      id: `employee-${position}`,
      name: `Funcionário ${String(position).padStart(3, '0')}`,
      document: null,
    });
  });
}

/**
 * Os parametros da ultima listagem pedida — e nao os do levantamento de
 * departamentos, que vai pela mesma rota e se distingue pelo tamanho da pagina.
 */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(
    ([url, config]) =>
      url === '/employees' && Number((config?.params as { perPage?: unknown })?.perPage) !== 200,
  );
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

describe('Listagem de funcionários', () => {
  it('busca, filtros e ordenação chegam ao servidor com o nome e o formato que ele aceita', async () => {
    serve([makeEmployee()]);
    const user = createUser();
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Joana');
    await waitFor(() => expect(lastListParams().search).toBe('Joana'));

    selectOption(screen.getByLabelText('Status'), 'Ativo');
    expect(lastListParams().status).toBe('ACTIVE');

    selectOption(screen.getByLabelText('Contrato'), 'CLT');
    expect(lastListParams().contractType).toBe('CLT');

    // Departamento e texto livre comparado por igualdade: a opcao vem do
    // levantamento dos valores existentes, e por isso casa.
    selectOption(screen.getByLabelText('Departamento'), 'Portaria');
    expect(lastListParams().department).toBe('Portaria');

    // A tabela fala `asc`/`desc`; quem traduz para o vocabulario da API e a
    // camada de dados, e e o resultado dela que sai na requisicao.
    clickTrigger(screen.getByRole('button', { name: 'Cargo' }));
    expect(lastListParams().sortBy).toBe('position');
    expect(lastListParams().sortOrder).toBe('ASC');

    // Nenhum controle perdeu o valor pelo caminho.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Joana',
      status: 'ACTIVE',
      contractType: 'CLT',
      department: 'Portaria',
    });
  });

  it('um CPF pontuado na busca e enviado apenas com os digitos', async () => {
    serve([makeEmployee()]);
    const user = createUser();
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');
    await user.type(screen.getByLabelText('Buscar'), '123.456.789-09');

    await waitFor(() => expect(lastListParams().search).toBe('12345678909'));
  });

  it('trezentos funcionários paginam, e a próxima pagina e pedida ao servidor', async () => {
    serve(makeRoster(20));
    world.total = 300;
    const user = createUser();
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Funcionário 001');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.employees = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Funcionário 021')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('o salário aparece formatado como moeda na listagem', async () => {
    serve([makeEmployee({ salary: 2500 })]);
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');

    // O separador entre o simbolo e o numero e um espaco nao separavel: o que
    // se afirma e o formato pt-BR, nao o code point exato do ICU em uso.
    expect(cellsOf('Salário')[0]).toMatch(/^R\$\s?2\.500,00$/);
  });

  it('CPF, departamento, telefone, admissao e salário ausentes viram placeholder, nunca "null"', async () => {
    serve([
      makeEmployee({
        document: null,
        department: null,
        phone: null,
        admissionDate: null,
        salary: null,
      }),
    ]);
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');

    expect(cellsOf('CPF')).toEqual(['—']);
    expect(cellsOf('Departamento')).toEqual(['—']);
    expect(cellsOf('Telefone')).toEqual(['—']);
    expect(cellsOf('Admissao')).toEqual(['—']);
    expect(cellsOf('Salário')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    serve([makeEmployee()]);
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');

    // Whitelist do servidor: condominiumId (vem do shell), status, department e
    // contractType. Qualquer outro controle pareceria funcionar enquanto o
    // backend o descarta em silencio.
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Departamento')).toBeInTheDocument();
    expect(screen.getByLabelText('Contrato')).toBeInTheDocument();

    for (const absent of ['Cargo', 'CPF', 'Salário', 'Admissao', 'Condomínio']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });

  it('sem nenhum departamento cadastrado o filtro não e oferecido', async () => {
    serve([makeEmployee({ department: null })]);
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');

    // Um select com "Todos" e mais nada nao filtra coisa alguma.
    expect(screen.queryByLabelText('Departamento')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });
});

describe('Estados vazios de funcionários', () => {
  it('lista vazia oferece o cadastro', async () => {
    serve([]);
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText('Nenhum funcionário cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar funcionário' })).toBeInTheDocument();
    // O vazio por ausencia de cadastro nao oferece limpar: nao ha o que limpar.
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e não se confunde com a lista vazia', async () => {
    serve([makeEmployee()]);
    const user = createUser();
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');
    world.employees = [];
    await user.type(screen.getByLabelText('Buscar'), 'Fulano');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum funcionário cadastrado')).not.toBeInTheDocument();
  });
});

describe('Exclusao e restauração de funcionários', () => {
  it('a exclusao pede confirmação antes de chegar ao servidor', async () => {
    serve([makeEmployee()]);
    mockDelete.mockResolvedValue(undefined);
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Joana Ribeiro' }));

    expect(await screen.findByText('Excluir funcionário?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    mockDelete.mockImplementation(async () => {
      world.employees = [];
    });
    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/employees/employee-1'));
    await waitFor(() => expect(screen.queryByText('Joana Ribeiro')).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    serve([makeEmployee()]);
    mockDelete.mockRejectedValue(
      new ApiError(
        'O funcionário responde por chamados abertos e não pode ser excluido.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Joana Ribeiro' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'O funcionário responde por chamados abertos e não pode ser excluido.',
      ),
    );
    expect(screen.getByText('Joana Ribeiro')).toBeInTheDocument();
  });

  it('o filtro de removidos envia includeDeleted e restaurar devolve o registro', async () => {
    serve([makeEmployee({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.employees = [makeEmployee({ deletedAt: null })];
      return world.employees[0];
    });
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');
    // O padrao do servidor ja e `false`: so vale a pena enviar quando true.
    expect(lastListParams().includeDeleted).toBeUndefined();

    await user.click(screen.getByLabelText('Incluir removidos'));
    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Joana Ribeiro' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/employees/employee-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
    expect(screen.getByText('Joana Ribeiro')).toBeInTheDocument();
  });
});

describe('Escopo e permissões de funcionários', () => {
  it('sem condomínio selecionado a tela explica a exigência e não consulta', async () => {
    serve([makeEmployee()]);
    renderWithProviders(<EmployeesPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  it('um operador ve a listagem sem cadastrar, editar ou excluir', async () => {
    serve([makeEmployee()]);
    renderWithProviders(<EmployeesPage />, { role: 'STAFF' });

    await screen.findByText('Joana Ribeiro');

    expect(screen.queryByRole('button', { name: 'Novo funcionário' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    serve([makeEmployee({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<EmployeesPage />, { role: 'STAFF' });

    await screen.findByText('Joana Ribeiro');
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('o levantamento de departamentos também fica preso ao condomínio do shell', async () => {
    serve([makeEmployee()]);
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');

    const call = mockGetPaginated.mock.calls.find(
      ([, config]) => Number((config?.params as { perPage?: unknown })?.perPage) === 200,
    );
    expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
      condominiumId: 'cond-1',
    });
  });
});
