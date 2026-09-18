import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetPaginated } from '@/lib/api';
import { CondominiumContext } from '@/providers/condominium-context';
import { makeBlock, makeCondominium, makeMeta, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Block, Condominium, Unit } from '@/types/api';
import { UnitsPage } from './units-page';

// O duble fica so na camada de transporte (ADR-010).
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
 * Fechar o portal de um select do Radix trava o laco de eventos deste ambiente
 * por dezenas de segundos, e o custo respinga no caso seguinte. Os cinco
 * segundos padrao do vitest nao cobrem isso; o teto maior nao torna nenhum caso
 * mais lento, apenas evita que um caso correto expire por conta do ambiente.
 */
vi.setConfig({ testTimeout: 60_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);

const TOWER_A = makeBlock({ id: 'block-1', name: 'Torre A' });
const TOWER_B = makeBlock({ id: 'block-2', name: 'Torre B' });

type ServeOptions = {
  units?: Unit[];
  blocks?: Block[];
  /** Total anunciado pelo servidor; por padrao, o das linhas entregues. */
  total?: number;
  totalPages?: number;
};

/**
 * Responde as consultas da tela: a listagem, os blocos e as tres contagens dos
 * indicadores, que sao listagens de um registro so lidas em `meta.total`.
 */
function serve(options: ServeOptions = {}): void {
  const { units = [], blocks = [TOWER_A, TOWER_B] } = options;
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') {
      return { data: blocks, meta: makeMeta({ total: blocks.length }) };
    }
    if (params.perPage === 1) {
      const status = params.status as string | undefined;
      const matching = status ? units.filter((unit) => unit.status === status) : units;
      return {
        data: matching.slice(0, 1),
        meta: makeMeta({ page: 1, perPage: 1, total: matching.length }),
      };
    }
    return {
      data: units,
      meta: makeMeta({
        total: options.total ?? units.length,
        totalPages: options.totalPages,
      }),
    };
  });
}

/** Unidades com numeros previsiveis, para conferir qual pagina chegou. */
function makeUnits(count: number, offset = 0): Unit[] {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index + 1;
    return makeUnit({
      id: `unit-${position}`,
      number: String(100 + position),
      floor: Math.ceil(position / 4),
    });
  });
}

/** Uma listagem de 200 unidades servida em paginas de 20. */
function serveManyUnits(total: number): void {
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') {
      return { data: [TOWER_A, TOWER_B], meta: makeMeta({ total: 2 }) };
    }
    if (params.perPage === 1) {
      return { data: [], meta: makeMeta({ page: 1, perPage: 1, total }) };
    }
    const perPage = (params.perPage as number) ?? 20;
    const page = (params.page as number) ?? 1;
    const offset = (page - 1) * perPage;
    return {
      data: makeUnits(Math.max(0, Math.min(perPage, total - offset)), offset),
      meta: makeMeta({ page, perPage, total, totalPages: Math.ceil(total / perPage) }),
    };
  });
}

/** Os parametros da ultima listagem — as contagens pedem `perPage` 1 e ficam de fora. */
function lastListParams(): Record<string, unknown> {
  const calls = mockGetPaginated.mock.calls.filter(([url, config]) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    return url === '/units' && params.perPage !== 1;
  });
  return (calls.at(-1)?.[1]?.params ?? {}) as Record<string, unknown>;
}

/** Linhas de dados, sem o cabecalho. */
function dataRows(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

/**
 * Escolher uma opcao de um select do Radix trava o laco de eventos deste
 * ambiente por dezenas de segundos depois que o portal fecha — o clique em si
 * custa milissegundos. Como `fireEvent` roda dentro de `act`, o efeito, a nova
 * query key e a requisicao ja aconteceram quando `selectOption` retorna, entao
 * o que vem depois de um select e conferido sem `await`. Deixe os `waitFor`
 * antes do select, nunca depois.
 */
function selectBlock(name: string): void {
  selectOption(screen.getByLabelText('Bloco'), name);
}

/**
 * Um shell cujo condominio selecionado pode mudar, como o seletor do topo faz.
 * O provider interno vence o do helper de render, entao a tela le este.
 */
function SwitchableShell({ first, second }: { first: Condominium; second: Condominium }) {
  const [selected, setSelected] = useState(first);
  return (
    <CondominiumContext.Provider
      value={{
        condominiums: [first, second],
        selected,
        selectedId: selected.id,
        select: (id) => setSelected(id === first.id ? first : second),
        isLoading: false,
      }}
    >
      <button type="button" onClick={() => setSelected(second)}>
        Trocar condomínio
      </button>
      <UnitsPage />
    </CondominiumContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de unidades', () => {
  it('IT-044: percorre filtros, ordenação e paginação preservando os parametros', async () => {
    serveManyUnits(25);
    renderWithProviders(<UnitsPage />);

    await screen.findByText('101');
    expect(lastListParams().condominiumId).toBe('cond-1');

    clickTrigger(screen.getByLabelText('Vaga'));
    await waitFor(() => expect(lastListParams().status).toBe('VACANT'));

    clickTrigger(screen.getByRole('button', { name: 'Número' }));
    await waitFor(() => expect(lastListParams().sortBy).toBe('number'));

    selectBlock('Torre B');
    expect(lastListParams().blockId).toBe('block-2');

    clickTrigger(screen.getByRole('button', { name: 'Próxima página' }));

    expect(lastListParams()).toMatchObject({
      page: 2,
      perPage: 20,
      condominiumId: 'cond-1',
      blockId: 'block-2',
      status: 'VACANT',
      sortBy: 'number',
      sortOrder: 'ASC',
    });
  });

  it('IT-045: sem condomínio selecionado a tela explica a exigência e não pede nada', async () => {
    serve({ units: [makeUnit()] });
    renderWithProviders(<UnitsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Nenhuma consulta parte sem escopo — nem a listagem, nem os indicadores.
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  it('IT-046: condomínio sem unidades oferece cadastro individual e geração em lote', async () => {
    serve({ units: [] });
    renderWithProviders(<UnitsPage />);

    expect(await screen.findByText('Nenhuma unidade cadastrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar unidade' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar unidades em lote' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar unidades' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para esta busca')).not.toBeInTheDocument();
  });

  it('IT-047: filtros sem resultado mostram um estado distinto, com ação de limpar', async () => {
    serve({ units: [makeUnit()] });
    renderWithProviders(<UnitsPage />);
    await screen.findByText('101');

    serve({ units: [] });
    clickTrigger(screen.getByLabelText('Bloqueada'));

    expect(await screen.findByText('Nenhum resultado para esta busca')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma unidade cadastrada')).not.toBeInTheDocument();
  });

  it('IT-048: trocar de condomínio limpa o filtro de bloco do anterior', async () => {
    serve({ units: [makeUnit()] });
    const other = makeCondominium({ id: 'cond-2', name: 'Residencial Bosque' });
    renderWithProviders(<SwitchableShell first={makeCondominium()} second={other} />);
    await screen.findByText('101');

    selectBlock('Torre A');
    expect(lastListParams().blockId).toBe('block-1');

    clickTrigger(screen.getByRole('button', { name: 'Trocar condomínio' }));

    // O bloco pertencia ao condominio anterior: mantido, a lista voltaria vazia
    // sem dizer por que.
    expect(lastListParams().condominiumId).toBe('cond-2');
    expect(lastListParams()).not.toHaveProperty('blockId');
  });

  it('IT-049: um condomínio de 200 unidades pagina sem perder linhas', async () => {
    serveManyUnits(200);
    renderWithProviders(<UnitsPage />);

    await screen.findByText('101');
    expect(dataRows()).toHaveLength(20);
    expect(screen.getByText(/Página 1 de 10/)).toBeInTheDocument();

    clickTrigger(screen.getByRole('button', { name: 'Ir para última página' }));

    await screen.findByText('281');
    expect(dataRows()).toHaveLength(20);
    expect(lastListParams()).toMatchObject({ page: 10, perPage: 20 });
  });

  it('IT-050: buscar por um prefixo lista todas as correspondências, paginadas', async () => {
    const matching = [
      makeUnit({ id: 'unit-1', number: '10' }),
      makeUnit({ id: 'unit-2', number: '101' }),
      makeUnit({ id: 'unit-3', number: '1012' }),
    ];
    serve({ units: matching, total: 45, totalPages: 3 });
    const user = createUser();
    renderWithProviders(<UnitsPage />);
    await screen.findByText('10');

    await user.type(screen.getByLabelText('Buscar'), '10');

    // Um unico campo buscavel no servidor: o numero.
    await waitFor(() => expect(lastListParams().search).toBe('10'));
    expect(dataRows()).toHaveLength(3);
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
  });

  it('IT-051: área e fração ausentes viram placeholder, mas zero vagas e zero', async () => {
    serve({
      units: [makeUnit({ area: null, idealFraction: null, parkingSpots: 0 })],
    });
    renderWithProviders(<UnitsPage />);

    const row = (await screen.findByText('101')).closest('tr') as HTMLElement;
    // Area e fracao desconhecidas; a coluna de moradores nao afirma nada sobre
    // uma unidade ocupada — ela diz "Com moradores".
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(within(row).getByText('0')).toBeInTheDocument();
    expect(within(row).queryByText(/null|undefined/)).not.toBeInTheDocument();
  });
});
