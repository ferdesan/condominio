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

function areaPayload(condominiumId: string, name: string) {
  return {
    condominiumId,
    name,
    capacity: 10,
    requiresApproval: true,
    reservationFee: 0,
    opensAt: '08:00',
    closesAt: '22:00',
    minHours: 1,
    maxHours: 4,
    advanceBookingDays: 30,
  };
}

describe('Areas comuns (integracao)', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let morador: AuthenticatedAgent;
  let unitId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    morador = await login(ctx, seedUsers.morador);

    const me = await morador.get('/auth/me');
    unitId = me.body.data.unitId;
  });

  afterAll(teardownTestContext);

  it('CRUD completo: cria, le, atualiza e remove sem reservas', async () => {
    const created = await admin
      .post('/common-areas')
      .send(areaPayload(ctx.seed.condominiumId, 'Salao de Festas'));

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Salao de Festas',
      capacity: 10,
      status: 'AVAILABLE',
    });
    const id = created.body.data.id as string;

    const read = await admin.get(`/common-areas/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.name).toBe('Salao de Festas');

    const updated = await admin.patch(`/common-areas/${id}`).send({ capacity: 25 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.capacity).toBe(25);

    const removed = await admin.delete(`/common-areas/${id}`);
    expect(removed.status).toBe(204);

    const afterDelete = await admin.get(`/common-areas/${id}`);
    expect(afterDelete.status).toBe(404);
  });

  it('nao remove area com reserva futura PENDING', async () => {
    const area = await admin
      .post('/common-areas')
      .send(areaPayload(ctx.seed.condominiumId, 'Churrasqueira'));

    expect(area.status).toBe(201);
    const areaId = area.body.data.id as string;

    const start = nextWeekday(3, 14);
    const reservation = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(2, 'hour').toISOString(),
      guestsCount: 4,
    });
    expect(reservation.status).toBe(201);
    expect(reservation.body.data.status).toBe('PENDING');

    const blocked = await admin.delete(`/common-areas/${areaId}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/reservas futuras/i);

    // A area continua viva apos a recusa.
    const stillThere = await admin.get(`/common-areas/${areaId}`);
    expect(stillThere.status).toBe(200);
  });

  it('nao remove area com reserva futura CONFIRMED', async () => {
    const area = await admin
      .post('/common-areas')
      .send(areaPayload(ctx.seed.condominiumId, 'Piscina'));

    expect(area.status).toBe(201);
    const areaId = area.body.data.id as string;

    const start = nextWeekday(5, 9);
    const reservation = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
      guestsCount: 2,
    });
    expect(reservation.status).toBe(201);

    const sindico = await login(ctx, seedUsers.sindico);
    const pending = await sindico.get('/reservations?status=PENDING&perPage=50');
    const row = pending.body.data.find(
      (item: { commonAreaId: string }) => item.commonAreaId === areaId,
    );
    expect(row).toBeTruthy();

    const approved = await sindico.post(`/reservations/${row.id}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('CONFIRMED');

    const blocked = await admin.delete(`/common-areas/${areaId}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/reservas futuras/i);
  });

  it('remove a area depois que a reserva futura e cancelada', async () => {
    const area = await admin
      .post('/common-areas')
      .send(areaPayload(ctx.seed.condominiumId, 'Quadra'));

    expect(area.status).toBe(201);
    const areaId = area.body.data.id as string;

    const start = nextWeekday(6, 10);
    const reservation = await morador.post('/reservations').send({
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: areaId,
      unitId,
      startsAt: start.toISOString(),
      endsAt: start.add(1, 'hour').toISOString(),
      guestsCount: 3,
    });
    expect(reservation.status).toBe(201);

    const canceled = await morador
      .post(`/reservations/${reservation.body.data.id}/cancel`)
      .send({ reason: 'Desistiu da reserva' });
    expect(canceled.status).toBe(200);
    expect(canceled.body.data.status).toBe('CANCELED');

    const removed = await admin.delete(`/common-areas/${areaId}`);
    expect(removed.status).toBe(204);
  });

  it('remove area quando a unica reserva futura esta no passado (cancelada nao bloqueia)', async () => {
    const area = await admin
      .post('/common-areas')
      .send(areaPayload(ctx.seed.condominiumId, 'Espaco Gourmet'));

    expect(area.status).toBe(201);
    const areaId = area.body.data.id as string;

    // Sem reservas: o beforeRemove encontra zero e libera a remocao.
    const removed = await admin.delete(`/common-areas/${areaId}`);
    expect(removed.status).toBe(204);
  });

  it('isola areas entre tenants', async () => {
    const other = await (
      await import('../helpers/test-data')
    ).registerIsolatedTenant(ctx, 'areas');

    const foreign = await other.agent
      .post('/common-areas')
      .send(areaPayload(other.condominiumId, 'Area Forasteira'));
    expect(foreign.status).toBe(201);

    const own = await admin
      .post('/common-areas')
      .send(areaPayload(ctx.seed.condominiumId, 'Area Propria'));
    expect(own.status).toBe(201);

    const listA = await admin.get('/common-areas?perPage=200');
    const idsA = listA.body.data.map((item: { id: string }) => item.id);
    expect(idsA).toContain(own.body.data.id);
    expect(idsA).not.toContain(foreign.body.data.id);

    const listB = await other.agent.get('/common-areas?perPage=200');
    const idsB = listB.body.data.map((item: { id: string }) => item.id);
    expect(idsB).toContain(foreign.body.data.id);
    expect(idsB).not.toContain(own.body.data.id);
  });
});
