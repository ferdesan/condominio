import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
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
import type { Resident, Unit } from '@/types/api';
import { ResidentsPage } from '../residents-page';

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
 * Mesmo custo descrito em `residents-page.test.tsx`: mexer num select do Radix
 * no jsdom trava a thread por dezenas de segundos, e o excedente escorre para o
 * caso seguinte. Por isso os casos que so verificam validacao local nao abrem o
 * seletor de unidade — a objecao que investigam aparece de qualquer forma.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);

type World = { residents: Resident[]; units: Unit[] };
let world: World;

function serve(residents: Resident[], units: Unit[] = [makeUnit()]): void {
  world = { residents, units };
  mockGetPaginated.mockImplementation(async (url) => {
    if (url === '/units') {
      return { data: world.units, meta: makeMeta({ total: world.units.length, perPage: 200 }) };
    }
    return { data: world.residents, meta: makeMeta({ total: world.residents.length }) };
  });
}

/** Corpo da ultima criacao pedida. */
function lastCreateBody(): Record<string, unknown> {
  return (mockPost.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

/** Corpo da ultima atualizacao pedida. */
function lastUpdateBody(): Record<string, unknown> {
  return (mockPatch.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

/** Abre o dialogo de cadastro e espera o formulario aparecer. */
async function openCreateDialog(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Novo morador' }));
  await screen.findByLabelText('Nome');
}

/** Abre o dialogo de edicao do registro e espera os valores carregados. */
async function openEditDialog(name: string): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Editar ${name}` }));
  await screen.findByLabelText('Nome');
}

/** Le a colecao de unidades, onde o recalculo de ocupacao aparece. */
function UnitsProbe() {
  const { data } = useQuery({
    queryKey: ['units', 'probe'],
    queryFn: () => apiGetPaginated<Unit>('/units', { params: { perPage: 200 } }),
  });
  return <p>Ocupacao: {data?.data[0]?.status ?? 'carregando'}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Cadastro de morador', () => {
  it('IT-091: cadastra um morador contra uma unidade, e a unidade passa a ocupada', async () => {
    serve([], [makeUnit({ status: 'VACANT' })]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.residents = [makeResident({ name: 'Bruno Lima' })];
      // O servidor recalcula: o primeiro morador ativo ocupa a unidade.
      world.units = [makeUnit({ status: 'OCCUPIED' })];
      return world.residents[0];
    });
    renderWithProviders(
      <>
        <ResidentsPage />
        <UnitsProbe />
      </>,
    );

    await screen.findByText('Nenhum morador cadastrado');
    expect(await screen.findByText('Ocupacao: VACANT')).toBeInTheDocument();
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Lima');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/residents');
    // O condominio vem do shell, nao do formulario; os padroes documentados
    // entram sem que ninguem os toque.
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      unitId: 'unit-1',
      name: 'Bruno Lima',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: false,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument();
    expect(await screen.findByText('Ocupacao: OCCUPIED')).toBeInTheDocument();
  });

  it('IT-092: digito verificador invalido aparece no formulario e preserva o que foi digitado', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('CPF informado e invalido.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Lima');
    await user.type(within(dialog()).getByLabelText('CPF'), '12345678900');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByText('CPF informado e invalido.')).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Bruno Lima');
    expect(within(dialog()).getByLabelText('CPF')).toHaveValue('12345678900');
    // Recusa de regra nao tem saida alternativa: nao se oferece restaurar.
    expect(screen.queryByText(/restaure o registro/i)).not.toBeInTheDocument();
  });

  it('IT-093: CPF ja cadastrado aparece com a mensagem do servidor e o caminho da restauracao', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Ja existe um morador cadastrado com este CPF.', 409, 'CONFLICT'),
    );
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Lima');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    expect(
      await screen.findByText('Ja existe um morador cadastrado com este CPF.'),
    ).toBeInTheDocument();
    // A recusa por conflito e a unica das duas que tem remedio proprio.
    expect(screen.getByText(/restaure o registro/i)).toBeInTheDocument();
  });

  it('IT-094: o seletor oferece apenas unidades do condominio selecionado', async () => {
    serve(
      [],
      [makeUnit({ id: 'unit-1', number: '101' }), makeUnit({ id: 'unit-2', number: '102' })],
    );
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    // A consulta que alimenta o seletor ja nasce presa ao condominio do shell.
    const unitCall = mockGetPaginated.mock.calls.find(([url]) => url === '/units');
    expect((unitCall?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
      condominiumId: 'cond-1',
    });

    const trigger = within(dialog()).getByLabelText('Unidade');
    trigger.focus();
    clickTrigger(trigger);
    const options = screen.queryAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Torre A - 101', 'Torre A - 102']);
  });

  it('IT-095: um nome de dois caracteres e recusado na propria tela', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Jo');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByText('Informe o nome do morador.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-096: sem CPF e sem e-mail o cadastro passa, e nenhum consentimento e alegado', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.residents = [makeResident({ name: 'Bruno Lima', document: null, email: null })];
      return world.residents[0];
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    // O carimbo de consentimento e do servidor: o formulario nao o exibe nem o envia.
    expect(screen.queryByText(/consentimento|lgpd/i)).not.toBeInTheDocument();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Lima');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({ document: null, email: null });
    expect(lastCreateBody()).not.toHaveProperty('lgpdConsentAt');
    expect(screen.queryByText(/consentimento|lgpd/i)).not.toBeInTheDocument();
  });

  it('IT-097: saida anterior a entrada e recusada no campo de saida', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Lima');
    await user.type(within(dialog()).getByLabelText('Entrada'), '2026-03-10');
    await user.type(within(dialog()).getByLabelText('Saida'), '2026-03-09');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    const message = await screen.findByText(
      'A data de saida nao pode ser anterior a data de entrada.',
    );
    expect(message).toBeInTheDocument();
    // A objecao pertence ao campo de saida, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'moveOutDate-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-098: data de nascimento no futuro e recusada na propria tela', async () => {
    serve([]);
    const user = createUser();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Lima');
    await user.type(within(dialog()).getByLabelText('Data de nascimento'), future);
    clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));

    const message = await screen.findByText('A data de nascimento nao pode estar no futuro.');
    expect(message).toHaveAttribute('id', 'birthDate-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('IT-099: dois envios em sequencia produzem um unico POST', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.residents = [makeResident({ name: 'Bruno Lima' })];
      return world.residents[0];
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Nenhum morador cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Nome'), 'Bruno Lima');
    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('IT-100: condominio sem unidades explica que a unidade vem primeiro', async () => {
    serve([], []);
    renderWithProviders(<ResidentsPage />);

    expect(
      await screen.findByText(
        'Cadastre ao menos uma unidade antes de registrar moradores: todo morador ocupa uma unidade.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo morador' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cadastrar morador' })).not.toBeInTheDocument();
  });
});

describe('Edicao de morador', () => {
  it('IT-101: editar a unidade e o status emite um unico PATCH e a linha reflete', async () => {
    serve(
      [makeResident()],
      [makeUnit({ id: 'unit-1', number: '101' }), makeUnit({ id: 'unit-2', number: '102' })],
    );
    mockPatch.mockImplementation(async () => {
      world.residents = [
        makeResident({
          unitId: 'unit-2',
          status: 'INACTIVE',
          unit: makeUnit({ id: 'unit-2', number: '102' }),
        }),
      ];
      return world.residents[0];
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await openEditDialog('Carlos Pereira');

    // Os valores atuais chegam preenchidos.
    expect(within(dialog()).getByLabelText('Nome')).toHaveValue('Carlos Pereira');

    selectOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 102');
    selectOption(within(dialog()).getByLabelText('Status'), 'Inativo');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/residents/resident-1');
    expect(lastUpdateBody()).toMatchObject({ unitId: 'unit-2', status: 'INACTIVE' });
    expect(await screen.findByText('Torre A - 102')).toBeInTheDocument();
  });

  it('IT-102: mudar o ultimo morador ativo para mudou-se deixa a unidade vaga', async () => {
    serve([makeResident()], [makeUnit({ status: 'OCCUPIED' })]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.residents = [makeResident({ status: 'MOVED_OUT', moveOutDate: '2026-03-20' })];
      // O servidor recalcula: sem morador ativo, a unidade fica vaga.
      world.units = [makeUnit({ status: 'VACANT' })];
      return world.residents[0];
    });
    renderWithProviders(
      <>
        <ResidentsPage />
        <UnitsProbe />
      </>,
    );

    await screen.findByText('Carlos Pereira');
    expect(await screen.findByText('Ocupacao: OCCUPIED')).toBeInTheDocument();

    await openEditDialog('Carlos Pereira');
    await user.type(within(dialog()).getByLabelText('Saida'), '2026-03-20');
    selectOption(within(dialog()).getByLabelText('Status'), 'Mudou-se');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(lastUpdateBody()).toMatchObject({ status: 'MOVED_OUT', moveOutDate: '2026-03-20' });
    expect(await screen.findByText('Ocupacao: VACANT')).toBeInTheDocument();
  });

  it('IT-103: unidade de outro condominio e recusada com a mensagem do servidor', async () => {
    serve([makeResident()]);
    const user = createUser();
    mockPatch.mockRejectedValue(
      new ApiError(
        'A unidade informada pertence a outro condominio.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await openEditDialog('Carlos Pereira');

    await user.clear(within(dialog()).getByLabelText('Nome'));
    await user.type(within(dialog()).getByLabelText('Nome'), 'Carlos Pereira Neto');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('A unidade informada pertence a outro condominio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('IT-104: conflito de CPF na edicao mantem o dialogo aberto', async () => {
    serve([makeResident()]);
    const user = createUser();
    mockPatch.mockRejectedValue(
      new ApiError('Ja existe um morador cadastrado com este CPF.', 409, 'CONFLICT'),
    );
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await openEditDialog('Carlos Pereira');

    await user.clear(within(dialog()).getByLabelText('CPF'));
    await user.type(within(dialog()).getByLabelText('CPF'), '98765432100');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Ja existe um morador cadastrado com este CPF.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('CPF')).toHaveValue('98765432100');
  });

  it('IT-105: um 404 na edicao fecha o dialogo e recarrega a lista', async () => {
    serve([makeResident()]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.residents = [];
      throw new ApiError('Morador nao encontrado.', 404, 'NOT_FOUND');
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await openEditDialog('Carlos Pereira');

    await user.clear(within(dialog()).getByLabelText('Nome'));
    await user.type(within(dialog()).getByLabelText('Nome'), 'Carlos Pereira Neto');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Nenhum morador cadastrado')).toBeInTheDocument();
  });

  it('IT-106: limpar a saida de quem consta como mudado levanta a inconsistencia', async () => {
    serve([makeResident({ status: 'MOVED_OUT', moveOutDate: '2026-03-20' })]);
    const user = createUser();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await openEditDialog('Carlos Pereira');

    expect(within(dialog()).getByLabelText('Saida')).toHaveValue('2026-03-20');
    await user.clear(within(dialog()).getByLabelText('Saida'));
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    const message = await screen.findByText(
      'Informe a data de saida de um morador que consta como mudado.',
    );
    expect(message).toHaveAttribute('id', 'moveOutDate-error');
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
