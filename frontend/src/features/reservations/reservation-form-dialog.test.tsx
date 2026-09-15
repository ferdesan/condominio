import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';
import { ApiError, apiPost } from '@/lib/api';
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
import { listRequests, serveApi } from './test-utils';

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
const mockToastError = vi.mocked(toast.error);

/**
 * `Salao de Festas` carrega as restricoes do fixture padrao: 08:00 as 22:00,
 * de 2h a 6h, 60 dias de antecedencia, 50 pessoas, todos os dias da semana.
 */
const SALAO = makeCommonArea({ id: 'area-1', name: 'Salao de Festas' });
/** So abre aos domingos; as demais regras ficam desligadas para isolar o dia. */
const QUADRA = makeCommonArea({
  id: 'area-2',
  name: 'Quadra',
  availableWeekdays: [0],
  minHours: 0,
  maxHours: 0,
  capacity: 0,
  advanceBookingDays: 365,
});
const AREAS = [SALAO, QUADRA];
const UNITS = [makeUnit({ id: 'unit-1', number: '101' })];

function local(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

/** Um horario N dias a frente, sempre no futuro. */
function ahead(days: number, hour: number, minute = 0): string {
  const date = addDays(new Date(), days);
  date.setHours(hour, minute, 0, 0);
  return local(date);
}

/** O proximo dia que nao cai num domingo, para reprovar na regra de dia. */
function nextNonSunday(): Date {
  let date = addDays(new Date(), 3);
  while (date.getDay() === 0) date = addDays(date, 1);
  return date;
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function openForm(): Promise<void> {
  clickTrigger(screen.getAllByRole('button', { name: 'Nova reserva' })[0]);
  await screen.findByRole('dialog');
}

/** Escolhe a area dentro do dialogo; o mesmo rotulo existe no painel de filtros. */
function chooseArea(name: string): void {
  selectOption(dialog().getByLabelText('Area comum'), name);
}

function chooseUnit(name = 'Unidade 101'): void {
  selectOption(dialog().getByLabelText('Unidade'), name);
}

function fillRange(start: string, end: string): void {
  const view = dialog();
  fireChange(view.getByLabelText('Inicio'), start);
  fireChange(view.getByLabelText('Termino'), end);
}

function fireChange(input: HTMLElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function submit(): void {
  clickTrigger(dialog().getByRole('button', { name: 'Reservar' }));
}

/** Prepara a tela com um formulario pronto para um envio valido. */
async function openValidForm(): Promise<void> {
  renderWithProviders(<ReservationsPage />);
  await screen.findByText('Carlos Pereira');
  await openForm();
  chooseArea('Salao de Festas');
  chooseUnit();
}

function postCalls() {
  return mockPost.mock.calls.filter(([url]) => url === '/reservations');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  serveApi({ areas: AREAS, units: UNITS, reservations: [makeReservation()] });
  mockPost.mockResolvedValue(makeReservation() as never);
});

describe('Formulario de reserva', () => {
  it('IT-138: escolhe a area, ve as regras, envia um periodo valido e a reserva aparece nas duas visoes', async () => {
    await openValidForm();

    // As restricoes da area aparecem antes do envio.
    const rules = within(dialog().getByRole('region', { name: 'Regras da area' }));
    expect(rules.getByText('Funcionamento das 08:00 as 22:00.')).toBeInTheDocument();
    expect(rules.getByText('Duracao minima de 2h.')).toBeInTheDocument();
    expect(rules.getByText('Duracao maxima de 6h.')).toBeInTheDocument();
    expect(rules.getByText('Antecedencia maxima de 60 dias.')).toBeInTheDocument();
    expect(rules.getByText('Capacidade de 50 pessoas.')).toBeInTheDocument();

    const before = listRequests().length;
    fillRange(ahead(7, 18), ahead(7, 21));
    submit();

    await waitFor(() => expect(postCalls()).toHaveLength(1));

    const [, body] = postCalls()[0];
    expect(body).toMatchObject({
      condominiumId: 'cond-1',
      commonAreaId: 'area-1',
      unitId: 'unit-1',
      guestsCount: 0,
    });

    // O dialogo fecha e as duas visoes sao recarregadas pela invalidacao.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listRequests().length).toBeGreaterThan(before));
  });

  it('IT-139: termino igual ao inicio e recusado no campo do termino, sem requisicao', async () => {
    await openValidForm();

    fillRange(ahead(7, 18), ahead(7, 18));
    submit();

    await waitFor(() =>
      expect(dialog().getByText('O termino deve ser posterior ao inicio.')).toBeInTheDocument(),
    );
    expect(postCalls()).toHaveLength(0);
    // O erro pertence ao campo, e nao ao formulario.
    expect(dialog().getByLabelText('Termino')).toHaveAttribute('aria-invalid', 'true');
  });

  it('IT-140: um inicio no passado e recusado sem requisicao', async () => {
    await openValidForm();

    fillRange(ahead(-1, 18), ahead(-1, 21));
    submit();

    await waitFor(() =>
      expect(
        dialog().getByText('Nao e possivel reservar uma data no passado.'),
      ).toBeInTheDocument(),
    );
    expect(postCalls()).toHaveLength(0);
  });

  it('IT-141: um inicio alem do limite de antecedencia e recusado informando o limite', async () => {
    await openValidForm();

    fillRange(ahead(61, 18), ahead(61, 21));
    submit();

    await waitFor(() =>
      expect(
        dialog().getByText('Reservas podem ser feitas com no maximo 60 dias de antecedencia.'),
      ).toBeInTheDocument(),
    );
    expect(postCalls()).toHaveLength(0);
  });

  it('IT-142: duracoes abaixo do minimo e acima do maximo sao recusadas, cada uma com seu limite', async () => {
    await openValidForm();

    fillRange(ahead(7, 18), ahead(7, 19));
    submit();
    await waitFor(() =>
      expect(dialog().getByText('A reserva minima para esta area e de 2h.')).toBeInTheDocument(),
    );

    fillRange(ahead(7, 12), ahead(7, 19));
    submit();
    await waitFor(() =>
      expect(dialog().getByText('A reserva maxima para esta area e de 6h.')).toBeInTheDocument(),
    );

    expect(postCalls()).toHaveLength(0);
  });

  it('IT-143: um dia da semana que a area nao permite e recusado', async () => {
    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openForm();
    chooseArea('Quadra');
    chooseUnit();

    const day = nextNonSunday();
    const start = new Date(day);
    start.setHours(10, 0, 0, 0);
    const end = new Date(day);
    end.setHours(12, 0, 0, 0);
    fillRange(local(start), local(end));
    submit();

    await waitFor(() =>
      expect(
        dialog().getByText('A area comum nao esta disponivel neste dia da semana.'),
      ).toBeInTheDocument(),
    );
    expect(postCalls()).toHaveLength(0);
  });

  it('IT-144: um periodo fora do horario de funcionamento e recusado informando a janela', async () => {
    await openValidForm();

    fillRange(ahead(7, 7), ahead(7, 9));
    submit();

    await waitFor(() =>
      expect(
        dialog().getByText('Reservas permitidas somente entre 08:00 e 22:00.'),
      ).toBeInTheDocument(),
    );
    expect(postCalls()).toHaveLength(0);
  });

  it('IT-145: um 409 de sobreposicao aparece no formulario e preserva o que foi digitado', async () => {
    await openValidForm();

    const message = 'Ja existe uma reserva para esta area neste horario.';
    mockPost.mockRejectedValueOnce(new ApiError(message, 409, 'BUSINESS_RULE'));

    const start = ahead(7, 18);
    fillRange(start, ahead(7, 21));
    submit();

    const alert = await waitFor(() => dialog().getByRole('alert'));
    expect(alert).toHaveTextContent(message);

    // O dialogo continua aberto com o periodo preenchido.
    expect(dialog().getByLabelText('Inicio')).toHaveValue(start);
  });

  it('IT-146: um 409 de intervalo minimo aparece com a mensagem do servidor', async () => {
    await openValidForm();

    const message = 'Cada unidade pode reservar esta area a cada 30 dia(s).';
    mockPost.mockRejectedValueOnce(new ApiError(message, 409, 'BUSINESS_RULE'));

    fillRange(ahead(7, 18), ahead(7, 21));
    submit();

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
  });

  it('IT-147: convidados acima da capacidade sao recusados', async () => {
    await openValidForm();

    fireChange(dialog().getByLabelText('Convidados'), '51');
    fillRange(ahead(7, 18), ahead(7, 21));
    submit();

    await waitFor(() =>
      expect(dialog().getByText('A area comporta no maximo 50 pessoas.')).toBeInTheDocument(),
    );
    expect(postCalls()).toHaveLength(0);
  });

  it('IT-148: uma area indisponivel nao e oferecida no seletor', async () => {
    serveApi({
      areas: [
        SALAO,
        makeCommonArea({ id: 'area-3', name: 'Piscina', status: 'MAINTENANCE' }),
        makeCommonArea({ id: 'area-4', name: 'Coworking', status: 'BLOCKED' }),
      ],
      units: UNITS,
      reservations: [makeReservation()],
    });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openForm();

    const trigger = dialog().getByLabelText('Area comum');
    trigger.focus();
    clickTrigger(trigger);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Salao de Festas' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('option', { name: 'Piscina' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Coworking' })).not.toBeInTheDocument();
  });

  it('IT-149: um 422 de campo aparece no campo e um 409 no formulario, nenhum em toast', async () => {
    await openValidForm();

    mockPost.mockRejectedValueOnce(
      new ApiError('Dados invalidos.', 422, 'VALIDATION', [
        { field: 'guestsCount', message: 'Numero de convidados invalido.' },
      ]),
    );

    fillRange(ahead(7, 18), ahead(7, 21));
    submit();

    await waitFor(() =>
      expect(dialog().getByText('Numero de convidados invalido.')).toBeInTheDocument(),
    );
    expect(dialog().getByLabelText('Convidados')).toHaveAttribute('aria-invalid', 'true');
    expect(mockToastError).not.toHaveBeenCalled();

    // O mesmo formulario, agora com um conflito sem detalhe de campo.
    mockPost.mockRejectedValueOnce(new ApiError('Conflito de horario.', 409, 'CONFLICT'));
    submit();

    await waitFor(() =>
      expect(dialog().getByRole('alert')).toHaveTextContent('Conflito de horario.'),
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('IT-150: dois envios para o mesmo horario produzem um sucesso e um conflito', async () => {
    await openValidForm();

    fillRange(ahead(7, 18), ahead(7, 21));
    submit();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Segunda tentativa para o mesmo horario: o servidor recusa.
    const message = 'Ja existe uma reserva para esta area neste horario.';
    mockPost.mockRejectedValueOnce(new ApiError(message, 409, 'BUSINESS_RULE'));

    await openForm();
    chooseArea('Salao de Festas');
    chooseUnit();
    fillRange(ahead(7, 18), ahead(7, 21));
    submit();

    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(message));
    expect(postCalls()).toHaveLength(2);
  });

  it('IT-151: dois cliques seguidos no envio produzem um unico POST', async () => {
    await openValidForm();

    fillRange(ahead(7, 18), ahead(7, 21));
    const button = dialog().getByRole('button', { name: 'Reservar' });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    // Nada chega depois do primeiro.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(postCalls()).toHaveLength(1);
  });

  it('IT-152: um condominio sem areas comuns explica que uma area e necessaria antes', async () => {
    serveApi({ areas: [], units: UNITS, reservations: [makeReservation()] });

    renderWithProviders(<ReservationsPage />);
    await screen.findByText('Carlos Pereira');
    await openForm();

    expect(
      dialog().getByText(/ainda nao tem areas comuns disponiveis para reserva/i),
    ).toBeInTheDocument();
    expect(dialog().queryByRole('button', { name: 'Reservar' })).not.toBeInTheDocument();
  });
});
