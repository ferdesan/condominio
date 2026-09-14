import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  fireEvent,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Employee } from '@/types/api';
import { EmployeesPage } from '../employees-page';

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

/** Mesmo custo de portal do Radix descrito em `employees-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

/** Fixture local: ver a nota em `employees-page.test.tsx`. */
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

type World = { employees: Employee[] };
let world: World;

function serve(employees: Employee[]): void {
  world = { employees };
  mockGetPaginated.mockImplementation(async () => ({
    data: world.employees,
    meta: makeMeta({ total: world.employees.length }),
  }));
}

/** Corpo da ultima criacao pedida. */
function lastCreateBody(): Record<string, unknown> {
  return (mockPost.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

/**
 * O separador entre o simbolo e o numero e um espaco nao separavel: o que se
 * afirma e o formato pt-BR, nao o code point exato do ICU em uso.
 */
const CURRENCY_3200 = /^R\$\s?3\.200,00$/;
const CURRENCY_2500 = /^R\$\s?2\.500,00$/;

/** O campo monetario, lido como input para conferir o texto que ele apresenta. */
function salaryField(): HTMLInputElement {
  return within(dialog()).getByLabelText('Salario') as HTMLInputElement;
}

/**
 * Escreve o salario de uma vez.
 *
 * O `CurrencyInput` reformata o proprio conteudo a cada mudanca do valor
 * guardado, entao digitar caractere a caractere reintroduz a pontuacao da moeda
 * no meio do numero. Um unico evento de mudanca e o que um colar produz — e o
 * que exercita o contrato que interessa aqui: o que sai no corpo da requisicao.
 */
function typeSalary(value: string): void {
  fireEvent.change(within(dialog()).getByLabelText('Salario'), { target: { value } });
}

/** Abre o dialogo de cadastro e espera o formulario aparecer. */
async function openCreateDialog(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Novo funcionario' }));
  await screen.findByLabelText('Nome');
}

/** Abre o dialogo de edicao do registro e espera os valores carregados. */
async function openEditDialog(name: string): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Editar ${name}` }));
  await screen.findByLabelText('Nome');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Cadastro de funcionario', () => {
  it('cadastra com os campos contratuais, e a lista chega atualizada sem recarregar a tela', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.employees = [makeEmployee({ name: 'Marcos Lima', position: 'Zelador' })];
      return world.employees[0];
    });
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Zelador');
    await user.type(within(dialog()).getByLabelText('Departamento'), 'Manutencao');
    await user.type(within(dialog()).getByLabelText('Admissao'), '2026-02-01');
    selectOption(within(dialog()).getByLabelText('Tipo de contrato'), 'Terceirizado');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/employees');
    // O condominio vem do shell, nao do formulario; os padroes do schema do
    // servidor entram sem que ninguem os toque.
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      name: 'Marcos Lima',
      position: 'Zelador',
      department: 'Manutencao',
      contractType: 'OUTSOURCED',
      status: 'ACTIVE',
      admissionDate: '2026-02-01',
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica e o que traz a lista nova; ninguem pede refetch.
    expect(await screen.findByText('Marcos Lima')).toBeInTheDocument();
  });

  it('o salario sai numerico no corpo da requisicao, e formatado no campo', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.employees = [makeEmployee({ name: 'Marcos Lima', salary: 3200 })];
      return world.employees[0];
    });
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Zelador');
    typeSalary('3200');

    // O campo mostra moeda; o separador entre simbolo e numero e nao separavel.
    await waitFor(() => expect(salaryField().value).toMatch(CURRENCY_3200));

    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // O que trafega e numero, e nao a string formatada que aparece na tela.
    expect(lastCreateBody().salary).toBe(3200);
    expect(typeof lastCreateBody().salary).toBe('number');
  });

  it('sem salario informado o corpo leva nulo, e nao zero', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.employees = [makeEmployee({ name: 'Marcos Lima', salary: null })];
      return world.employees[0];
    });
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    expect(salaryField().value).toBe('');

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Zelador');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // Salario ausente nao e salario zero: um diz que nao se sabe, o outro que
    // a pessoa nao recebe.
    expect(lastCreateBody().salary).toBeNull();
  });

  it('o cargo e obrigatorio, e a objecao cai no proprio campo', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    const message = await screen.findByText('Informe o cargo.');
    expect(message).toHaveAttribute('id', 'position-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('desligamento anterior a admissao e recusado no campo de desligamento', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Zelador');
    await user.type(within(dialog()).getByLabelText('Admissao'), '2026-03-10');
    await user.type(within(dialog()).getByLabelText('Desligamento'), '2026-03-09');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    const message = await screen.findByText(
      'A data de desligamento nao pode ser anterior a admissao.',
    );
    expect(message).toHaveAttribute('id', 'terminationDate-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('dois envios em sequencia produzem um unico POST', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.employees = [makeEmployee({ name: 'Marcos Lima' })];
      return world.employees[0];
    });
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Zelador');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Falhas do servidor no formulario de funcionario', () => {
  it('um 422 que aponta o campo aparece nele, e nao em toast', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'position', message: 'Informe o cargo.' },
      ]),
    );
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Zelador');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    const message = await screen.findByText('Informe o cargo.');
    expect(message).toHaveAttribute('id', 'position-error');
    // O formulario define `onError`, o que substitui o handler global: a mesma
    // recusa nao pode aparecer inline e em toast ao mesmo tempo.
    expect(mockToastError).not.toHaveBeenCalled();
    // E, sem campo a que pertenca, nao ha mensagem geral duplicando a objecao.
    expect(screen.queryByText('Dados invalidos.')).not.toBeInTheDocument();
  });

  it('um 409 sem detalhe de campo vira mensagem do formulario, preservando o preenchido', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('CPF informado e invalido.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Nenhum funcionario cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Marcos Lima');
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Zelador');
    await user.type(within(dialog()).getByLabelText('CPF'), '12345678900');
    typeSalary('3200');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByText('CPF informado e invalido.')).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Marcos Lima');
    expect(within(dialog()).getByLabelText('Cargo')).toHaveValue('Zelador');
    expect(within(dialog()).getByLabelText('CPF')).toHaveValue('12345678900');
    expect(salaryField().value).toMatch(CURRENCY_3200);
  });
});

describe('Edicao de funcionario', () => {
  it('os valores atuais chegam preenchidos, com o salario ja formatado', async () => {
    serve([makeEmployee({ salary: 2500 })]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.employees = [makeEmployee({ position: 'Supervisora', status: 'ON_LEAVE' })];
      return world.employees[0];
    });
    renderWithProviders(<EmployeesPage />);

    await screen.findByText('Joana Ribeiro');
    await openEditDialog('Joana Ribeiro');

    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Joana Ribeiro');
    expect(salaryField().value).toMatch(CURRENCY_2500);

    await user.clear(within(dialog()).getByLabelText('Cargo'));
    await user.type(within(dialog()).getByLabelText('Cargo'), 'Supervisora');
    selectOption(within(dialog()).getByLabelText('Status'), 'Afastado');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/employees/employee-1');
    expect(mockPatch.mock.calls[0][1]).toMatchObject({
      position: 'Supervisora',
      status: 'ON_LEAVE',
      salary: 2500,
    });
    expect(await screen.findByText('Supervisora')).toBeInTheDocument();
  });
});
