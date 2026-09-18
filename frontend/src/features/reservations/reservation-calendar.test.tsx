import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addMonths, format, startOfMonth } from 'date-fns';
import { makeAvailabilityEntry, makeCommonArea, makeReservation, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { AvailabilityEntry } from '@/types/api';
import { ReservationsPage } from './reservations-page';
import { availabilityRequests, serveApi } from './test-utils';

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

/** Instante local -> ISO com fuso, como o servidor devolve. */
function at(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function entry(overrides: Partial<AvailabilityEntry> = {}): AvailabilityEntry {
  return makeAvailabilityEntry({ ...overrides });
}

/** Troca para a visao de calendario e espera a grade aparecer. */
async function openCalendar(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Calendário' }));
  await screen.findByRole('table', { name: /Reservas de/ });
}

/** A celula de um dia do mes corrente. */
function dayCell(day: number): HTMLElement {
  const monthLabel = screen.getByRole('table', { name: /Reservas de/ }).getAttribute('aria-label');
  void monthLabel;
  const cells = screen.getAllByRole('cell');
  const found = cells.find(
    (cell) =>
      !cell.getAttribute('aria-label')?.includes('fora do mês') &&
      cell.querySelector('span')?.textContent === String(day),
  );
  if (!found) throw new Error(`Celula do dia ${day} não encontrada`);
  return found;
}

const CURRENT_MONTH = startOfMonth(new Date());

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Calendário de reservas', () => {
  it('IT-130: navega entre meses e filtra por área, pedindo uma disponibilidade por mês', async () => {
    const thisMonth = entry({
      id: 'deste-mes',
      commonAreaName: 'Salao de Festas',
      startsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 10, 18),
      endsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 10, 22),
    });
    const next = addMonths(CURRENT_MONTH, 1);
    const nextMonth = entry({
      id: 'do-proximo',
      commonAreaName: 'Churrasqueira',
      commonAreaId: 'area-2',
      startsAt: at(next.getFullYear(), next.getMonth() + 1, 5, 9),
      endsAt: at(next.getFullYear(), next.getMonth() + 1, 5, 11),
    });

    serveApi({
      areas: AREAS,
      units: [makeUnit()],
      reservations: [makeReservation()],
      availability: (params) => {
        const from = new Date(String(params.from));
        return from.getMonth() === CURRENT_MONTH.getMonth() ? [thisMonth] : [nextMonth];
      },
    });

    renderWithProviders(<ReservationsPage />);
    await openCalendar();

    await waitFor(() =>
      expect(within(dayCell(10)).getByText(/Salao de Festas/)).toBeInTheDocument(),
    );

    const first = availabilityRequests().at(-1);
    expect(first?.condominiumId).toBe('cond-1');
    expect(new Date(String(first?.from)).getMonth()).toBe(CURRENT_MONTH.getMonth());
    expect(new Date(String(first?.to)).getMonth()).toBe(CURRENT_MONTH.getMonth());

    clickTrigger(screen.getByRole('button', { name: 'Próximo mês' }));

    await waitFor(() => expect(within(dayCell(5)).getByText(/Churrasqueira/)).toBeInTheDocument());
    expect(new Date(String(availabilityRequests().at(-1)?.from)).getMonth()).toBe(next.getMonth());
    // Um pedido por mes: o do mes atual e o do seguinte.
    expect(availabilityRequests()).toHaveLength(2);

    selectOption(screen.getByLabelText('Área comum'), 'Churrasqueira');

    await waitFor(() => expect(availabilityRequests().at(-1)?.commonAreaId).toBe('area-2'));
  });

  it('IT-131: um mês sem reservas renderiza a grade cheia de dias vazios', async () => {
    serveApi({ areas: AREAS, units: [makeUnit()], reservations: [], availability: [] });

    renderWithProviders(<ReservationsPage />);
    await openCalendar();

    // Os dias continuam visiveis, e nao uma area em branco.
    expect(screen.getAllByRole('cell').length).toBeGreaterThanOrEqual(28);
    expect(dayCell(1)).toBeInTheDocument();
    expect(within(dayCell(1)).queryByText(/Salao/)).not.toBeInTheDocument();
  });

  it('IT-132: um dia acima do teto mostra o teto e um indicador do restante', async () => {
    const entries = Array.from({ length: 5 }, (_, index) =>
      entry({
        id: `reservation-${index + 1}`,
        commonAreaName: `Área ${index + 1}`,
        startsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 12, 8 + index),
        endsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 12, 9 + index),
      }),
    );

    serveApi({ areas: AREAS, units: [makeUnit()], reservations: [], availability: entries });

    renderWithProviders(<ReservationsPage />);
    await openCalendar();

    const cell = await waitFor(() => {
      const found = dayCell(12);
      expect(within(found).getByText(/Área 1/)).toBeInTheDocument();
      return found;
    });

    // Tres entradas visiveis e duas anunciadas como restantes.
    expect(within(cell).getAllByRole('listitem')).toHaveLength(3);
    expect(within(cell).getByText('+2 reservas')).toBeInTheDocument();
  });

  it('IT-133: uma entrada que cruza a meia-noite aparece nos dois dias', async () => {
    const crossing = entry({
      id: 'virada',
      commonAreaName: 'Salao de Festas',
      startsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 14, 23),
      endsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 15, 1),
    });

    serveApi({ areas: AREAS, units: [makeUnit()], reservations: [], availability: [crossing] });

    renderWithProviders(<ReservationsPage />);
    await openCalendar();

    await waitFor(() =>
      expect(within(dayCell(14)).getByText(/Salao de Festas/)).toBeInTheDocument(),
    );
    expect(within(dayCell(15)).getByText(/Salao de Festas/)).toBeInTheDocument();
  });

  it('IT-134: fevereiro de um ano bissexto mostra 29 dias com as bordas marcadas', async () => {
    serveApi({ areas: AREAS, units: [makeUnit()], reservations: [], availability: [] });

    renderWithProviders(<ReservationsPage />);
    await openCalendar();

    // Anda ate fevereiro de 2028, que e bissexto.
    const target = new Date(2028, 1, 1);
    const steps =
      (target.getFullYear() - CURRENT_MONTH.getFullYear()) * 12 +
      (target.getMonth() - CURRENT_MONTH.getMonth());
    const forward = screen.getByRole('button', { name: 'Próximo mês' });
    for (let step = 0; step < steps; step += 1) clickTrigger(forward);

    await screen.findByRole('table', {
      name: new RegExp(format(target, 'yyyy')),
    });

    const cells = screen.getAllByRole('cell');
    const inMonth = cells.filter(
      (cell) => !cell.getAttribute('aria-label')?.includes('fora do mês'),
    );
    expect(inMonth).toHaveLength(29);

    // Os dias de preenchimento existem e sao identificaveis.
    const outside = cells.filter((cell) =>
      cell.getAttribute('aria-label')?.includes('fora do mês'),
    );
    expect(outside.length).toBeGreaterThan(0);
  });

  it('IT-135: avancar dois meses rapido mostra o mês da última resposta, e não o da que atrasou', async () => {
    const second = addMonths(CURRENT_MONTH, 1);
    const third = addMonths(CURRENT_MONTH, 2);

    const slow = entry({
      id: 'atrasada',
      commonAreaName: 'Resposta atrasada',
      startsAt: at(second.getFullYear(), second.getMonth() + 1, 7, 10),
      endsAt: at(second.getFullYear(), second.getMonth() + 1, 7, 12),
    });
    const fast = entry({
      id: 'ultima',
      commonAreaName: 'Resposta final',
      startsAt: at(third.getFullYear(), third.getMonth() + 1, 9, 10),
      endsAt: at(third.getFullYear(), third.getMonth() + 1, 9, 12),
    });

    serveApi({
      areas: AREAS,
      units: [makeUnit()],
      reservations: [],
      // O segundo mes responde depois do terceiro.
      availability: async (params) => {
        const month = new Date(String(params.from)).getMonth();
        if (month === second.getMonth()) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          return [slow];
        }
        if (month === third.getMonth()) return [fast];
        return [];
      },
    });

    renderWithProviders(<ReservationsPage />);
    await openCalendar();

    const forward = screen.getByRole('button', { name: 'Próximo mês' });
    clickTrigger(forward);
    clickTrigger(forward);

    await waitFor(() => expect(within(dayCell(9)).getByText(/Resposta final/)).toBeInTheDocument());

    // A resposta do mes anterior chega depois e nao pode substituir a exibida.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.queryByText(/Resposta atrasada/)).not.toBeInTheDocument();
    expect(within(dayCell(9)).getByText(/Resposta final/)).toBeInTheDocument();
  });

  it('IT-136: recusadas, canceladas e concluidas ficam fora do calendário e dentro da lista', async () => {
    const confirmed = entry({
      id: 'confirmada',
      commonAreaName: 'Salao de Festas',
      status: 'CONFIRMED',
      startsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 18, 10),
      endsAt: at(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth() + 1, 18, 12),
    });

    serveApi({
      areas: AREAS,
      units: [makeUnit()],
      // A listagem e exaustiva: traz os estados que o calendario omite. Os
      // nomes nao repetem os rotulos de status, para que a asercao distinga
      // a linha do distintivo.
      reservations: [
        makeReservation({ id: 'r-1', status: 'CONFIRMED', requestedByName: 'Bruno Lima' }),
        makeReservation({ id: 'r-2', status: 'REJECTED', requestedByName: 'Carla Reis' }),
        makeReservation({ id: 'r-3', status: 'CANCELED', requestedByName: 'Diego Alves' }),
        makeReservation({ id: 'r-4', status: 'COMPLETED', requestedByName: 'Elisa Nunes' }),
      ],
      // A disponibilidade devolve apenas pendentes e confirmadas.
      availability: [confirmed],
    });

    renderWithProviders(<ReservationsPage />);

    // A lista mostra os quatro estados, inclusive os que o calendario omite.
    await screen.findByText('Carla Reis');
    expect(screen.getByText('Diego Alves')).toBeInTheDocument();
    expect(screen.getByText('Elisa Nunes')).toBeInTheDocument();
    expect(screen.getByText('Recusada')).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByText('Concluida')).toBeInTheDocument();

    await openCalendar();
    await waitFor(() =>
      expect(within(dayCell(18)).getByText(/Salao de Festas/)).toBeInTheDocument(),
    );

    // O calendario explica o proprio recorte.
    expect(screen.getByText(/apenas reservas pendentes e confirmadas/i)).toBeInTheDocument();
  });

  it('IT-137: sem condomínio selecionado, o calendário explica a exigência', async () => {
    serveApi({ areas: [], units: [], reservations: [], availability: [] });

    renderWithProviders(<ReservationsPage />, { condominium: null });

    clickTrigger(screen.getByRole('button', { name: 'Calendário' }));

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Reservas de/ })).not.toBeInTheDocument();
    // Sem condominio nao ha o que pedir.
    expect(availabilityRequests()).toHaveLength(0);
  });
});
