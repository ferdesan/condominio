import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CondominiumContext,
  type CondominiumContextValue,
} from '@/providers/condominium-context';
import { makeCommonArea, makeCondominium, makeReservation, makeUnit } from '@/test/fixtures';
import {
  clickTrigger,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import { ReservationsPage } from './reservations-page';
import { lastListParams, listRequests, serveApi } from './test-utils';

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

const AREAS = [
  makeCommonArea({ id: 'area-1', name: 'Salao de Festas' }),
  makeCommonArea({ id: 'area-2', name: 'Churrasqueira' }),
];

const UNITS = [
  makeUnit({ id: 'unit-1', number: '101' }),
  makeUnit({ id: 'unit-2', number: '202' }),
];

/** Linhas de dados da tabela, sem o cabecalho. */
function dataRows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

function pendingButton(): HTMLElement {
  return screen.getByRole('button', { name: /Aguardando decisao/ });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Listagem de reservas', () => {
  it('IT-124: percorre filtros de area e status e abre a fila de pendentes em uma interacao', async () => {
    serveApi({
      areas: AREAS,
      units: UNITS,
      reservations: [
        makeReservation({ id: 'reservation-1', requestedByName: 'Carlos Pereira' }),
        makeReservation({
          id: 'reservation-2',
          status: 'CONFIRMED',
          requestedByName: 'Ana Souza',
        }),
      ],
      count: (params) => (params.status === 'PENDING' ? 4 : 0),
    });

    renderWithProviders(<ReservationsPage />);

    await screen.findByText('Carlos Pereira');
    expect(dataRows()).toHaveLength(2);

    // Mais recentes primeiro: e a ordenacao padrao do servidor, e a tela nao
    // pede outra enquanto o usuario nao escolher uma coluna.
    expect(lastListParams().sortBy).toBeUndefined();

    selectOption(screen.getByLabelText('Area comum'), 'Churrasqueira');
    await waitFor(() => expect(lastListParams().commonAreaId).toBe('area-2'));

    selectOption(screen.getByLabelText('Status'), 'Confirmada');
    await waitFor(() => expect(lastListParams().status).toBe('CONFIRMED'));

    // O filtro aplicado aparece como chip removivel. O nome da area tambem
    // aparece no gatilho do select e nos indicadores, entao a asercao precisa
    // olhar para dentro do chip.
    const chip = screen.getByText('Area comum:').closest('div');
    expect(within(chip as HTMLElement).getByText('Churrasqueira')).toBeInTheDocument();

    // A contagem de pendentes esta na tela e e o proprio atalho para a fila.
    const queue = pendingButton();
    expect(within(queue).getByText('4')).toBeInTheDocument();

    const before = listRequests().length;
    clickTrigger(queue);

    // Uma interacao so: o status passa a PENDING.
    await waitFor(() => expect(lastListParams().status).toBe('PENDING'));
    expect(listRequests().length).toBeGreaterThan(before);
  });

  it('IT-125: uma lista vazia oferece criar uma reserva', async () => {
    serveApi({ areas: AREAS, units: UNITS, reservations: [] });

    renderWithProviders(<ReservationsPage />);

    expect(await screen.findByText('Nenhuma reserva registrada')).toBeInTheDocument();
    // O botao do estado vazio, alem do da barra de acoes.
    expect(screen.getAllByRole('button', { name: 'Nova reserva' }).length).toBeGreaterThan(0);
  });

  it('IT-126: uma contagem de pendentes zerada aparece como zero, e nao escondida', async () => {
    serveApi({ areas: AREAS, units: UNITS, reservations: [makeReservation()], count: () => 0 });

    renderWithProviders(<ReservationsPage />);

    await screen.findByText('Carlos Pereira');
    await waitFor(() => expect(within(pendingButton()).getByText('0')).toBeInTheDocument());
  });

  it('IT-127: uma reserva cuja area foi removida mostra o rotulo de area indisponivel', async () => {
    serveApi({
      areas: AREAS,
      units: UNITS,
      reservations: [makeReservation({ commonArea: undefined })],
    });

    renderWithProviders(<ReservationsPage />);

    const row = within(await screen.findByText('Carlos Pereira').then((cell) => cell.closest('tr')!));
    expect(row.getByText('Area indisponivel')).toBeInTheDocument();
  });

  it('IT-128: uma reserva cuja unidade foi removida continua mostrando o solicitante', async () => {
    serveApi({
      areas: AREAS,
      units: UNITS,
      reservations: [makeReservation({ unit: undefined, requestedByName: 'Carlos Pereira' })],
    });

    renderWithProviders(<ReservationsPage />);

    // O nome fica gravado na propria reserva, entao sobrevive a remocao.
    const cell = await screen.findByText('Carlos Pereira');
    const row = within(cell.closest('tr')!);
    expect(row.getByText('Unidade indisponivel')).toBeInTheDocument();
  });

  it('IT-129: trocar de condominio limpa os filtros de area e de unidade', async () => {
    serveApi({ areas: AREAS, units: UNITS, reservations: [makeReservation()] });

    // O contexto do condominio precisa ser mutavel para este caso: o provedor
    // do helper e fixo, entao a tela e montada sob um provedor proprio.
    function SwitchableHarness() {
      const [id, setId] = useState('cond-1');
      const selected = makeCondominium({ id, name: `Condominio ${id}` });
      const value: CondominiumContextValue = {
        condominiums: [selected],
        selected,
        selectedId: id,
        select: setId,
        isLoading: false,
      };
      return (
        <CondominiumContext.Provider value={value}>
          <button type="button" onClick={() => setId('cond-2')}>
            Trocar condominio
          </button>
          <ReservationsPage />
        </CondominiumContext.Provider>
      );
    }

    renderWithProviders(<SwitchableHarness />);

    await screen.findByText('Carlos Pereira');

    selectOption(screen.getByLabelText('Area comum'), 'Churrasqueira');
    await waitFor(() => expect(lastListParams().commonAreaId).toBe('area-2'));

    selectOption(screen.getByLabelText('Unidade'), 'Unidade 202');
    await waitFor(() => expect(lastListParams().unitId).toBe('unit-2'));

    clickTrigger(screen.getByRole('button', { name: 'Trocar condominio' }));

    await waitFor(() => {
      const params = lastListParams();
      expect(params.condominiumId).toBe('cond-2');
      expect(params.commonAreaId).toBeUndefined();
      expect(params.unitId).toBeUndefined();
    });
  });
});
