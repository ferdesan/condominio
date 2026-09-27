import { randomUUID } from 'node:crypto';
import { AppDataSource } from '@/config/data-source';
import { AuditLog } from '@/modules/audit/audit-log.entity';
import { dayjs } from '@/shared/utils/date.util';
import { registerIsolatedTenant, type IsolatedTenant } from '../helpers/test-data';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from '../helpers/test-context';

/**
 * Correcao da data de caixa de uma baixa ja feita: recebimento (pagamento de
 * cobranca) e liquidacao (despesa paga). A regra central e que nenhuma
 * competencia entre a data antiga e a nova, inclusive, pode estar fechada.
 */
describe('Correcao da data de recebimento e de liquidacao', () => {
  let ctx: TestContext;

  /** `n` meses atras, no dia `day` (ate 28, para existir em todo mes). */
  const monthsAgo = (n: number, day = 10) => dayjs().subtract(n, 'month').date(day).hour(12).startOf('hour');
  const month = (n: number) => dayjs().subtract(n, 'month').format('YYYY-MM');
  const REASON = 'Data lancada errada no extrato bancario';

  const statement = async (tenant: IsolatedTenant, referenceMonth: string) => {
    const response = await tenant.agent.get(
      `/financial/closings/${referenceMonth}?condominiumId=${tenant.condominiumId}`,
    );
    expect(response.status).toBe(200);
    return response.body.data as { totalIncome: number; totalExpense: number };
  };

  const close = async (tenant: IsolatedTenant, referenceMonth: string) => {
    const response = await tenant.agent
      .post(`/financial/closings/${referenceMonth}/close`)
      .send({ condominiumId: tenant.condominiumId });
    expect(response.status).toBe(200);
  };

  const receive = async (
    tenant: IsolatedTenant,
    amount: number,
    paidAts: dayjs.Dayjs[],
    referenceMonth = month(2),
  ) => {
    const charge = await tenant.agent.post('/financial/charges').send({
      condominiumId: tenant.condominiumId,
      unitId: tenant.unitId,
      description: `Taxa ${randomUUID().slice(0, 8)}`,
      referenceMonth,
      dueDate: monthsAgo(2, 5).format('YYYY-MM-DD'),
      amount,
    });
    expect(charge.status).toBe(201);
    const chargeId = charge.body.data.id as string;

    const paymentIds: string[] = [];
    const share = amount / paidAts.length;
    for (const paidAt of paidAts) {
      const payment = await tenant.agent
        .post(`/financial/charges/${chargeId}/payments`)
        .send({ amount: share, paidAt: paidAt.toISOString(), method: 'PIX' });
      expect(payment.status).toBe(201);
      paymentIds.push(payment.body.data.payment.id as string);
    }
    return { chargeId, paymentIds };
  };

  const paidExpense = async (tenant: IsolatedTenant, amount: number, paidAt: dayjs.Dayjs) => {
    const response = await tenant.agent.post('/financial/expenses').send({
      condominiumId: tenant.condominiumId,
      description: `Conta ${randomUUID().slice(0, 8)}`,
      competence: paidAt.format('YYYY-MM'),
      dueDate: paidAt.format('YYYY-MM-DD'),
      amount,
      status: 'PAID',
      paidAt: paidAt.toISOString(),
    });
    expect(response.status).toBe(201);
    return response.body.data.id as string;
  };

  const correctPayment = (tenant: IsolatedTenant, id: string, paidAt: dayjs.Dayjs, reason = REASON) =>
    tenant.agent
      .patch(`/financial/payments/${id}/paid-at`)
      .send({ paidAt: paidAt.toISOString(), reason });

  const correctExpense = (tenant: IsolatedTenant, id: string, paidAt: dayjs.Dayjs, reason = REASON) =>
    tenant.agent
      .patch(`/financial/expenses/${id}/paid-at`)
      .send({ paidAt: paidAt.toISOString(), reason });

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(teardownTestContext);

  describe('Recebimento', () => {
    let tenant: IsolatedTenant;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'corr-rec');
    });

    it('IT-400: move o valor entre duas competencias abertas e audita o motivo', async () => {
      const { paymentIds } = await receive(tenant, 400, [monthsAgo(2, 12)]);
      const [before2, before1] = [await statement(tenant, month(2)), await statement(tenant, month(1))];

      const response = await correctPayment(tenant, paymentIds[0], monthsAgo(1, 3));
      expect(response.status).toBe(200);

      const [after2, after1] = [await statement(tenant, month(2)), await statement(tenant, month(1))];
      expect(after2.totalIncome).toBeCloseTo(before2.totalIncome - 400, 2);
      expect(after1.totalIncome).toBeCloseTo(before1.totalIncome + 400, 2);

      const audit = await AppDataSource.getRepository(AuditLog).findOneBy({
        resource: 'payment',
        resourceId: paymentIds[0],
      });
      expect(audit?.description).toContain(REASON);
    });

    it('IT-401: recalcula a data de quitacao da cobranca pela baixa mais recente', async () => {
      const { chargeId, paymentIds } = await receive(tenant, 600, [
        monthsAgo(2, 5),
        monthsAgo(2, 20),
      ]);

      const response = await correctPayment(tenant, paymentIds[1], monthsAgo(2, 8));
      expect(response.status).toBe(200);

      const charge = await tenant.agent.get(`/financial/charges/${chargeId}`);
      expect(charge.body.data.status).toBe('PAID');
      expect(dayjs(charge.body.data.paidAt).valueOf()).toBe(monthsAgo(2, 8).valueOf());
    });

    it('IT-402: recusa quando a competencia de origem esta fechada', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'corr-orig');
      const { paymentIds } = await receive(isolated, 100, [monthsAgo(2, 12)]);
      await close(isolated, month(2));

      const response = await correctPayment(isolated, paymentIds[0], monthsAgo(1, 3));
      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain(month(2));
    });

    it('IT-403: recusa quando a competencia de destino esta fechada', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'corr-dest');
      const { paymentIds } = await receive(isolated, 100, [monthsAgo(2, 12)]);
      await close(isolated, month(1));

      const response = await correctPayment(isolated, paymentIds[0], monthsAgo(1, 3));
      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain(month(1));
    });

    it('IT-404: recusa quando ha competencia fechada entre as duas datas', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'corr-meio');
      const { paymentIds } = await receive(isolated, 100, [monthsAgo(3, 12)], month(3));
      await close(isolated, month(2));

      const response = await correctPayment(isolated, paymentIds[0], monthsAgo(1, 3));
      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain(month(2));
    });

    it('IT-405: recusa data futura e motivo curto', async () => {
      const { paymentIds } = await receive(tenant, 50, [monthsAgo(2, 12)]);

      const future = await correctPayment(tenant, paymentIds[0], dayjs().add(1, 'day'));
      expect(future.status).toBe(409);

      const shortReason = await correctPayment(tenant, paymentIds[0], monthsAgo(1, 3), 'erro');
      expect(shortReason.status).toBe(422);
    });

    it('IT-406: recusa data anterior ao saldo inicial do condominio', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'corr-corte');
      const { paymentIds } = await receive(isolated, 100, [monthsAgo(2, 12)]);
      const cutoff = await isolated.agent
        .put(`/condominiums/${isolated.condominiumId}`)
        .send({ openingBalanceDate: monthsAgo(2, 1).format('YYYY-MM-DD') });
      expect(cutoff.status).toBe(200);

      const response = await correctPayment(isolated, paymentIds[0], monthsAgo(3, 20));
      expect(response.status).toBe(409);
    });
  });

  describe('Liquidacao de despesa', () => {
    let tenant: IsolatedTenant;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'corr-desp');
    });

    it('IT-407: move a despesa paga entre duas competencias abertas', async () => {
      const id = await paidExpense(tenant, 250, monthsAgo(2, 15));
      const [before2, before1] = [await statement(tenant, month(2)), await statement(tenant, month(1))];

      const response = await correctExpense(tenant, id, monthsAgo(1, 2));
      expect(response.status).toBe(200);
      expect(dayjs(response.body.data.paidAt).valueOf()).toBe(monthsAgo(1, 2).valueOf());

      const [after2, after1] = [await statement(tenant, month(2)), await statement(tenant, month(1))];
      expect(after2.totalExpense).toBeCloseTo(before2.totalExpense - 250, 2);
      expect(after1.totalExpense).toBeCloseTo(before1.totalExpense + 250, 2);
    });

    it('IT-408: recusa quando ha competencia fechada entre as duas datas', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'corr-desp-meio');
      const id = await paidExpense(isolated, 80, monthsAgo(3, 15));
      await close(isolated, month(2));

      const response = await correctExpense(isolated, id, monthsAgo(1, 2));
      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain(month(2));
    });

    it('IT-409: recusa despesa que ainda nao foi paga', async () => {
      const created = await tenant.agent.post('/financial/expenses').send({
        condominiumId: tenant.condominiumId,
        description: 'Conta a pagar',
        competence: month(0),
        dueDate: dayjs().add(10, 'day').format('YYYY-MM-DD'),
        amount: 90,
      });
      expect(created.status).toBe(201);

      const response = await correctExpense(tenant, created.body.data.id, monthsAgo(1, 2));
      expect(response.status).toBe(409);
    });

    it('IT-410: o PUT nao muda mais a data de uma despesa paga', async () => {
      const paidAt = monthsAgo(2, 18);
      const id = await paidExpense(tenant, 70, paidAt);

      const moved = await tenant.agent
        .put(`/financial/expenses/${id}`)
        .send({ paidAt: monthsAgo(1, 2).toISOString() });
      expect(moved.status).toBe(409);
      expect(moved.body.error.message).toContain('correcao de data');

      const same = await tenant.agent
        .put(`/financial/expenses/${id}`)
        .send({ paidAt: paidAt.toISOString(), notes: 'so a observacao' });
      expect(same.status).toBe(200);
    });
  });

  describe('Permissoes', () => {
    it('IT-411: papel sem payment:update / expense:update recebe 403', async () => {
      const staff = await login(ctx, seedUsers.porteiro);
      const payment = await staff.patch(`/financial/payments/${randomUUID()}/paid-at`).send({
        paidAt: monthsAgo(1).toISOString(),
        reason: REASON,
      });
      const expense = await staff.patch(`/financial/expenses/${randomUUID()}/paid-at`).send({
        paidAt: monthsAgo(1).toISOString(),
        reason: REASON,
      });
      expect(payment.status).toBe(403);
      expect(expense.status).toBe(403);
    });

    it('IT-412: sindico passa pela autorizacao (nao e recurso so do superadmin)', async () => {
      const sindico = await login(ctx, seedUsers.sindico);
      const response = await sindico.patch(`/financial/payments/${randomUUID()}/paid-at`).send({
        paidAt: monthsAgo(1).toISOString(),
        reason: REASON,
      });
      expect(response.status).toBe(404);
    });
  });
});
