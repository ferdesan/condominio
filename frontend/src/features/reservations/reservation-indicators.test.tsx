import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endOfMonth, startOfMonth } from 'date-fns';
import { ApiError } from '@/lib/api';
import { makeCommonArea, makeReservation, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import { ReservationsPage } from './reservations-page';
import { countRequests, serveApi, type RequestParams } from './test-utils';

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

const AREAS = [
  makeCommonArea({ id: 'area-1', name: 'Salao de Festas' }),
  makeCommonArea({ id: 'area-2', name: 'Churrasqueira' }),
];
const UNITS = [makeUnit({ id: 'unit-1', number: '101' })];

function panel() {
  return within(screen.getByRole('region', { name: /Indicadores de/ }));
}

/** Contagens que carregam o intervalo do mes — as dos indicadores. */
function rangeRequests(): RequestParams[] {
  return countRequests().filter((params) => params.from !== undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Indicadores do mes', () => {
  it('IT-171: mostra total, detalhamento por area e cancelamentos a partir de contagens com o intervalo do mes', async () => {
    serveApi({
      areas: AREAS,
      units: UNITS,
      reservations: [makeReservation()],
      count: (params) => {
        if (params.status === 'PENDING') return 2;
        if (params.status === 'CANCELED') return 3;
        if (params.commonAreaId === 'area-1') return 7;
        if (params.commonAreaId === 'area-2') return 4;
        return 11;
      },
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');

    await waitFor(() => expect(panel().getByText('11')).toBeInTheDocument());
    expect(panel().getByText('Reservas no mes')).toBeInTheDocument();
    expect(panel().getByText('Cancelamentos')).toBeInTheDocument();
    expect(panel().getByText('3')).toBeInTheDocument();

    // Detalhamento por area.
    expect(panel().getByText('Salao de Festas')).toBeInTheDocument();
    expect(panel().getByText('7')).toBeInTheDocument();
    expect(panel().getByText('Churrasqueira')).toBeInTheDocument();
    expect(panel().getByText('4')).toBeInTheDocument();

    // Toda contagem de indicador carrega o intervalo do mes exibido.
    const month = startOfMonth(new Date());
    const requests = rangeRequests();
    expect(requests.length).toBeGreaterThanOrEqual(4);
    for (const params of requests) {
      expect(new Date(String(params.from)).getTime()).toBe(month.getTime());
      expect(new Date(String(params.to)).getTime()).toBe(endOfMonth(month).getTime());
      expect(params.condominiumId).toBe('cond-1');
      expect(params.perPage).toBe(1);
    }

    // Uma contagem por area, alem do total e dos cancelamentos.
    expect(requests.filter((params) => params.commonAreaId === 'area-1')).toHaveLength(1);
    expect(requests.filter((params) => params.commonAreaId === 'area-2')).toHaveLength(1);
    expect(requests.filter((params) => params.status === 'CANCELED')).toHaveLength(1);
  });

  it('IT-172: um mes sem reservas mostra zeros, e nao um estado de carregamento', async () => {
    serveApi({ areas: AREAS, units: UNITS, reservations: [], count: () => 0 });

    renderWithProviders(<ReservationsPage />);

    await waitFor(() => expect(panel().getAllByText('0').length).toBeGreaterThanOrEqual(2));
    // Numeros de verdade no lugar dos esqueletos.
    expect(panel().getByText('Reservas no mes')).toBeInTheDocument();
    expect(panel().getByText('Cancelamentos')).toBeInTheDocument();
  });

  it('IT-173: um condominio sem areas comuns explica o detalhamento vazio', async () => {
    serveApi({ areas: [], units: UNITS, reservations: [makeReservation()], count: () => 0 });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');

    await waitFor(() =>
      expect(
        panel().getByText('Nenhuma area comum cadastrada neste condominio.'),
      ).toBeInTheDocument(),
    );
  });

  it('IT-174: indicadores que falham nao derrubam a lista', async () => {
    serveApi({
      areas: AREAS,
      units: UNITS,
      reservations: [makeReservation()],
      // 4xx para nao acionar as repeticoes do cliente.
      count: () => {
        throw new ApiError('Falha ao carregar indicadores.', 403, 'FORBIDDEN');
      },
    });

    renderWithProviders(<ReservationsPage />);

    // A lista continua utilizavel.
    expect(await screen.findByText('Carlos Pereira')).toBeInTheDocument();

    // E a area de indicadores reporta a propria falha.
    await waitFor(() =>
      expect(panel().getByRole('alert')).toHaveTextContent(
        /Nao foi possivel carregar os indicadores do mes/i,
      ),
    );
  });

  it('IT-175: doze areas comuns rendem um detalhamento legivel, sem transbordar', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeCommonArea({ id: `area-${index + 1}`, name: `Area ${index + 1}` }),
    );

    serveApi({
      areas: many,
      units: UNITS,
      reservations: [makeReservation()],
      count: (params) => (params.commonAreaId ? 1 : 12),
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');

    // Seis areas listadas e as demais agrupadas numa linha so.
    await waitFor(() => expect(panel().getByText('Outras 6 areas')).toBeInTheDocument());
    const items = panel().getAllByRole('listitem');
    expect(items).toHaveLength(7);
  });

  it('IT-176: com filtros ativos na lista, os indicadores dizem qual e o seu escopo', async () => {
    serveApi({
      areas: AREAS,
      units: UNITS,
      reservations: [makeReservation()],
      count: () => 5,
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');

    const before = rangeRequests().length;
    const signatureBefore = JSON.stringify(rangeRequests());

    // Filtra a lista por area.
    selectOption(screen.getByLabelText('Area comum'), 'Churrasqueira');
    await waitFor(() =>
      expect(screen.getByText('Area comum:').closest('div')?.textContent).toContain(
        'Churrasqueira',
      ),
    );

    // O rotulo deixa explicito que os numeros descrevem o mes, e nao o recorte.
    expect(
      panel().getByText('Numeros do mes inteiro, independentes dos filtros aplicados na lista.'),
    ).toBeInTheDocument();
    expect(panel().getByRole('heading', { name: /^Indicadores de /i })).toBeInTheDocument();

    // E o filtro da lista nao muda as contagens pedidas: exatamente as mesmas
    // consultas de antes, nem uma a mais. O detalhamento continua consultando
    // cada area — inclusive a que a lista filtrou —, porque descreve o mes
    // inteiro e nao o recorte.
    expect(rangeRequests()).toHaveLength(before);
    expect(JSON.stringify(rangeRequests())).toBe(signatureBefore);

    // Trocar o mes, esse sim, redescreve os indicadores.
    clickTrigger(screen.getByRole('button', { name: 'Calendario' }));
    await screen.findByRole('table', { name: /Reservas de/ });
    clickTrigger(screen.getByRole('button', { name: 'Proximo mes' }));

    await waitFor(() => expect(rangeRequests().length).toBeGreaterThan(before));
  });
});
