import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { makeMeta, makeResident, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  chooseOption,
  openCombobox,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Dependent, Resident } from '@/types/api';
import { DependentsPage } from '../dependents-page';

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

/** Mesmo custo de portal do Radix descrito em `dependents-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

/** Fixture local: ver a nota em `dependents-page.test.tsx`. */
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

type World = { dependents: Dependent[]; residents: Resident[] };
let world: World;

function serve(dependents: Dependent[], residents: Resident[] = [makeResident()]): void {
  world = { dependents, residents };
  mockGetPaginated.mockImplementation(async (url) => {
    if (url === '/residents') {
      return {
        data: world.residents,
        meta: makeMeta({ total: world.residents.length, perPage: 200 }),
      };
    }
    return { data: world.dependents, meta: makeMeta({ total: world.dependents.length }) };
  });
}

/** Corpo da ultima criacao pedida. */
function lastCreateBody(): Record<string, unknown> {
  return (mockPost.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

/** Abre o dialogo de cadastro e espera o formulario aparecer. */
async function openCreateDialog(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Novo dependente' }));
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

describe('Cadastro de dependente', () => {
  it('escolher o morador preenche a unidade dele, e e essa que e enviada', async () => {
    serve(
      [],
      [
        makeResident({ id: 'resident-1', name: 'Carlos Pereira' }),
        makeResident({
          id: 'resident-2',
          name: 'Ana Souza',
          unitId: 'unit-2',
          unit: makeUnit({ id: 'unit-2', number: '102' }),
        }),
      ],
    );
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.dependents = [makeDependent({ name: 'Bruno Souza' })];
      return world.dependents[0];
    });
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    // Sem morador escolhido nao ha unidade a mostrar.
    expect(within(dialog()).getByLabelText('Unidade')).toHaveValue('');

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Souza');
    chooseOption(within(dialog()).getByLabelText('Morador'), /Ana Souza/);

    // A unidade e a do morador titular: o servidor recusa qualquer outra.
    expect(within(dialog()).getByLabelText('Unidade')).toHaveValue('Torre A - 102');

    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/dependents');
    // O condominio vem do shell, nao do formulario; os padroes do schema do
    // servidor entram sem que ninguem os toque.
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      residentId: 'resident-2',
      unitId: 'unit-2',
      name: 'Bruno Souza',
      relationship: 'OTHER',
      hasAccessCard: false,
      active: true,
    });
  });

  it('o cadastro fecha o dialogo e a lista chega atualizada sem recarregar a tela', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.dependents = [makeDependent({ name: 'Bruno Souza' })];
      return world.dependents[0];
    });
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Souza');
    chooseOption(within(dialog()).getByLabelText('Morador'), /Carlos Pereira/);
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica e o que traz a lista nova; ninguem pede refetch.
    expect(await screen.findByText('Bruno Souza')).toBeInTheDocument();
  });

  it('o seletor oferece apenas moradores do condominio selecionado', async () => {
    serve(
      [],
      [
        makeResident({ id: 'resident-1', name: 'Carlos Pereira' }),
        makeResident({ id: 'resident-2', name: 'Ana Souza' }),
      ],
    );
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    // A consulta que alimenta o seletor ja nasce presa ao condominio do shell.
    const call = mockGetPaginated.mock.calls.find(([url]) => url === '/residents');
    expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
      condominiumId: 'cond-1',
    });

    openCombobox(within(dialog()).getByLabelText('Morador'));
    // O nome acessivel traz a unidade junto: e ela que distingue dois moradores
    // de mesmo nome, e o rotulo sozinho nao distinguiria.
    expect(
      screen.queryAllByRole('option').map((option) => option.getAttribute('aria-label')),
    ).toEqual(['Carlos Pereira, Torre A - 101', 'Ana Souza, Torre A - 101']);
  });

  it('um nome de dois caracteres e recusado na propria tela', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Jo');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByText('Informe o nome do dependente.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sem morador escolhido a objecao cai no campo, e nada e enviado', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Souza');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    const message = await screen.findByText('Selecione o morador responsavel.');
    expect(message).toHaveAttribute('id', 'residentId-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('dois envios em sequencia produzem um unico POST', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.dependents = [makeDependent({ name: 'Bruno Souza' })];
      return world.dependents[0];
    });
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Souza');
    chooseOption(within(dialog()).getByLabelText('Morador'), /Carlos Pereira/);

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });
});

describe('Falhas do servidor no formulario de dependente', () => {
  it('um 422 que aponta o campo aparece nele, e nao em toast', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'document', message: 'CPF deve conter 11 digitos.' },
      ]),
    );
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Souza');
    await user.type(within(dialog()).getByLabelText('CPF'), '12345678909');
    chooseOption(within(dialog()).getByLabelText('Morador'), /Carlos Pereira/);
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    const message = await screen.findByText('CPF deve conter 11 digitos.');
    expect(message).toHaveAttribute('id', 'document-error');
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
      new ApiError(
        'O dependente deve pertencer a mesma unidade do morador titular.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Nenhum dependente cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Souza');
    await user.type(within(dialog()).getByLabelText('CPF'), '98765432100');
    chooseOption(within(dialog()).getByLabelText('Morador'), /Carlos Pereira/);
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText('O dependente deve pertencer a mesma unidade do morador titular.'),
    ).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Bruno Souza');
    expect(within(dialog()).getByLabelText('CPF')).toHaveValue('98765432100');
    expect(within(dialog()).getByLabelText('Unidade')).toHaveValue('Torre A - 101');
  });
});

describe('Edicao de dependente', () => {
  it('os valores atuais chegam preenchidos e a alteracao sai num unico PATCH', async () => {
    serve([makeDependent()]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.dependents = [makeDependent({ name: 'Lucas Pereira Neto', relationship: 'SIBLING' })];
      return world.dependents[0];
    });
    renderWithProviders(<DependentsPage />);

    await screen.findByText('Lucas Pereira');
    await openEditDialog('Lucas Pereira');

    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Lucas Pereira');
    expect(within(dialog()).getByLabelText('Unidade')).toHaveValue('Torre A - 101');

    await user.clear(within(dialog()).getByLabelText('Nome'));
    await user.type(within(dialog()).getByLabelText('Nome'), 'Lucas Pereira Neto');
    selectOption(within(dialog()).getByLabelText('Parentesco'), 'Irmao(a)');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/dependents/dependent-1');
    expect(mockPatch.mock.calls[0][1]).toMatchObject({
      name: 'Lucas Pereira Neto',
      relationship: 'SIBLING',
      residentId: 'resident-1',
      unitId: 'unit-1',
    });
    expect(await screen.findByText('Lucas Pereira Neto')).toBeInTheDocument();
  });

  it('o morador vinculado que saiu da lista e nomeado como ausente, e nao some calado', async () => {
    serve(
      [makeDependent()],
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
    await openEditDialog('Lucas Pereira');

    expect(
      within(dialog()).getByText(
        'O morador vinculado nao esta mais na lista deste condominio. Escolha outro.',
      ),
    ).toBeInTheDocument();
  });
});
