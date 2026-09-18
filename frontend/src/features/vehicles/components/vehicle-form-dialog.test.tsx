import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';
import { makeCondominium, makeMeta, makeResident, makeUnit, makeVehicle } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  chooseOption,
  waitFor,
  within,
} from '@/test/render';
import type { Resident, Unit, Vehicle } from '@/types/api';
import { VehiclesPage } from '../vehicles-page';

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

/** Mesmo custo de portal do Radix descrito em `vehicles-page.test.tsx`. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockToastError = vi.mocked(toast.error);

type World = { vehicles: Vehicle[]; units: Unit[]; residents: Resident[] };
let world: World;

function serve(
  vehicles: Vehicle[],
  units: Unit[] = [makeUnit()],
  residents: Resident[] = [makeResident()],
): void {
  world = { vehicles, units, residents };
  mockGetPaginated.mockImplementation(async (url) => {
    if (url === '/units') {
      return { data: world.units, meta: makeMeta({ total: world.units.length, perPage: 200 }) };
    }
    if (url === '/residents') {
      return {
        data: world.residents,
        meta: makeMeta({ total: world.residents.length, perPage: 200 }),
      };
    }
    if (url !== '/vehicles') throw new Error(`URL nao prevista no teste: ${url}`);
    return { data: world.vehicles, meta: makeMeta({ total: world.vehicles.length }) };
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
  clickTrigger(screen.getByRole('button', { name: 'Novo veículo' }));
  await screen.findByLabelText('Placa');
}

/** Abre o dialogo de edicao do registro e espera os valores carregados. */
async function openEditDialog(plate: string): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: `Editar ${plate}` }));
  await screen.findByLabelText('Placa');
}

function submitCreate(): void {
  clickTrigger(within(dialog()).getByRole('button', { name: 'Cadastrar' }));
}

/**
 * Shell com condominio trocavel. O contexto de dentro vence o que
 * `renderWithProviders` monta, que e fixo por chamada e nao serviria para
 * observar a troca.
 */
function SwitchableShell({ children }: { children: ReactNode }) {
  const condominiums = [
    makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' }),
    makeCondominium({ id: 'cond-2', name: 'Residencial Boreal' }),
  ];
  const [selectedId, setSelectedId] = useState('cond-1');
  const value: CondominiumContextValue = {
    condominiums,
    selected: condominiums.find((item) => item.id === selectedId) ?? null,
    selectedId,
    select: setSelectedId,
    isLoading: false,
  };
  return (
    <CondominiumContext.Provider value={value}>
      <button type="button" onClick={() => setSelectedId('cond-2')}>
        Trocar condomínio
      </button>
      {children}
    </CondominiumContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Cadastro de veículo', () => {
  it('cadastra sem unidade e sem morador, e a linha renderiza', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.vehicles = [
        makeVehicle({ plate: 'XYZ9876', unitId: null, residentId: null, unit: null }),
      ];
      return world.vehicles[0];
    });
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('Nenhum veículo cadastrado');
    await openCreateDialog();

    // Os dois seletores de vinculo abrem em "Sem vinculo": cadastrar um veiculo
    // sem dono e o caminho curto, e nao uma excecao a contornar.
    await user.type(within(dialog()).getByLabelText('Placa'), 'XYZ9876');
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe('/vehicles');
    expect(lastCreateBody()).toMatchObject({
      condominiumId: 'cond-1',
      plate: 'XYZ9876',
      unitId: null,
      residentId: null,
      type: 'CAR',
      status: 'ACTIVE',
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // A invalidacao da fabrica traz a linha nova: ninguem pediu refetch aqui.
    expect(await screen.findByText('XYZ-9876')).toBeInTheDocument();
    expect(screen.getByText('Sem vinculo')).toBeInTheDocument();
  });

  it('cadastra com unidade e morador quando os dois sao escolhidos', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.vehicles = [makeVehicle({ plate: 'XYZ9876' })];
      return world.vehicles[0];
    });
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('Nenhum veículo cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Placa'), 'XYZ9876');
    chooseOption(within(dialog()).getByLabelText('Unidade'), 'Torre A - 101');
    chooseOption(within(dialog()).getByLabelText('Morador'), /Carlos Pereira/);
    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({ unitId: 'unit-1', residentId: 'resident-1' });
  });

  it('uma placa em formato inválido e recusada no próprio campo', async () => {
    serve([]);
    const user = createUser();
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('Nenhum veículo cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Placa'), 'AB12');
    submitCreate();

    const message = await screen.findByText('Placa inválida. Use o formato ABC1234 ou ABC1D23.');
    // A objecao pertence ao campo da placa, e nao ao formulario inteiro.
    expect(message).toHaveAttribute('id', 'plate-error');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('um 422 com campo aparece no campo, e sem toast', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'parkingSpot', message: 'Vaga já ocupada por outro veículo.' },
      ]),
    );
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('Nenhum veículo cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Placa'), 'XYZ9876');
    await user.type(within(dialog()).getByLabelText('Vaga'), 'G1-014');
    submitCreate();

    const message = await screen.findByText('Vaga já ocupada por outro veículo.');
    expect(message).toHaveAttribute('id', 'parkingSpot-error');
    // O formulario define `onError`, entao substitui o toast global em vez de
    // somar a ele: a mesma recusa nao pode aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('um 409 sem campo aparece como mensagem do formulário, preservando o preenchido', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Já existe um veículo cadastrado com esta placa.', 409, 'CONFLICT'),
    );
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('Nenhum veículo cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Placa'), 'XYZ9876');
    await user.type(within(dialog()).getByLabelText('Modelo'), 'Argo');
    submitCreate();

    expect(
      await screen.findByText('Já existe um veículo cadastrado com esta placa.'),
    ).toBeInTheDocument();
    // A verificacao de placa no servidor alcanca tambem os removidos, entao o
    // conflito tem remedio proprio: restaurar (ADR-006).
    expect(screen.getByText(/restaure o registro/i)).toBeInTheDocument();
    // O dialogo fica, com os valores no lugar, para a correcao.
    expect(within(dialog()).getByLabelText('Placa')).toHaveValue('XYZ9876');
    expect(within(dialog()).getByLabelText('Modelo')).toHaveValue('Argo');
  });

  it('dois envios em sequência produzem um único POST', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.vehicles = [makeVehicle({ plate: 'XYZ9876' })];
      return world.vehicles[0];
    });
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('Nenhum veículo cadastrado');
    await openCreateDialog();

    await user.type(within(dialog()).getByLabelText('Placa'), 'XYZ9876');

    const submit = within(dialog()).getByRole('button', { name: 'Cadastrar' });
    clickTrigger(submit);
    clickTrigger(submit);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('o formulário grava no condomínio em que abriu, mesmo se o shell mudar', async () => {
    serve([]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.vehicles = [makeVehicle({ plate: 'XYZ9876' })];
      return world.vehicles[0];
    });
    renderWithProviders(
      <SwitchableShell>
        <VehiclesPage />
      </SwitchableShell>,
    );

    await screen.findByText('Nenhum veículo cadastrado');
    await openCreateDialog();
    await user.type(within(dialog()).getByLabelText('Placa'), 'XYZ9876');

    // Por papel nao da: o dialogo modal marca o resto da pagina como
    // `aria-hidden`, e `getByRole` nao enxerga fora da arvore acessivel.
    clickTrigger(screen.getByText('Trocar condomínio'));

    // A divergencia entre o que o dialogo grava e o que a tela mostra e
    // nomeada, em vez de silenciosamente reapontada (US-027.EC-3).
    expect(await screen.findByText(/continua valendo para/i)).toBeInTheDocument();

    submitCreate();

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(lastCreateBody()).toMatchObject({ condominiumId: 'cond-1' });
  });
});

describe('Edição de veículo', () => {
  it('editar emite um único PATCH e a linha reflete', async () => {
    serve([makeVehicle()]);
    const user = createUser();
    mockPatch.mockImplementation(async () => {
      world.vehicles = [makeVehicle({ model: 'Cronos' })];
      return world.vehicles[0];
    });
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    await openEditDialog('ABC1D23');

    // Os valores atuais chegam preenchidos.
    expect(within(dialog()).getByLabelText('Placa')).toHaveValue('ABC1D23');
    expect(within(dialog()).getByLabelText('Ano')).toHaveValue(2022);

    await user.clear(within(dialog()).getByLabelText('Modelo'));
    await user.type(within(dialog()).getByLabelText('Modelo'), 'Cronos');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][0]).toBe('/vehicles/vehicle-1');
    expect(lastUpdateBody()).toMatchObject({ model: 'Cronos' });
    expect(await screen.findByText('Cronos')).toBeInTheDocument();
  });

  it('desfazer o vinculo envia null, e não a chave ausente', async () => {
    serve([makeVehicle()]);
    mockPatch.mockImplementation(async () => {
      world.vehicles = [makeVehicle({ unitId: null, residentId: null, unit: null })];
      return world.vehicles[0];
    });
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    await openEditDialog('ABC1D23');

    chooseOption(within(dialog()).getByLabelText('Unidade'), 'Sem vinculo');
    chooseOption(within(dialog()).getByLabelText('Morador'), 'Sem vinculo');
    clickTrigger(within(dialog()).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    // Omitir a chave deixaria o vinculo antigo de pe: apagar precisa de `null`.
    expect(lastUpdateBody()).toMatchObject({ unitId: null, residentId: null });
    await waitFor(() => expect(screen.getByText('Sem vinculo')).toBeInTheDocument());
  });
});
