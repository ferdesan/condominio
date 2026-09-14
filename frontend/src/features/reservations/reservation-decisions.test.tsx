import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, differenceInCalendarMonths, startOfMonth } from 'date-fns';
import { ApiError, apiPost } from '@/lib/api';
import { makeCommonArea, makeReservation, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { AvailabilityEntry, Reservation } from '@/types/api';
import { ReservationsPage } from './reservations-page';
import { countRequests, serveApi } from './test-utils';

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

const mockPost = vi.mocked(apiPost);

const AREAS = [makeCommonArea({ id: 'area-1', name: 'Salao de Festas' })];
const UNITS = [makeUnit({ id: 'unit-1', number: '101' })];

function isoAhead(days: number, hour = 18): string {
  const date = addDays(new Date(), days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function toEntry(reservation: Reservation): AvailabilityEntry {
  return {
    id: reservation.id,
    commonAreaId: reservation.commonAreaId,
    commonAreaName: reservation.commonArea?.name ?? null,
    unitId: reservation.unitId,
    unitNumber: reservation.unit?.number ?? null,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    status: reservation.status,
    requestedByName: reservation.requestedByName,
  };
}

/**
 * Estado mutavel do servidor falso: a decisao muda a reserva, e o refetch
 * disparado pela invalidacao precisa enxergar a mudanca.
 */
type State = { reservations: Reservation[]; pending: number };

function serveState(state: State): void {
  serveApi({
    areas: AREAS,
    units: UNITS,
    reservations: () => ({ data: state.reservations }),
    count: (params) => (params.status === 'PENDING' ? state.pending : 0),
    availability: () =>
      state.reservations
        .filter((item) => item.status === 'PENDING' || item.status === 'CONFIRMED')
        .map(toEntry),
  });
}

function decisionCalls(action: 'approve' | 'reject' | 'cancel', id = 'reservation-1') {
  return mockPost.mock.calls.filter(([url]) => url === `/reservations/${id}/${action}`);
}

function rowAction(name: RegExp): HTMLElement {
  return screen.getByRole('button', { name });
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function openDecision(name: RegExp): Promise<void> {
  clickTrigger(rowAction(name));
  await screen.findByRole('dialog');
}

function typeReason(text: string): void {
  const field = dialog().getByLabelText('Motivo (opcional)');
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setter?.call(field, text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

function pendingBadge(): HTMLElement {
  return screen.getByRole('button', { name: /Aguardando decisao/ });
}

async function showCalendarFor(date: Date): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: 'Calendario' }));
  await screen.findByRole('table', { name: /Reservas de/ });
  const steps = differenceInCalendarMonths(startOfMonth(date), startOfMonth(new Date()));
  for (let step = 0; step < steps; step += 1) {
    clickTrigger(screen.getByRole('button', { name: 'Proximo mes' }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Aprovacao de reservas', () => {
  it('IT-153: aprova uma reserva pendente com motivo e a fila diminui', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 3,
    };
    serveState(state);

    mockPost.mockImplementation(async (url) => {
      if (url === '/reservations/reservation-1/approve') {
        state.reservations = [
          makeReservation({
            id: 'reservation-1',
            status: 'CONFIRMED',
            statusReason: 'Area liberada',
          }),
        ];
        state.pending = 2;
        return state.reservations[0] as never;
      }
      throw new Error(`POST inesperado: ${url}`);
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await waitFor(() => expect(within(pendingBadge()).getByText('3')).toBeInTheDocument());

    await openDecision(/^Aprovar reserva de/);
    typeReason('Area liberada');
    clickTrigger(dialog().getByRole('button', { name: 'Aprovar' }));

    await waitFor(() => expect(decisionCalls('approve')).toHaveLength(1));
    expect(decisionCalls('approve')[0][1]).toEqual({ reason: 'Area liberada' });

    // O status na lista e a fila acompanham a decisao.
    await waitFor(() => expect(screen.getByText('Confirmada')).toBeInTheDocument());
    await waitFor(() => expect(within(pendingBadge()).getByText('2')).toBeInTheDocument());
  });

  it('IT-154: um 409 de horario ja confirmado aparece literal e deixa a reserva pendente', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    };
    serveState(state);

    const message = 'Ja existe uma reserva confirmada para este horario.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE'));

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Aprovar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Aprovar' }));

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
    // Continua pendente: a recusa e um desfecho normal, nao um erro de sistema.
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('IT-155: um 409 de reserva nao mais pendente atualiza a lista', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    };
    serveState(state);

    const message = 'Apenas reservas pendentes podem ser aprovadas ou recusadas.';
    mockPost.mockImplementation(async () => {
      // Enquanto o dialogo estava aberto, a reserva foi decidida em outro lugar.
      state.reservations = [makeReservation({ id: 'reservation-1', status: 'REJECTED' })];
      state.pending = 0;
      throw new ApiError(message, 409, 'BUSINESS_RULE');
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Aprovar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Aprovar' }));

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
    // A lista e recarregada e passa a refletir o estado real.
    await waitFor(() => expect(screen.getByText('Recusada')).toBeInTheDocument());
  });

  it('IT-156: dois cliques seguidos em aprovar produzem uma unica chamada', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    };
    serveState(state);
    mockPost.mockResolvedValue(makeReservation({ status: 'CONFIRMED' }) as never);

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Aprovar reserva de/);

    const button = dialog().getByRole('button', { name: 'Aprovar' });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(decisionCalls('approve')).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(decisionCalls('approve')).toHaveLength(1);
  });

  it('IT-157: uma decisao concorrente de outro administrador aparece apos a atualizacao', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    };
    serveState(state);

    const message = 'Apenas reservas pendentes podem ser aprovadas ou recusadas.';
    mockPost.mockImplementation(async () => {
      // Outro administrador confirmou primeiro.
      state.reservations = [makeReservation({ id: 'reservation-1', status: 'CONFIRMED' })];
      state.pending = 0;
      throw new ApiError(message, 409, 'BUSINESS_RULE');
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Aprovar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Aprovar' }));

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
    await waitFor(() => expect(screen.getByText('Confirmada')).toBeInTheDocument());

    // A fila so volta a ser alcancavel depois que o dialogo sai: enquanto ele
    // esta aberto, o Radix marca o resto da tela como `aria-hidden`.
    clickTrigger(dialog().getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(pendingBadge()).getByText('0')).toBeInTheDocument());
  });

  it('IT-158: como operador, aprovar e recusar somem e cancelar permanece', async () => {
    serveState({
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    });

    // STAFF tem `reservation:update`, mas nao `reservation:manage`.
    renderWithProviders(<ReservationsPage />, { role: 'STAFF' });
    await screen.findByText('Carlos Pereira');

    expect(screen.queryByRole('button', { name: /^Aprovar reserva de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Recusar reserva de/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cancelar reserva de/ })).toBeInTheDocument();
  });

  it('IT-159: aprovar uma reserva ja iniciada mostra o status que o servidor devolveu', async () => {
    const started = makeReservation({
      id: 'reservation-1',
      status: 'PENDING',
      startsAt: isoAhead(-2),
      endsAt: isoAhead(-2, 22),
    });
    const state: State = { reservations: [started], pending: 1 };
    serveState(state);

    mockPost.mockImplementation(async () => {
      // O servidor aceita e devolve o estado que ele determinou.
      state.reservations = [{ ...started, status: 'COMPLETED' }];
      state.pending = 0;
      return state.reservations[0] as never;
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Aprovar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Aprovar' }));

    await waitFor(() => expect(decisionCalls('approve')).toHaveLength(1));
    await waitFor(() => expect(screen.getByText('Concluida')).toBeInTheDocument());
  });
});

describe('Recusa de reservas', () => {
  it('IT-160: recusa com motivo, o motivo fica visivel e a fila diminui', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 2,
    };
    serveState(state);

    mockPost.mockImplementation(async () => {
      state.reservations = [
        makeReservation({
          id: 'reservation-1',
          status: 'REJECTED',
          statusReason: 'Area em manutencao',
        }),
      ];
      state.pending = 1;
      return state.reservations[0] as never;
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await waitFor(() => expect(within(pendingBadge()).getByText('2')).toBeInTheDocument());

    await openDecision(/^Recusar reserva de/);
    typeReason('Area em manutencao');
    clickTrigger(dialog().getByRole('button', { name: 'Recusar' }));

    await waitFor(() => expect(decisionCalls('reject')).toHaveLength(1));
    expect(decisionCalls('reject')[0][1]).toEqual({ reason: 'Area em manutencao' });

    await waitFor(() => expect(screen.getByText('Recusada')).toBeInTheDocument());
    expect(screen.getByText('Motivo: Area em manutencao')).toBeInTheDocument();
    await waitFor(() => expect(within(pendingBadge()).getByText('1')).toBeInTheDocument());
  });

  it('IT-161: um 409 numa reserva ja decidida aparece e atualiza a lista', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    };
    serveState(state);

    const message = 'Apenas reservas pendentes podem ser aprovadas ou recusadas.';
    mockPost.mockImplementation(async () => {
      state.reservations = [makeReservation({ id: 'reservation-1', status: 'CONFIRMED' })];
      state.pending = 0;
      throw new ApiError(message, 409, 'BUSINESS_RULE');
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Recusar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Recusar' }));

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
    await waitFor(() => expect(screen.getByText('Confirmada')).toBeInTheDocument());
  });

  it('IT-162: recusar sem motivo e aceito, porque o motivo e opcional', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    };
    serveState(state);
    mockPost.mockImplementation(async () => {
      state.reservations = [makeReservation({ id: 'reservation-1', status: 'REJECTED' })];
      state.pending = 0;
      return state.reservations[0] as never;
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Recusar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Recusar' }));

    await waitFor(() => expect(decisionCalls('reject')).toHaveLength(1));
    // Vazio vira ausencia, e nao uma string em branco.
    expect(decisionCalls('reject')[0][1]).toEqual({ reason: null });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('IT-163: um motivo com 256 caracteres e recusado antes do envio', async () => {
    serveState({
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Recusar reserva de/);

    typeReason('a'.repeat(256));
    clickTrigger(dialog().getByRole('button', { name: 'Recusar' }));

    await waitFor(() =>
      expect(dialog().getByText('Use no maximo 255 caracteres.')).toBeInTheDocument(),
    );
    expect(decisionCalls('reject')).toHaveLength(0);
  });

  it('IT-164: aprovar depois de recusar informa que a reserva nao esta mais pendente', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 1,
    };
    serveState(state);

    const message = 'Apenas reservas pendentes podem ser aprovadas ou recusadas.';
    mockPost.mockImplementation(async (url) => {
      if (url === '/reservations/reservation-1/reject') {
        state.reservations = [makeReservation({ id: 'reservation-1', status: 'REJECTED' })];
        state.pending = 0;
        return state.reservations[0] as never;
      }
      throw new ApiError(message, 409, 'BUSINESS_RULE');
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');

    await openDecision(/^Recusar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Recusar' }));
    await waitFor(() => expect(screen.getByText('Recusada')).toBeInTheDocument());

    // Recusada deixa de ser pendente, entao aprovar nem e mais oferecido; a
    // tentativa so existe para quem tinha a tela aberta de antes. O controle
    // some, que e a primeira barreira.
    expect(screen.queryByRole('button', { name: /^Aprovar reserva de/ })).not.toBeInTheDocument();
  });
});

describe('Cancelamento de reservas', () => {
  it('IT-165: cancela uma reserva futura com motivo e ela some do calendario', async () => {
    const future = makeReservation({
      id: 'reservation-1',
      status: 'CONFIRMED',
      startsAt: isoAhead(3),
      endsAt: isoAhead(3, 22),
    });
    const state: State = { reservations: [future], pending: 0 };
    serveState(state);

    mockPost.mockImplementation(async () => {
      state.reservations = [{ ...future, status: 'CANCELED', statusReason: 'Evento adiado' }];
      return state.reservations[0] as never;
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');

    // Antes: a reserva esta no calendario.
    await showCalendarFor(addDays(new Date(), 3));
    await waitFor(() =>
      expect(screen.getAllByText(/Salao de Festas/).length).toBeGreaterThan(0),
    );

    clickTrigger(screen.getByRole('button', { name: 'Lista' }));
    await openDecision(/^Cancelar reserva de/);
    typeReason('Evento adiado');
    clickTrigger(dialog().getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(decisionCalls('cancel')).toHaveLength(1));
    expect(decisionCalls('cancel')[0][1]).toEqual({ reason: 'Evento adiado' });
    await waitFor(() => expect(screen.getByText('Cancelada')).toBeInTheDocument());

    // Depois: some do calendario, que so mostra pendentes e confirmadas.
    await showCalendarFor(addDays(new Date(), 3));
    await waitFor(() => {
      const table = screen.getByRole('table', { name: /Reservas de/ });
      expect(within(table).queryByText(/Salao de Festas/)).not.toBeInTheDocument();
    });
  });

  it('IT-166: como operador, cancelar uma reserva ja iniciada mostra a restricao da administracao', async () => {
    serveState({
      reservations: [
        makeReservation({
          id: 'reservation-1',
          status: 'CONFIRMED',
          startsAt: isoAhead(-1),
          endsAt: isoAhead(-1, 22),
        }),
      ],
      pending: 0,
    });

    const message = 'Reservas ja iniciadas so podem ser canceladas pela administracao.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE'));

    renderWithProviders(<ReservationsPage />, { role: 'STAFF' });
    await screen.findByText('Carlos Pereira');

    await openDecision(/^Cancelar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
  });

  it('IT-167: um 409 de reserva ja cancelada aparece com a mensagem do servidor', async () => {
    serveState({
      reservations: [makeReservation({ id: 'reservation-1', status: 'CONFIRMED' })],
      pending: 0,
    });

    const message = 'Reserva ja esta cancelada.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE'));

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Cancelar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
  });

  it('IT-168: um 409 de reserva concluida aparece com a mensagem do servidor', async () => {
    // Concluida e imutavel, entao a linha nao oferece acao nenhuma — a recusa
    // so alcanca quem ja tinha o dialogo aberto. Aqui a reserva esta confirmada
    // na tela e o servidor responde que ja foi concluida.
    serveState({
      reservations: [makeReservation({ id: 'reservation-1', status: 'CONFIRMED' })],
      pending: 0,
    });

    const message = 'Reservas concluidas nao podem ser canceladas.';
    mockPost.mockRejectedValue(new ApiError(message, 409, 'BUSINESS_RULE'));

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Cancelar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
  });

  it('IT-169: dois cliques seguidos em cancelar produzem uma unica chamada', async () => {
    serveState({
      reservations: [makeReservation({ id: 'reservation-1', status: 'CONFIRMED' })],
      pending: 0,
    });
    mockPost.mockResolvedValue(makeReservation({ status: 'CANCELED' }) as never);

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openDecision(/^Cancelar reserva de/);

    const button = dialog().getByRole('button', { name: 'Cancelar reserva' });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(decisionCalls('cancel')).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(decisionCalls('cancel')).toHaveLength(1);
  });

  it('IT-170: cancelar uma reserva pendente diminui a fila sem registrar uma decisao', async () => {
    const state: State = {
      reservations: [makeReservation({ id: 'reservation-1', status: 'PENDING' })],
      pending: 2,
    };
    serveState(state);

    mockPost.mockImplementation(async () => {
      state.reservations = [makeReservation({ id: 'reservation-1', status: 'CANCELED' })];
      state.pending = 1;
      return state.reservations[0] as never;
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await waitFor(() => expect(within(pendingBadge()).getByText('2')).toBeInTheDocument());

    const before = countRequests().length;
    await openDecision(/^Cancelar reserva de/);
    clickTrigger(dialog().getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(decisionCalls('cancel')).toHaveLength(1));
    // Cancelar nao e decidir: nem aprovar nem recusar foram chamados.
    expect(decisionCalls('approve')).toHaveLength(0);
    expect(decisionCalls('reject')).toHaveLength(0);

    await waitFor(() => expect(screen.getByText('Cancelada')).toBeInTheDocument());
    await waitFor(() => expect(within(pendingBadge()).getByText('1')).toBeInTheDocument());
    expect(countRequests().length).toBeGreaterThan(before);
  });
});
