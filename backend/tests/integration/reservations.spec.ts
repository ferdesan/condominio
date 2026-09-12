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
