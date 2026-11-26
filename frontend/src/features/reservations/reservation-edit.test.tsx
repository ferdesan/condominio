import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, format } from 'date-fns';
import { apiPatch } from '@/lib/api';
import { makeCommonArea, makeReservation, makeUnit } from '@/test/fixtures';
import { clickTrigger, renderWithProviders, screen, waitFor, within } from '@/test/render';
import type { Reservation } from '@/types/api';
import { ReservationsPage } from './reservations-page';
import { serveApi } from './test-utils';

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

const mockPatch = vi.mocked(apiPatch);

const SALAO = makeCommonArea({ id: 'area-1', name: 'Salao de Festas' });
const UNITS = [makeUnit({ id: 'unit-1', number: '101' })];

function dialog() {
  return within(screen.getByRole('dialog'));
}

function fireChange(input: HTMLElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function fireTextarea(input: HTMLElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function renderWith(
  reservation: Reservation,
  role: 'ADMIN' | 'RESIDENT' = 'ADMIN',
): Promise<void> {
  serveApi({ areas: [SALAO], units: UNITS, reservations: [reservation] });
  // O morador mora na unidade da reserva: so assim o servidor deixa editar.
  renderWithProviders(<ReservationsPage />, {
    role,
    user: role === 'RESIDENT' ? { unitId: 'unit-1' } : undefined,
  });
  await screen.findByText('Carlos Pereira');
}

async function openEdit(): Promise<void> {
  clickTrigger(screen.getByRole('button', { name: /Editar reserva de/ }));
  await screen.findByRole('dialog');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockPatch.mockResolvedValue(makeReservation() as never);
});

describe('Edição de reserva', () => {
  it('abre preenchida e salva só as observações, mesmo com a reserva já iniciada', async () => {
    // O fixture comeca em marco: ja passou. Sem mudar o periodo, a regra de
    // "data no passado" nao se aplica — o servidor faz o mesmo.
    await renderWith(makeReservation({ notes: 'Antigo', status: 'CONFIRMED' }));
    await openEdit();

    expect(dialog().getByRole('heading', { name: 'Editar reserva' })).toBeInTheDocument();
    const notes = dialog().getByLabelText('Observações');
    expect(notes).toHaveValue('Antigo');

    fireTextarea(notes, 'Novo texto');
    clickTrigger(dialog().getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    const [url, body] = mockPatch.mock.calls[0];
    expect(url).toBe('/reservations/reservation-1');
    expect(body).toMatchObject({ commonAreaId: 'area-1', unitId: 'unit-1', notes: 'Novo texto' });
    expect(body).not.toHaveProperty('condominiumId');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('mudar o período volta a aplicar as regras de horário', async () => {
    await renderWith(makeReservation());
    await openEdit();

    const yesterday = addDays(new Date(), -1);
    yesterday.setHours(18, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(21);
    fireChange(dialog().getByLabelText('Início'), format(yesterday, "yyyy-MM-dd'T'HH:mm"));
    fireChange(dialog().getByLabelText('Término'), format(end, "yyyy-MM-dd'T'HH:mm"));
    clickTrigger(dialog().getByRole('button', { name: 'Salvar' }));

    expect(await dialog().findByText(/reservar uma data no passado/i)).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('morador editando reserva confirmada é avisado de que remarcar volta para aprovação', async () => {
    await renderWith(makeReservation({ status: 'CONFIRMED' }), 'RESIDENT');
    await openEdit();

    expect(dialog().getByText(/devolve esta reserva para aprovação/i)).toBeInTheDocument();
  });

  it('o aprovador não recebe o aviso: a edição dele mantém a reserva confirmada', async () => {
    await renderWith(makeReservation({ status: 'CONFIRMED' }), 'ADMIN');
    await openEdit();

    expect(dialog().queryByText(/devolve esta reserva para aprovação/i)).not.toBeInTheDocument();
  });

  it('morador de outra unidade não vê editar', async () => {
    await renderWith(makeReservation({ unitId: 'unit-9' }), 'RESIDENT');
    expect(screen.queryByRole('button', { name: /Editar reserva de/ })).not.toBeInTheDocument();
  });

  it.each(['REJECTED', 'CANCELED', 'COMPLETED'] as const)(
    'reserva %s não oferece edição',
    async (status) => {
      await renderWith(makeReservation({ status }));
      expect(screen.queryByRole('button', { name: /Editar reserva de/ })).not.toBeInTheDocument();
    },
  );
});
