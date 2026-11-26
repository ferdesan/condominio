import { dayjs } from '@/shared/utils/date.util';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

/** Proxima data futura que caia no dia da semana desejado, as 14h. */
function nextWeekday(weekday: number, hour = 14) {
  let date = dayjs().add(1, 'day').hour(hour).minute(0).second(0).millisecond(0);
  while (date.day() !== weekday) date = date.add(1, 'day');
  return date;
}

describe('Reservas de areas comuns', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let morador: AuthenticatedAgent;
  let areaId: string;
  let unitId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    morador = await login(ctx, seedUsers.morador);

    const area = await admin.post('/common-areas').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Quadra Poliesportiva',
      capacity: 20,
      requiresApproval: true,
      reservationFee: 50,
      opensAt: '08:00',
      closesAt: '22:00',
      minHours: 1,
      maxHours: 4,
      advanceBookingDays: 30,
    });
    areaId = area.body.data.id;

    const me = await morador.get('/auth/me');
    unitId = me.body.data.unitId;
  });

  afterAll(teardownTestContext);

  it('morador cria reserva que entra como pendente de aprovacao', async () => {
    const start = nextWeekday(3, 14);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(2, 'hour').toISOString(),
      guestsCount: 8,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('PENDING');
    expect(response.body.data.fee).toBe(50);
    expect(response.body.data.requestedByName).toBeTruthy();
  });

  it('recusa reserva sobreposta na mesma area', async () => {
    const start = nextWeekday(3, 15);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/ja existe uma reserva/i);
  });

  it('recusa reserva no passado', async () => {
    const start = dayjs().subtract(2, 'day').hour(10);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(2, 'hour').toISOString(),
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/passado/i);
  });

  it('recusa reserva fora do horario de funcionamento da area', async () => {
    const start = nextWeekday(4, 23);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/permitidas somente entre/i);
  });

  it('recusa duracao acima do maximo permitido', async () => {
    const start = nextWeekday(5, 9);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(8, 'hour').toISOString(),
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/maxima/i);
  });

  it('recusa reserva com mais convidados que a capacidade', async () => {
    const start = nextWeekday(5, 10);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(2, 'hour').toISOString(),
      guestsCount: 500,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/maximo 20 pessoas/i);
  });

  it('impede o morador de reservar para a unidade de outra pessoa', async () => {
    const otherUnit = ctx.seed.unitIds.find((id) => id !== unitId)!;
    const start = nextWeekday(6, 10);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId: otherUnit,
      startsAt: start.toISOString(),
      endsAt: start.add(2, 'hour').toISOString(),
    });

    expect(response.status).toBe(403);
  });

  it('sindico aprova a reserva e o solicitante e notificado', async () => {
    const sindico = await login(ctx, seedUsers.sindico);
    const pending = await sindico.get('/reservations?status=PENDING&perPage=50');
    const reservation = pending.body.data.find(
      (item: { commonAreaId: string }) => item.commonAreaId === areaId,
    );

    const approved = await sindico.post(`/reservations/${reservation.id}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('CONFIRMED');

    const notifications = await morador.get('/notifications');
    const titles = notifications.body.data.map((item: { title: string }) => item.title);
    expect(titles).toContain('Reserva confirmada');
  });

  it('morador nao pode aprovar a propria reserva', async () => {
    const start = nextWeekday(2, 9);
    const created = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
    });

    const response = await morador.post(`/reservations/${created.body.data.id}/approve`).send({});
    expect(response.status).toBe(403);
  });

  it('morador cancela a propria reserva informando o motivo', async () => {
    const start = nextWeekday(1, 16);
    const created = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
    });

    const canceled = await morador
      .post(`/reservations/${created.body.data.id}/cancel`)
      .send({ reason: 'Mudanca de planos' });

    expect(canceled.status).toBe(200);
    expect(canceled.body.data.status).toBe('CANCELED');
    expect(canceled.body.data.statusReason).toBe('Mudanca de planos');
  });

  it('libera o horario apos o cancelamento', async () => {
    const start = nextWeekday(1, 16);

    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
    });

    expect(response.status).toBe(201);
  });

  it('retorna a agenda do periodo consultado', async () => {
    const response = await admin.get(
      `/reservations/availability?condominiumId=${ctx.seed.condominiumId}` +
        `&from=${dayjs().toISOString()}&to=${dayjs().add(30, 'day').toISOString()}`,
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).toHaveProperty('commonAreaName');
  });
});

describe('Edicao de reservas', () => {
  let ctx: TestContext;
  let morador: AuthenticatedAgent;
  let sindico: AuthenticatedAgent;
  let areaId: string;
  let unitId: string;

  async function createReservation(start: ReturnType<typeof dayjs>, hours = 1) {
    const response = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(hours, 'hour').toISOString(),
      guestsCount: 4,
    });
    expect(response.status).toBe(201);
    return response.body.data as { id: string; status: string };
  }

  async function notificationTitles(agent: AuthenticatedAgent): Promise<string[]> {
    const response = await agent.get('/notifications?perPage=100');
    return response.body.data.map((item: { title: string }) => item.title);
  }

  beforeAll(async () => {
    ctx = await setupTestContext();
    const admin = await login(ctx, seedUsers.admin);
    morador = await login(ctx, seedUsers.morador);
    sindico = await login(ctx, seedUsers.sindico);

    const area = await admin.post('/common-areas').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Salao de Jogos',
      capacity: 10,
      requiresApproval: true,
      reservationFee: 30,
      opensAt: '08:00',
      closesAt: '22:00',
      minHours: 1,
      maxHours: 4,
      advanceBookingDays: 30,
    });
    areaId = area.body.data.id;

    const me = await morador.get('/auth/me');
    unitId = me.body.data.unitId;
  });

  afterAll(teardownTestContext);

  it('morador altera observacoes e convidados sem mudar o status', async () => {
    const reservation = await createReservation(nextWeekday(1, 9));

    const response = await morador
      .patch(`/reservations/${reservation.id}`)
      .send({ notes: 'Aniversario', guestsCount: 6 });

    expect(response.status).toBe(200);
    expect(response.body.data.notes).toBe('Aniversario');
    expect(response.body.data.guestsCount).toBe(6);
    expect(response.body.data.status).toBe('PENDING');
  });

  it('ignora status enviado pela edicao: so o fluxo de aprovacao confirma', async () => {
    const reservation = await createReservation(nextWeekday(1, 11));

    const response = await morador
      .patch(`/reservations/${reservation.id}`)
      .send({ status: 'CONFIRMED', statusReason: 'auto aprovado' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('PENDING');
    expect(response.body.data.statusReason ?? null).toBeNull();
  });

  it('recusa convidados acima da capacidade na edicao', async () => {
    const reservation = await createReservation(nextWeekday(1, 13));

    const response = await morador
      .patch(`/reservations/${reservation.id}`)
      .send({ guestsCount: 50 });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/maximo 10 pessoas/i);
  });

  it('remarcacao de reserva confirmada pelo morador volta para aprovacao', async () => {
    const reservation = await createReservation(nextWeekday(2, 9));
    await sindico.post(`/reservations/${reservation.id}/approve`).send({ reason: 'ok' });

    const start = nextWeekday(2, 15);
    const response = await morador.patch(`/reservations/${reservation.id}`).send({
      startsAt: start.toISOString(),
      endsAt: start.add(2, 'hour').toISOString(),
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('PENDING');
    expect(response.body.data.statusReason ?? null).toBeNull();
    expect(await notificationTitles(sindico)).toContain('Reserva alterada aguardando aprovacao');
  });

  it('remarcacao feita pelo sindico mantem a reserva confirmada e avisa o solicitante', async () => {
    const reservation = await createReservation(nextWeekday(3, 9));
    await sindico.post(`/reservations/${reservation.id}/approve`).send({});

    const start = nextWeekday(3, 17);
    const response = await sindico.patch(`/reservations/${reservation.id}`).send({
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CONFIRMED');
    expect(await notificationTitles(morador)).toContain('Reserva alterada');
  });

  it('recusa remarcacao para horario ja ocupado', async () => {
    const reservation = await createReservation(nextWeekday(4, 9));
    const occupied = nextWeekday(3, 17);

    const response = await morador.patch(`/reservations/${reservation.id}`).send({
      startsAt: occupied.toISOString(),
      endsAt: occupied.add(1, 'hour').toISOString(),
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/ja existe uma reserva/i);
  });

  it('impede o morador de mover a reserva para a unidade de outra pessoa', async () => {
    const reservation = await createReservation(nextWeekday(4, 13));
    const otherUnit = ctx.seed.unitIds.find((id) => id !== unitId)!;

    const response = await morador
      .patch(`/reservations/${reservation.id}`)
      .send({ unitId: otherUnit });

    expect(response.status).toBe(403);
  });

  it('reserva recusada nao pode ser editada', async () => {
    const reservation = await createReservation(nextWeekday(5, 9));
    await sindico.post(`/reservations/${reservation.id}/reject`).send({ reason: 'manutencao' });

    const response = await morador
      .patch(`/reservations/${reservation.id}`)
      .send({ notes: 'tentando de novo' });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/pendentes ou confirmadas/i);
  });
});
