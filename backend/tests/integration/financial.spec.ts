import { dayjs } from '@/shared/utils/date.util';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('Financeiro (cobrancas, pagamentos e despesas)', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let categoryId: string;

  const nextMonth = dayjs().add(1, 'month');
  const referenceMonth = nextMonth.format('YYYY-MM');
  const dueDate = nextMonth.date(10).format('YYYY-MM-DD');

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);

    const categories = await admin.get(
      `/financial/categories?condominiumId=${ctx.seed.condominiumId}&kind=INCOME`,
    );
    categoryId = categories.body.data[0].id;
  });

  afterAll(teardownTestContext);

  it('gera as cobrancas do mes para todas as unidades', async () => {
    const response = await admin.post('/financial/charges/generate').send({
      condominiumId: ctx.seed.condominiumId,
      referenceMonth,
      dueDate,
      categoryId,
      description: `Taxa condominial ${nextMonth.format('MM/YYYY')}`,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.created).toBe(ctx.seed.unitIds.length);
    expect(response.body.data.total).toBeGreaterThan(0);
  });

  it('nao duplica a competencia ja gerada', async () => {
    const response = await admin.post('/financial/charges/generate').send({
      condominiumId: ctx.seed.condominiumId,
      referenceMonth,
      dueDate,
      categoryId,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/ja esta lancada/i);
  });

  it('rateia um valor total pela fracao ideal das unidades', async () => {
    const rateioMonth = dayjs().add(2, 'month').format('YYYY-MM');

    const response = await admin.post('/financial/charges/generate').send({
      condominiumId: ctx.seed.condominiumId,
      referenceMonth: rateioMonth,
      dueDate: dayjs().add(2, 'month').date(10).format('YYYY-MM-DD'),
      description: 'Rateio obra da fachada',
      totalToApportion: 32000,
    });

    expect(response.status).toBe(201);
    // Soma rateada deve ficar proxima do total informado (arredondamento por unidade).
    expect(response.body.data.total).toBeGreaterThan(31900);
    expect(response.body.data.total).toBeLessThanOrEqual(32000);
  });

  it('registra pagamento parcial e depois quita a cobranca', async () => {
    const charges = await admin.get(
      `/financial/charges?condominiumId=${ctx.seed.condominiumId}&referenceMonth=${referenceMonth}&perPage=1`,
    );
    const charge = charges.body.data[0];
    const half = Math.round((charge.amount / 2) * 100) / 100;

    const partial = await admin
      .post(`/financial/charges/${charge.id}/payments`)
      .send({ amount: half, method: 'PIX' });

    expect(partial.status).toBe(201);
    expect(partial.body.data.charge.status).toBe('PARTIAL');
    expect(partial.body.data.charge.paidAmount).toBeCloseTo(half, 2);

    const settle = await admin
      .post(`/financial/charges/${charge.id}/payments`)
      .send({ amount: charge.amount - half, method: 'BOLETO' });

    expect(settle.status).toBe(201);
    expect(settle.body.data.charge.status).toBe('PAID');
    expect(settle.body.data.charge.paidAt).toBeTruthy();
  });

  it('recusa pagamento acima do saldo devedor', async () => {
    const charges = await admin.get(
      `/financial/charges?condominiumId=${ctx.seed.condominiumId}&referenceMonth=${referenceMonth}&status=PENDING&perPage=1`,
    );
    const charge = charges.body.data[0];

    const response = await admin
      .post(`/financial/charges/${charge.id}/payments`)
      .send({ amount: charge.amount + 500 });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/excede o saldo devedor/i);
  });

  it('valida o formato da competencia', async () => {
    const response = await admin.post('/financial/charges').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: ctx.seed.unitIds[0],
      description: 'Multa por barulho',
      referenceMonth: '2026/13',
      dueDate: '2026-05-10',
      amount: 150,
    });

    expect(response.status).toBe(422);
  });

  it('consolida os totais e a inadimplencia da competencia', async () => {
    const response = await admin.get(
      `/financial/charges/summary?condominiumId=${ctx.seed.condominiumId}&referenceMonth=${referenceMonth}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.billed).toBeGreaterThan(0);
    expect(response.body.data.received).toBeGreaterThan(0);
    expect(response.body.data).toHaveProperty('delinquencyRate');
  });

  it('lista a inadimplencia agrupada por unidade', async () => {
    const response = await admin.get(
      `/financial/charges/delinquency?condominiumId=${ctx.seed.condominiumId}`,
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    if (response.body.data.length) {
      expect(response.body.data[0]).toHaveProperty('unitNumber');
      expect(response.body.data[0].total).toBeGreaterThan(0);
    }
  });

  it('aplica multa e juros nas cobrancas vencidas', async () => {
    const response = await admin.post('/financial/charges/apply-late-fees').send({
      condominiumId: ctx.seed.condominiumId,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.updated).toBeGreaterThanOrEqual(0);
  });

  it('impede a exclusao de cobranca com pagamento registrado', async () => {
    const charges = await admin.get(
      `/financial/charges?condominiumId=${ctx.seed.condominiumId}&status=PAID&perPage=1`,
    );
    const charge = charges.body.data[0];

    const response = await admin.delete(`/financial/charges/${charge.id}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/pagamentos registrados/i);
  });

  it('morador ve apenas as cobrancas da propria unidade', async () => {
    const morador = await login(ctx, seedUsers.morador);
    const me = await morador.get('/auth/me');

    const response = await morador.get('/financial/charges/my');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    for (const charge of response.body.data) {
      expect(charge.unitId).toBe(me.body.data.unitId);
    }
  });

  it('quita uma despesa e programa a proxima ocorrencia recorrente', async () => {
    const expenses = await admin.get(
      `/financial/expenses?condominiumId=${ctx.seed.condominiumId}&status=PENDING&perPage=10`,
    );
    const recurring = expenses.body.data.find((item: { isRecurring: boolean }) => item.isRecurring);

    const paid = await admin
      .post(`/financial/expenses/${recurring.id}/pay`)
      .send({ paymentMethod: 'TRANSFER' });

    expect(paid.status).toBe(200);
    expect(paid.body.data.status).toBe('PAID');

    const nextCompetence = dayjs(`${recurring.competence}-01`).add(1, 'month').format('YYYY-MM');
    const next = await admin.get(
      `/financial/expenses?condominiumId=${ctx.seed.condominiumId}&competence=${nextCompetence}&perPage=50`,
    );

    const scheduled = next.body.data.some(
      (item: { description: string }) => item.description === recurring.description,
    );
    expect(scheduled).toBe(true);
  });

  it('resume as despesas por categoria', async () => {
    const response = await admin.get(
      `/financial/expenses/summary?condominiumId=${ctx.seed.condominiumId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBeGreaterThan(0);
    expect(Array.isArray(response.body.data.byCategory)).toBe(true);
  });
});
