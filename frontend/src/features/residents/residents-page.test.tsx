import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';
import {
  makeCondominium,
  makeMeta,
  makeReservation,
  makeResident,
  makeUnit,
} from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Reservation, Resident, Unit } from '@/types/api';
import { ResidentsPage } from './residents-page';

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
 * Abrir e fechar um select do Radix no jsdom deixa a thread ocupada por dezenas
 * de segundos neste ambiente — o mesmo custo que levou `test/render.tsx` a
 * oferecer `openSelect` em vez de `user.click`. Medido aqui: os cliques em si
 * custam ~200ms, mas a primeira espera assincrona que os siga custa 30s a 80s,
 * com ou sem `act`, e o excedente ainda escorre para o caso seguinte.
 *
 * Dai as duas medidas. Depois de `selectOption`, o que da para conferir de forma
 * sincrona e conferido direto: `fireEvent` ja vem embrulhado em `act`, entao o
 * novo pedido saiu antes de a chamada retornar. E o prazo vale para o arquivo
 * inteiro, porque o custo nao respeita a fronteira do caso que o gerou.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

/**
 * Estado do servidor durante um caso. E mutavel de proposito: as consequencias
 * que estes testes verificam — a demissao do responsavel anterior, a unidade que
 * fica vaga — sao recalculadas la, e so aparecem no refetch que a mutacao
 * dispara.
 */
type World = {
  residents: Resident[];
  units: Unit[];
  reservations: Reservation[];
  total?: number;
};

let world: World;

function serve(residents: Resident[], units: Unit[] = [makeUnit()]): void {
  world = { residents, units, reservations: [] };
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;

    if (url === '/units') {
      return { data: world.units, meta: makeMeta({ total: world.units.length, perPage: 200 }) };
    }
    if (url === '/reservations') {
      return { data: world.reservations, meta: makeMeta({ total: world.reservations.length }) };
    }
    return {
      data: world.residents,
      meta: makeMeta({
        total: world.total ?? world.residents.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    };
  });
}

/** Moradores com nomes previsiveis, para conferir qual pagina chegou. */
function makeRoster(count: number, offset = 0): Resident[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeResident({
      id: `resident-${position}`,
      name: `Morador ${String(position).padStart(3, '0')}`,
      document: null,
      isPrimary: false,
    });
  });
}

/** Os parametros da ultima listagem de moradores pedida pela tela. */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/residents');
  return (calls.at(-1)?.[1]?.params ?? {}) as Record<string, unknown>;
}

/** Os parametros da ultima consulta de unidades. */
function lastUnitParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url]) => url === '/units');
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

/**
 * Le a colecao de unidades, que e onde a consequencia de mexer num morador
 * aparece: o servidor recalcula o status da unidade e o cliente so precisa
 * invalidar a chave.
 */
function UnitsProbe() {
  const { data } = useQuery({
    queryKey: ['units', 'probe'],
    queryFn: () => apiGetPaginated<Unit>('/units', { params: { perPage: 200 } }),
  });
  return <p>Ocupação: {data?.data[0]?.status ?? 'carregando'}</p>;
}

/** Le as reservas, cujo solicitante o servidor desnormaliza no proprio registro. */
function ReservationProbe() {
  const { data } = useQuery({
    queryKey: ['reservations', 'probe'],
    queryFn: () => apiGetPaginated<Reservation>('/reservations', { params: {} }),
  });
  return <p>Solicitante: {data?.data[0]?.requestedByName ?? 'carregando'}</p>;
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

describe('Listagem de moradores', () => {
  it('IT-085: percorre busca e filtros de unidade e status preservando os parametros', async () => {
    serve([makeResident()]);
    const user = createUser();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    // Toda consulta nasce presa ao condominio escolhido no shell.
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'Carlos');
    await waitFor(() => expect(lastListParams().search).toBe('Carlos'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta. Um
    // `waitFor` aqui custaria dezenas de segundos — ver a nota do `setConfig`.
    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    selectOption(screen.getByLabelText('Status'), 'Ativo');
    expect(lastListParams().status).toBe('ACTIVE');

    expect(lastListParams().search).toBe('Carlos');
    expect(lastListParams().unitId).toBe('unit-1');
  });

  it('IT-086: CPF e telefone ausentes viram placeholder, nunca "null"', async () => {
    serve([makeResident({ document: null, phone: null })]);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');

    expect(cellsOf('CPF')).toEqual(['—']);
    expect(cellsOf('Telefone')).toEqual(['—']);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('IT-087: um CPF pontuado na busca e enviado apenas com os digitos', async () => {
    serve([makeResident()]);
    const user = createUser();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await user.type(screen.getByLabelText('Buscar'), '123.456.789-09');

    await waitFor(() => expect(lastListParams().search).toBe('12345678909'));
  });

  it('IT-088: lista vazia oferece o cadastro', async () => {
    serve([]);
    renderWithProviders(<ResidentsPage />);

    expect(await screen.findByText('Nenhum morador cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar morador' })).toBeInTheDocument();
  });

  it('IT-089: um morador cuja unidade sumiu ainda rende a linha, com a falta explicita', async () => {
    serve([makeResident({ unit: undefined })]);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');

    expect(cellsOf('Unidade')).toEqual(['Unidade removida']);
  });

  it('IT-090: trezentos moradores paginam no tamanho pedido', async () => {
    serve(makeRoster(20));
    world.total = 300;
    const user = createUser();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Morador 001');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams().perPage).toBe(20);

    world.residents = makeRoster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Morador 021')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });
});

describe('Designação do responsável pela unidade', () => {
  /** Dois moradores da mesma unidade; o primeiro e o responsavel atual. */
  function twoResidents(): Resident[] {
    return [
      makeResident({ id: 'r1', name: 'Carlos Pereira', isPrimary: true }),
      makeResident({ id: 'r2', name: 'Ana Souza', document: '98765432100', isPrimary: false }),
    ];
  }

  /** O servidor limpa a marca dos demais na mesma operacao. */
  function respondByPromoting(): void {
    mockPatch.mockImplementation(async (url) => {
      const promoted = url.split('/').pop();
      world.residents = world.residents.map((resident) => ({
        ...resident,
        isPrimary: resident.id === promoted,
      }));
      return world.residents.find((resident) => resident.id === promoted) as Resident;
    });
  }

  it('IT-107: marcar um responsável deixa exatamente um na unidade', async () => {
    serve(twoResidents());
    respondByPromoting();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Ana Souza');
    clickTrigger(screen.getByRole('button', { name: 'Tornar Ana Souza responsável pela unidade' }));

    await waitFor(() =>
      expect(cellsOf('Responsável').filter((cell) => cell === 'Responsável')).toHaveLength(1),
    );
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith('/residents/r2', { isPrimary: true });
  });

  it('IT-108: o responsável anterior deixa de ser marcado na lista recarregada', async () => {
    serve(twoResidents());
    respondByPromoting();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Ana Souza');
    expect(cellsOf('Responsável')).toEqual(['Responsável', '—']);

    clickTrigger(screen.getByRole('button', { name: 'Tornar Ana Souza responsável pela unidade' }));

    await waitFor(() => expect(cellsOf('Responsável')).toEqual(['—', 'Responsável']));
  });

  it('IT-109: unidade sem responsável não mostra marca nem levanta objeção', async () => {
    serve(twoResidents().map((resident) => ({ ...resident, isPrimary: false })));
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Ana Souza');

    expect(cellsOf('Responsável')).toEqual(['—', '—']);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('IT-110: duas designações seguidas convergem para um único responsável', async () => {
    serve(twoResidents().map((resident) => ({ ...resident, isPrimary: false })));
    respondByPromoting();
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Ana Souza');
    clickTrigger(
      screen.getByRole('button', { name: 'Tornar Carlos Pereira responsável pela unidade' }),
    );
    clickTrigger(screen.getByRole('button', { name: 'Tornar Ana Souza responsável pela unidade' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(cellsOf('Responsável').filter((cell) => cell === 'Responsável')).toHaveLength(1),
    );
  });

  it('IT-111: excluir o responsável deixa a unidade sem nenhum, e isso fica visível', async () => {
    serve(twoResidents());
    mockDelete.mockImplementation(async () => {
      world.residents = world.residents.filter((resident) => resident.id !== 'r1');
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Carlos Pereira' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(screen.queryByText('Carlos Pereira')).not.toBeInTheDocument());
    expect(cellsOf('Responsável')).toEqual(['—']);
  });

  it('IT-112: designar um morador inativo e impedido na própria tela', async () => {
    serve([makeResident({ id: 'r2', name: 'Ana Souza', status: 'INACTIVE', isPrimary: false })]);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Ana Souza');

    expect(
      screen.getByRole('button', { name: 'Tornar Ana Souza responsável pela unidade' }),
    ).toBeDisabled();
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

describe('Exclusao e restauração de moradores', () => {
  it('IT-113: excluir um morador o remove da lista e atualiza a ocupação da unidade', async () => {
    serve([makeResident()], [makeUnit({ status: 'OCCUPIED' })]);
    mockDelete.mockImplementation(async () => {
      world.residents = [];
      // O servidor recalcula: sem morador ativo, a unidade fica vaga.
      world.units = [makeUnit({ status: 'VACANT' })];
    });
    renderWithProviders(
      <>
        <ResidentsPage />
        <UnitsProbe />
      </>,
    );

    await screen.findByText('Carlos Pereira');
    expect(await screen.findByText('Ocupação: OCCUPIED')).toBeInTheDocument();

    clickTrigger(screen.getByRole('button', { name: 'Excluir Carlos Pereira' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/residents/resident-1'));
    await waitFor(() => expect(screen.queryByText('Carlos Pereira')).not.toBeInTheDocument());
    expect(await screen.findByText('Ocupação: VACANT')).toBeInTheDocument();
  });

  it('IT-114: excluir o único morador ativo mostra a unidade vaga', async () => {
    serve(
      [
        makeResident({ id: 'r1', name: 'Carlos Pereira', status: 'ACTIVE' }),
        makeResident({
          id: 'r2',
          name: 'Ana Souza',
          document: '98765432100',
          status: 'MOVED_OUT',
          isPrimary: false,
        }),
      ],
      [makeUnit({ status: 'OCCUPIED' })],
    );
    mockDelete.mockImplementation(async () => {
      world.residents = world.residents.filter((resident) => resident.id !== 'r1');
      world.units = [makeUnit({ status: 'VACANT' })];
    });
    renderWithProviders(
      <>
        <ResidentsPage />
        <UnitsProbe />
      </>,
    );

    await screen.findByText('Carlos Pereira');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Carlos Pereira' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Ocupação: VACANT')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });

  it('IT-115: excluir o responsável não deixa marca de responsável em lugar nenhum', async () => {
    serve([
      makeResident({ id: 'r1', name: 'Carlos Pereira', isPrimary: true }),
      makeResident({ id: 'r2', name: 'Ana Souza', document: '98765432100', isPrimary: false }),
    ]);
    mockDelete.mockImplementation(async () => {
      world.residents = world.residents.filter((resident) => resident.id !== 'r1');
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Carlos Pereira' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(dataRows()).toHaveLength(1));
    expect(cellsOf('Responsável')).toEqual(['—']);
  });

  it('IT-116: restaurar um morador cuja unidade sumiu mostra a falta em vez de calar', async () => {
    const deleted = makeResident({ deletedAt: '2026-02-01T10:00:00.000Z' });
    serve([deleted]);
    const user = createUser();
    mockPost.mockImplementation(async () => {
      // A unidade foi removida nesse meio tempo: o vinculo nao volta com ela.
      world.residents = [makeResident({ deletedAt: null, unit: undefined })];
      return world.residents[0];
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await user.click(screen.getByLabelText('Incluir removidos'));
    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Carlos Pereira' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/residents/resident-1/restore'));
    await waitFor(() => expect(cellsOf('Unidade')).toEqual(['Unidade removida']));
  });

  it('IT-117: um 409 ao restaurar e mostrado e o registro continua removido', async () => {
    serve([makeResident({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Já existe um morador cadastrado com este CPF.', 409, 'CONFLICT'),
    );
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    await user.click(screen.getByLabelText('Incluir removidos'));
    clickTrigger(await screen.findByRole('button', { name: 'Restaurar Carlos Pereira' }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Já existe um morador cadastrado com este CPF.'),
    );
    expect(await screen.findByText('Removido')).toBeInTheDocument();
  });

  it('IT-118: a reserva de um morador excluido preserva o nome de quem a solicitou', async () => {
    serve([makeResident()]);
    world.reservations = [makeReservation({ requestedByName: 'Carlos Pereira' })];
    mockDelete.mockImplementation(async () => {
      world.residents = [];
    });
    renderWithProviders(
      <>
        <ResidentsPage />
        <ReservationProbe />
      </>,
    );

    await screen.findByText('Solicitante: Carlos Pereira');
    clickTrigger(screen.getByRole('button', { name: 'Excluir Carlos Pereira' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    // O nome e desnormalizado no proprio registro da reserva, entao remover o
    // morador nao o apaga — e a tela nao invalida a colecao de reservas.
    expect(screen.getByText('Solicitante: Carlos Pereira')).toBeInTheDocument();
    expect(mockGetPaginated.mock.calls.filter(([url]) => url === '/reservations')).toHaveLength(1);
  });
});

describe('Filtros de moradores', () => {
  it('IT-119: filtra por unidade, tipo e status, com um chip removível para cada', async () => {
    serve([makeResident()]);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');

    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    selectOption(screen.getByLabelText('Tipo'), 'Proprietário');
    expect(lastListParams().type).toBe('OWNER');

    selectOption(screen.getByLabelText('Status'), 'Ativo');
    expect(lastListParams().status).toBe('ACTIVE');

    expect(lastListParams()).toMatchObject({
      condominiumId: 'cond-1',
      unitId: 'unit-1',
      type: 'OWNER',
      status: 'ACTIVE',
    });

    expect(screen.getByLabelText('Remover filtro Unidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Remover filtro Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Remover filtro Status')).toBeInTheDocument();

    clickTrigger(screen.getByLabelText('Remover filtro Tipo'));
    expect(lastListParams().type).toBeUndefined();
  });

  it('IT-120: combinação de filtros sem resultado oferece limpar', async () => {
    serve([makeResident()]);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    world.residents = [];
    selectOption(screen.getByLabelText('Tipo'), 'Ocupante');

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
  });

  it('IT-121: filtro sobre uma unidade removida depois e limpo no refresh', async () => {
    serve([makeResident()]);
    mockDelete.mockImplementation(async () => {
      world.residents = [];
      // A unidade deixou de existir enquanto o filtro seguia ativo.
      world.units = [];
    });
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');
    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    clickTrigger(screen.getByRole('button', { name: 'Excluir Carlos Pereira' }));
    clickTrigger(await screen.findByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(lastListParams().unitId).toBeUndefined());
    expect(screen.queryByLabelText('Remover filtro Unidade')).not.toBeInTheDocument();
  });

  it('IT-122: trocar de condomínio limpa o filtro de unidade', async () => {
    serve([makeResident()]);
    renderWithProviders(
      <SwitchableShell>
        <ResidentsPage />
      </SwitchableShell>,
    );

    await screen.findByText('Carlos Pereira');
    selectOption(screen.getByLabelText('Unidade'), 'Torre A - 101');
    expect(lastListParams().unitId).toBe('unit-1');

    clickTrigger(screen.getByRole('button', { name: 'Trocar condomínio' }));

    await waitFor(() => expect(lastListParams().condominiumId).toBe('cond-2'));
    expect(lastListParams().unitId).toBeUndefined();
    expect(screen.queryByLabelText('Remover filtro Unidade')).not.toBeInTheDocument();
  });

  it('IT-123: nenhum controle e oferecido para filtro fora da whitelist do servidor', async () => {
    serve([makeResident()]);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');

    // Whitelist do servidor: condominiumId (vem do shell), unitId, type, status
    // e userId (sem origem na interface). Qualquer outro controle pareceria
    // funcionar enquanto o backend o descarta em silencio.
    expect(screen.getByLabelText('Unidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();

    for (const absent of ['Responsável', 'E-mail', 'CPF', 'Entrada', 'Condomínio']) {
      expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    }
  });
});

describe('Escopo e permissões', () => {
  it('sem condomínio selecionado a tela explica a exigência e não consulta', async () => {
    serve([makeResident()]);
    renderWithProviders(<ResidentsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(mockGetPaginated.mock.calls.filter(([url]) => url === '/residents')).toHaveLength(0);
  });

  it('um operador ve a listagem sem cadastrar, editar, excluir ou restaurar', async () => {
    serve([makeResident()]);
    renderWithProviders(<ResidentsPage />, { role: 'STAFF' });

    await screen.findByText('Carlos Pereira');

    expect(screen.queryByRole('button', { name: 'Novo morador' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tornar/ })).not.toBeInTheDocument();
  });

  it('um operador não ve restaurar nas linhas removidas', async () => {
    serve([makeResident({ deletedAt: '2026-02-01T10:00:00.000Z' })]);
    const user = createUser();
    renderWithProviders(<ResidentsPage />, { role: 'STAFF' });

    await screen.findByText('Carlos Pereira');
    await user.click(screen.getByLabelText('Incluir removidos'));

    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
  });

  it('a consulta de unidades também fica presa ao condomínio do shell', async () => {
    serve([makeResident()]);
    renderWithProviders(<ResidentsPage />);

    await screen.findByText('Carlos Pereira');

    expect(lastUnitParams()).toMatchObject({ condominiumId: 'cond-1' });
  });
});
