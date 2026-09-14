import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPost } from '@/lib/api';
import { makeMeta, makeResident, makeUnit, makeVehicle } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Resident, Unit, Vehicle } from '@/types/api';
import { VehiclesPage } from './vehicles-page';

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
 * Mesmo custo medido em `residents-page.test.tsx`: abrir um select do Radix no
 * jsdom ocupa a thread por dezenas de segundos, e o excedente escorre para o
 * caso seguinte. Dai o prazo largo, que vale para o arquivo inteiro, e o uso de
 * `selectOption` com assercao sincrona logo depois.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
type World = { vehicles: Vehicle[]; units: Unit[]; residents: Resident[]; total?: number };

let world: World;

function serve(
  vehicles: Vehicle[],
  units: Unit[] = [makeUnit()],
  residents: Resident[] = [makeResident()],
): void {
  world = { vehicles, units, residents };
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;

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

    return {
      data: world.vehicles,
      meta: makeMeta({
        total: world.total ?? world.vehicles.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    };
  });
}

/** Veiculos com placas previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Vehicle[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeVehicle({
      id: `vehicle-${position}`,
      plate: `ABC1D${String(position).padStart(2, '0')}`,
      brand: null,
      model: null,
    });
  });
}

/** Os parametros da ultima listagem de veiculos pedida pela tela. */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/vehicles');
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

describe('Listagem de veiculos', () => {
  it('percorre busca e os quatro filtros preservando os parametros', async () => {
    serve([makeVehicle()]);
    const user = createUser();
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Argo');
    await waitFor(() => expect(lastListParams().search).toBe('Argo'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    selectOption(screen.getByLabelText('Morador'), 'Carlos Pereira');
    expect(lastListParams().residentId).toBe('resident-1');

    selectOption(screen.getByLabelText('Tipo'), 'Carro');
    expect(lastListParams().type).toBe('CAR');

    selectOption(screen.getByLabelText('Status'), 'Ativo');
    expect(lastListParams().status).toBe('ACTIVE');

    // Os controles se somam em vez de se substituirem.
    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      search: 'Argo',
      unitId: 'unit-1',
      residentId: 'resident-1',
      type: 'CAR',
      status: 'ACTIVE',
    });
  });

  it('uma placa pontuada na busca vai em caixa alta e sem separador', async () => {
    serve([makeVehicle()]);
    const user = createUser();
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    await user.type(screen.getByLabelText('Buscar'), 'xyz-9876');

    await waitFor(() => expect(lastListParams().search).toBe('XYZ9876'));
  });

  it('um termo que nao e placa passa intacto para a busca', async () => {
    serve([makeVehicle()]);
    const user = createUser();
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    // A busca cobre marca, modelo e vaga tambem: normalizar tudo dependeria da
    // colacao do banco para ainda casar.
    await user.type(screen.getByLabelText('Buscar'), 'Fiat');

    await waitFor(() => expect(lastListParams().search).toBe('Fiat'));
  });

  it('ordenar por uma coluna envia sortOrder em maiusculas', async () => {
    serve([makeVehicle()]);
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');

    clickTrigger(screen.getByRole('button', { name: 'Placa' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('plate'));
    expect(lastListParams().sortOrder).toBe('ASC');

    // A tabela alterna a direcao; a traducao para a caixa da API e da camada de
    // dados, e e ela que precisa continuar valendo (ADR-009).
    clickTrigger(screen.getByRole('button', { name: 'Placa' }));
    await waitFor(() => expect(lastListParams().sortOrder).toBe('DESC'));
    expect(lastListParams().sortBy).toBe('plate');
  });

  it('trezentos veiculos paginam no tamanho pedido', async () => {
    serve(makeRoster(20));
    world.total = 300;
    const user = createUser();
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D01');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.vehicles = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /proxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('ABC1D21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });

  it('a placa do padrao antigo sai com hifen, e a Mercosul sem', async () => {
    serve([
      makeVehicle({ id: 'v1', plate: 'XYZ9876' }),
      makeVehicle({ id: 'v2', plate: 'ABC1D23' }),
    ]);
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('XYZ-9876');

    expect(cellsOf('Placa')).toEqual(['XYZ-9876', 'ABC1D23']);
  });

  it('campos ausentes viram placeholder, nunca a string "null"', async () => {
    serve([
      makeVehicle({
        brand: null,
        model: null,
        color: null,
        year: null,
        parkingSpot: null,
      }),
    ]);
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');

    expect(cellsOf('Marca')).toEqual(['—']);
    expect(cellsOf('Modelo')).toEqual(['—']);
    expect(cellsOf('Cor')).toEqual(['—']);
    expect(cellsOf('Ano')).toEqual(['—']);
    expect(cellsOf('Vaga')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('um veiculo sem unidade e sem morador rende a linha, com a falta nomeada', async () => {
    serve([makeVehicle({ unitId: null, residentId: null, unit: null })]);
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');

    // Nao ter dono cadastrado e um estado valido, e nao um dado faltando.
    expect(cellsOf('Unidade')).toEqual(['Sem vinculo']);
    expect(dataRows()).toHaveLength(1);
  });

  it('um veiculo cuja unidade sumiu ainda rende a linha, com a falta explicita', async () => {
    serve([makeVehicle({ unitId: 'unit-1', unit: null })]);
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');

    // Havia vinculo e a unidade deixou de existir: e uma ausencia diferente de
    // "sem vinculo", e a coluna as distingue.
    expect(cellsOf('Unidade')).toEqual(['Unidade removida']);
    expect(dataRows()).toHaveLength(1);
  });

  it('nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    serve([makeVehicle()]);
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');

    // Whitelist do servidor: condominiumId (vem do shell), unitId, residentId,
    // type e status. Qualquer outro controle pareceria funcionar enquanto o
    // backend o descarta em silencio.
    expect(screen.getByLabelText('Unidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Morador')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();

    for (const absent of ['Marca', 'Modelo', 'Cor', 'Ano', 'Vaga']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });
});

describe('Estados vazios de veiculos', () => {
  it('lista vazia oferece o cadastro', async () => {
    serve([]);
    renderWithProviders(<VehiclesPage />);

    expect(await screen.findByText('Nenhum veiculo cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar veiculo' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('busca sem resultado oferece limpar, e e distinta da lista vazia', async () => {
    serve([makeVehicle()]);
    const user = createUser();
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    world.vehicles = [];
    await user.type(screen.getByLabelText('Buscar'), 'Gol');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    // Os dois vazios sao estados diferentes e dizem coisas diferentes.
    expect(screen.queryByText('Nenhum veiculo cadastrado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cadastrar veiculo' })).not.toBeInTheDocument();
  });
});

describe('Exclusao e restauracao de veiculos', () => {
  it('excluir pede confirmacao antes de remover', async () => {
    serve([makeVehicle()]);
    mockDelete.mockImplementation(async () => {
      world.vehicles = [];
    });
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    clickTrigger(screen.getByRole('button', { name: 'Excluir ABC1D23' }));

    // O pedido so sai depois da confirmacao.
    expect(await screen.findByText('Excluir veiculo?')).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/vehicles/vehicle-1'));
    await waitFor(() => expect(screen.queryByText('ABC1D23')).not.toBeInTheDocument());
  });

  it('um 409 de impedimento mostra a mensagem do servidor e mantem o registro', async () => {
    serve([makeVehicle()]);
    mockDelete.mockRejectedValue(
      new ApiError('Ha um acesso em aberto para este veiculo.', 409, 'BUSINESS_RULE_VIOLATION'),
    );
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    clickTrigger(screen.getByRole('button', { name: 'Excluir ABC1D23' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    // Acao de linha nao passa `onError`, entao herda o toast global — que e a
    // apresentacao certa para um 409 que traz so a mensagem do servidor.
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Ha um acesso em aberto para este veiculo.'),
    );
    expect(screen.getByText('ABC1D23')).toBeInTheDocument();
  });

  it('incluir removidos envia includeDeleted, e restaurar devolve o registro', async () => {
    serve([makeVehicle({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.vehicles = [makeVehicle({ deletedAt: null })];
      return world.vehicles[0];
    });
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');
    await user.click(screen.getByLabelText('Incluir removidos'));

    await waitFor(() => expect(lastListParams().includeDeleted).toBe(true));
    expect(screen.getByText('Removido')).toBeInTheDocument();

    clickTrigger(await screen.findByRole('button', { name: 'Restaurar ABC1D23' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/vehicles/vehicle-1/restore'));
    await waitFor(() => expect(screen.queryByText('Removido')).not.toBeInTheDocument());
  });
});

describe('Escopo e permissoes de veiculos', () => {
  it('sem condominio selecionado a tela explica a exigencia e nao consulta', async () => {
    serve([makeVehicle()]);
    renderWithProviders(<VehiclesPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condominio')).toBeInTheDocument();
    // Nem a listagem nem os seletores de vinculo saem sem condominio.
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  it('um operador ve a listagem sem cadastrar, editar ou excluir', async () => {
    serve([makeVehicle()]);
    // O operador e leitura pura sobre este recurso (ADR-002).
    renderWithProviders(<VehiclesPage />, { role: 'STAFF', permissions: ['vehicle:read'] });

    await screen.findByText('ABC1D23');

    expect(screen.queryByRole('button', { name: 'Novo veiculo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
  });

  it('um operador nao ve restaurar nas linhas removidas', async () => {
    serve([makeVehicle({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<VehiclesPage />, { role: 'STAFF', permissions: ['vehicle:read'] });

    await screen.findByText('ABC1D23');
    // Ver removidos e leitura; restaurar exige `update` (ADR-006).
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(await screen.findByText('Removido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('os seletores de vinculo tambem ficam presos ao condominio do shell', async () => {
    serve([makeVehicle()]);
    renderWithProviders(<VehiclesPage />);

    await screen.findByText('ABC1D23');

    for (const url of ['/units', '/residents']) {
      const call = mockGetPaginated.mock.calls.find(([called]) => called === url);
      expect((call?.[1]?.params ?? {}) as Record<string, unknown>).toMatchObject({
        condominiumId: 'cond-1',
      });
    }
  });
});
