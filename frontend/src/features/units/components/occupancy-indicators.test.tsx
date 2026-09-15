import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGetPaginated } from '@/lib/api';
import { makeBlock, makeMeta, makeUnit } from '@/test/fixtures';
import { clickTrigger, renderWithProviders, screen, waitFor, within } from '@/test/render';
import type { UnitStatus } from '@/types/api';
import { UnitsPage } from '../units-page';

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

/** Uma contagem que devolve 5xx so falha apos as duas repeticoes do cliente. */
vi.setConfig({ testTimeout: 30_000 });

const mockGetPaginated = vi.mocked(apiGetPaginated);
const TOWER_A = makeBlock({ id: 'block-1', name: 'Torre A' });

type Counts = { total: number; OCCUPIED: number; VACANT: number };

/**
 * Responde as tres contagens — cada uma e uma listagem de um registro so, lida em
 * `meta.total` — e a listagem propriamente dita.
 */
function serve(counts: Counts, options: { countsFail?: boolean } = {}): void {
  mockGetPaginated.mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/blocks') return { data: [TOWER_A], meta: makeMeta({ total: 1 }) };
    if (params.perPage === 1) {
      if (options.countsFail) {
        throw new ApiError('Falha ao contar unidades.', 500, 'INTERNAL_SERVER_ERROR');
      }
      const status = params.status as UnitStatus | undefined;
      const total = status === 'OCCUPIED' || status === 'VACANT' ? counts[status] : counts.total;
      return { data: [], meta: makeMeta({ page: 1, perPage: 1, total }) };
    }
    return {
      data: [makeUnit({ number: '101', block: TOWER_A })],
      meta: makeMeta({ total: counts.total }),
    };
  });
}

/** O cartao cujo rotulo e este, para ler o numero sem confundir com outro. */
function indicator(label: string): HTMLElement {
  return screen.getByText(label).closest('div.app-surface') as HTMLElement;
}

/** Os parametros de cada contagem pedida, para conferir a tecnica do `meta.total`. */
function countCalls(): Record<string, unknown>[] {
  return mockGetPaginated.mock.calls
    .filter(([url, config]) => {
      const params = (config?.params ?? {}) as Record<string, unknown>;
      return url === '/units' && params.perPage === 1;
    })
    .map(([, config]) => (config?.params ?? {}) as Record<string, unknown>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Indicadores de ocupacao', () => {
  it('IT-080: total, ocupadas e disponiveis vem das contagens escopadas ao condominio', async () => {
    serve({ total: 48, OCCUPIED: 30, VACANT: 18 });
    renderWithProviders(<UnitsPage />);

    await waitFor(() =>
      expect(within(indicator('Total de unidades')).getByText('48')).toBeInTheDocument(),
    );
    expect(within(indicator('Unidades ocupadas')).getByText('30')).toBeInTheDocument();
    expect(within(indicator('Unidades disponiveis')).getByText('18')).toBeInTheDocument();

    // Uma pagina de um registro por indicador: nao existe endpoint de agregacao.
    const calls = countCalls();
    expect(calls).toHaveLength(3);
    for (const params of calls) {
      expect(params).toMatchObject({ perPage: 1, condominiumId: 'cond-1' });
    }
    expect(calls.map((params) => params.status)).toEqual([undefined, 'OCCUPIED', 'VACANT']);
  });

  it('IT-081: condominio sem unidades mostra zeros, distintos do carregamento', async () => {
    serve({ total: 0, OCCUPIED: 0, VACANT: 0 });
    renderWithProviders(<UnitsPage />);

    await waitFor(() =>
      expect(within(indicator('Total de unidades')).getByText('0')).toBeInTheDocument(),
    );
    expect(within(indicator('Unidades ocupadas')).getByText('0')).toBeInTheDocument();
    expect(within(indicator('Unidades disponiveis')).getByText('0')).toBeInTheDocument();
    // Zero e um numero; carregando seria um esqueleto no lugar dele.
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  it('IT-082: reforma e bloqueada entram no total e as tres figuras fecham', async () => {
    serve({ total: 10, OCCUPIED: 6, VACANT: 3 });
    renderWithProviders(<UnitsPage />);

    await waitFor(() =>
      expect(within(indicator('Total de unidades')).getByText('10')).toBeInTheDocument(),
    );
    expect(within(indicator('Unidades ocupadas')).getByText('6')).toBeInTheDocument();
    expect(within(indicator('Unidades disponiveis')).getByText('3')).toBeInTheDocument();

    // A diferenca e nomeada, entao 6 + 3 + 1 = 10 sem sugerir que uma unidade
    // esteja em dois estados ao mesmo tempo.
    expect(
      screen.getByText(/Outras 1 em reforma ou bloqueadas completam o total/),
    ).toBeInTheDocument();
  });

  it('IT-083: indicadores que falham reportam a si mesmos e a lista continua util', async () => {
    serve({ total: 0, OCCUPIED: 0, VACANT: 0 }, { countsFail: true });
    renderWithProviders(<UnitsPage />);

    // 5xx ainda passa pelas duas tentativas que o cliente faz antes de desistir.
    expect(
      await screen.findByText(
        'Nao foi possivel carregar os indicadores de ocupacao.',
        {},
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
    // A listagem vem de outra consulta e segue legivel.
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('IT-084: com filtros ativos, o escopo dos indicadores fica explicito', async () => {
    serve({ total: 48, OCCUPIED: 30, VACANT: 18 });
    renderWithProviders(<UnitsPage />);
    await waitFor(() =>
      expect(within(indicator('Total de unidades')).getByText('48')).toBeInTheDocument(),
    );

    expect(screen.getByText(/Indicadores de todo o condominio selecionado\./)).toBeInTheDocument();
    expect(screen.queryByText(/os filtros da lista nao se aplicam/)).not.toBeInTheDocument();

    clickTrigger(screen.getByLabelText('Ocupada'));

    // Os numeros continuam sendo do condominio inteiro; o rotulo passa a dizer isso.
    expect(
      await screen.findByText(/os filtros da lista nao se aplicam a eles/),
    ).toBeInTheDocument();
    expect(within(indicator('Total de unidades')).getByText('48')).toBeInTheDocument();
  });
});
