import { paymentRepository } from '@/modules/financial/repositories/payment.repository';
import { dayjs } from '@/shared/utils/date.util';
import { registerIsolatedTenant, type IsolatedTenant } from '../helpers/test-data';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

type StatementBody = {
  status: 'OPEN' | 'CLOSED';
  openingBalance: { amount: number; source: string; from: string | null };
  income: { categoryId: string | null; name: string; total: number }[];
  expense: { categoryId: string | null; name: string; total: number }[];
  totalIncome: number;
  totalExpense: number;
  result: number;
  closingBalance: number;
  unresolvedPaidExpenses: { count: number; total: number };
  delinquency: { amount: number; count: number };
  closedAt: string | null;
  closedBy: { id: string; name: string | null } | null;
  reopenedAt: string | null;
  reopenCount: number;
};

describe('Balancete mensal — fechamento, reabertura e congelamento', () => {
  let ctx: TestContext;

  const current = dayjs().format('YYYY-MM');
  const previous = dayjs().subtract(1, 'month').format('YYYY-MM');
  const previousDay = (day: number) => dayjs().subtract(1, 'month').date(day);

  const read = async (
    tenant: IsolatedTenant,
    month = previous,
  ): Promise<StatementBody> => {
    const response = await tenant.agent.get(
      `/financial/closings/${month}?condominiumId=${tenant.condominiumId}`,
    );
    expect(response.status).toBe(200);
    return response.body.data as StatementBody;
  };

  const close = (tenant: IsolatedTenant, month = previous) =>
    tenant.agent
      .post(`/financial/closings/${month}/close`)
      .send({ condominiumId: tenant.condominiumId });

  const reopen = (tenant: IsolatedTenant, month = previous) =>
    tenant.agent
      .post(`/financial/closings/${month}/reopen`)
      .send({ condominiumId: tenant.condominiumId });

  /** Um mes anterior com movimento dos dois lados, para haver o que congelar. */
  const seedMovement = async (tenant: IsolatedTenant) => {
    const charge = await tenant.agent.post('/financial/charges').send({
      condominiumId: tenant.condominiumId,
      unitId: tenant.unitId,
      description: 'Taxa do mes fechado',
      referenceMonth: previous,
      dueDate: previousDay(10).format('YYYY-MM-DD'),
      amount: 600,
    });
    expect(charge.status).toBe(201);

    const payment = await tenant.agent
      .post(`/financial/charges/${charge.body.data.id}/payments`)
      .send({ amount: 600, paidAt: previousDay(12).toISOString(), method: 'PIX' });
    expect(payment.status).toBe(201);

    const expense = await tenant.agent.post('/financial/expenses').send({
      condominiumId: tenant.condominiumId,
      description: 'Conta do mes fechado',
      competence: previous,
      dueDate: previousDay(15).format('YYYY-MM-DD'),
      amount: 250,
      status: 'PAID',
      paidAt: previousDay(15).toISOString(),
    });
    expect(expense.status).toBe(201);

    return { chargeId: charge.body.data.id as string };
  };

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(teardownTestContext);

  describe('Fechar o mes', () => {
    let tenant: IsolatedTenant;
    let seededChargeId: string;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'fecha');
      seededChargeId = (await seedMovement(tenant)).chargeId;
    });

    it('IT-275: fechar congela exatamente a leitura feita um instante antes', async () => {
      const before = await read(tenant);
      expect(before.status).toBe('OPEN');

      const closed = await close(tenant);
      expect(closed.status).toBe(200);

      const body = closed.body.data as StatementBody;
      expect(body.status).toBe('CLOSED');
      expect(body.closedAt).toBeTruthy();
      expect(body.closedBy?.id).toBeTruthy();
      expect(body.closedBy?.name).toBeTruthy();

      expect(body.totalIncome).toBe(before.totalIncome);
      expect(body.totalExpense).toBe(before.totalExpense);
      expect(body.result).toBe(before.result);
      expect(body.closingBalance).toBe(before.closingBalance);
      expect(body.openingBalance).toEqual(before.openingBalance);
      expect(body.income).toEqual(before.income);
      expect(body.expense).toEqual(before.expense);
      expect(body.delinquency).toEqual(before.delinquency);
    });

    it('IT-276: escrita direta no banco depois do fechamento nao altera o documento', async () => {
      const frozen = await read(tenant);
      expect(frozen.status).toBe('CLOSED');

      // Pelo repositorio, contornando toda guarda de servico: e o unico jeito de
      // provar que a leitura serve o gravado em vez de recalcular.
      await paymentRepository.create({ tenantId: tenant.tenantId }, {
        condominiumId: tenant.condominiumId,
        chargeId: seededChargeId,
        amount: 5000,
        paidAt: previousDay(20).toDate(),
        method: 'PIX',
      } as never);

      const after = await read(tenant);

      expect(after.totalIncome).toBe(frozen.totalIncome);
      expect(after.closingBalance).toBe(frozen.closingBalance);
      expect(after.income).toEqual(frozen.income);
    });

    it('IT-277: fechar de novo e recusado, e nao cria segunda linha', async () => {
      const again = await close(tenant);
      expect(again.status).toBe(409);

      const list = await tenant.agent.get(
        `/financial/closings?condominiumId=${tenant.condominiumId}`,
      );
      expect(list.body.meta.total).toBe(1);
    });

    it('IT-278: o mes corrente ainda nao terminou e por isso nao fecha', async () => {
      const response = await close(tenant, current);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/nao terminou/i);
    });

    it('IT-280: fechar um mes com o anterior em aberto calcula a abertura em vez de herdar', async () => {
      const outro = await registerIsolatedTenant(ctx, 'sem-cadeia');
      await seedMovement(outro);

      const closed = await close(outro);

      expect(closed.status).toBe(200);
      expect((closed.body.data as StatementBody).openingBalance.source).toBe('COMPUTED');
    });
  });

  describe('Permissao assimetrica entre fechar e reabrir', () => {
    let tenant: IsolatedTenant;
    let leitor: AuthenticatedAgent;
    let fechador: AuthenticatedAgent;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'permissoes');
      await seedMovement(tenant);

      const slug = (await tenant.agent.get('/auth/me')).body.data.tenant.slug as string;

      const makeUser = async (label: string, permissions: string[]) => {
        const role = await tenant.agent.post('/roles').send({
          name: `Papel ${label}`,
          permissions,
        });
        expect(role.status).toBe(201);

        const email = `${label}.${Date.now()}@exemplo.com.br`;
        const user = await tenant.agent.post('/users').send({
          name: `Usuario ${label}`,
          email,
          password: 'Demo@1234',
          roleId: role.body.data.id,
        });
        expect(user.status).toBe(201);

        return login(ctx, email, 'Demo@1234', slug);
      };

      leitor = await makeUser('leitor', ['financial-closing:read', 'condominium:read']);
      fechador = await makeUser('fechador', [
        'financial-closing:read',
        'financial-closing:create',
        'condominium:read',
      ]);
    });

    it('IT-279: quem so le nao fecha', async () => {
      const response = await leitor
        .post(`/financial/closings/${previous}/close`)
        .send({ condominiumId: tenant.condominiumId });

      expect(response.status).toBe(403);
    });

    it('IT-294: quem fecha nao necessariamente reabre', async () => {
      const closed = await fechador
        .post(`/financial/closings/${previous}/close`)
        .send({ condominiumId: tenant.condominiumId });
      expect(closed.status).toBe(200);

      const response = await fechador
        .post(`/financial/closings/${previous}/reopen`)
        .send({ condominiumId: tenant.condominiumId });
      expect(response.status).toBe(403);
    });
  });

  describe('O congelamento', () => {
    let tenant: IsolatedTenant;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'congela');
      await seedMovement(tenant);
      expect((await close(tenant)).status).toBe(200);
    });

    const newExpense = (overrides: Record<string, unknown> = {}) => ({
      condominiumId: tenant.condominiumId,
      description: `Despesa do congelamento ${Math.random().toString(36).slice(2, 8)}`,
      competence: previous,
      dueDate: previousDay(18).format('YYYY-MM-DD'),
      amount: 90,
      ...overrides,
    });

    it('IT-281: pagamento com data no mes fechado e recusado', async () => {
      const charge = await tenant.agent.post('/financial/charges').send({
        condominiumId: tenant.condominiumId,
        unitId: tenant.unitId,
        description: 'Cobranca para tentar pagar no mes fechado',
        referenceMonth: current,
        dueDate: dayjs().date(20).format('YYYY-MM-DD'),
        amount: 100,
      });
      expect(charge.status).toBe(201);

      const response = await tenant.agent
        .post(`/financial/charges/${charge.body.data.id}/payments`)
        .send({ amount: 100, paidAt: previousDay(22).toISOString(), method: 'PIX' });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(new RegExp(previous));

      // E o pagamento nao existe: a recusa vem antes da escrita.
      const payments = await tenant.agent.get(
        `/financial/payments?chargeId=${charge.body.data.id}`,
      );
      expect(payments.body.meta.total).toBe(0);
    });

    it('IT-282: pagamento em mes aberto segue funcionando', async () => {
      const charge = await tenant.agent.post('/financial/charges').send({
        condominiumId: tenant.condominiumId,
        unitId: tenant.unitId,
        description: 'Cobranca paga no mes corrente',
        referenceMonth: current,
        dueDate: dayjs().date(20).format('YYYY-MM-DD'),
        amount: 130,
      });

      const response = await tenant.agent
        .post(`/financial/charges/${charge.body.data.id}/payments`)
        .send({ amount: 130, paidAt: new Date().toISOString(), method: 'PIX' });

      expect(response.status).toBe(201);
    });

    it('IT-283: criar despesa ja paga dentro do mes fechado e recusado', async () => {
      const response = await tenant.agent
        .post('/financial/expenses')
        .send(newExpense({ status: 'PAID', paidAt: previousDay(18).toISOString() }));

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(new RegExp(previous));
    });

    it('IT-284: mover a data de pagamento para dentro do mes fechado e recusado', async () => {
      const created = await tenant.agent.post('/financial/expenses').send(
        newExpense({
          competence: current,
          dueDate: dayjs().date(18).format('YYYY-MM-DD'),
          status: 'PAID',
          paidAt: new Date().toISOString(),
        }),
      );
      expect(created.status).toBe(201);

      const response = await tenant.agent
        .patch(`/financial/expenses/${created.body.data.id}`)
        .send({ paidAt: previousDay(18).toISOString() });

      expect(response.status).toBe(409);
    });

    it('IT-285: alterar o valor de uma despesa paga no mes fechado e recusado', async () => {
      const expenses = await tenant.agent.get(
        `/financial/expenses?condominiumId=${tenant.condominiumId}&competence=${previous}&status=PAID&perPage=1`,
      );
      const target = expenses.body.data[0];
      expect(target).toBeDefined();

      const response = await tenant.agent
        .patch(`/financial/expenses/${target.id}`)
        .send({ amount: 999 });

      expect(response.status).toBe(409);
      // A recusa fala do mes fechado, e nao da regra de valor que tambem valeria.
      expect(response.body.error.message).toMatch(new RegExp(previous));
    });

    it('IT-286: quitar uma despesa com data no mes fechado e recusado', async () => {
      const created = await tenant.agent.post('/financial/expenses').send(newExpense());
      expect(created.status).toBe(201);

      const response = await tenant.agent
        .post(`/financial/expenses/${created.body.data.id}/pay`)
        .send({ paidAt: previousDay(19).toISOString(), paymentMethod: 'TRANSFER' });

      expect(response.status).toBe(409);
    });

    it('IT-287: excluir despesa paga do mes fechado e recusado, e a linha permanece', async () => {
      const expenses = await tenant.agent.get(
        `/financial/expenses?condominiumId=${tenant.condominiumId}&competence=${previous}&status=PAID&perPage=1`,
      );
      const target = expenses.body.data[0];

      const response = await tenant.agent.delete(`/financial/expenses/${target.id}`);
      expect(response.status).toBe(409);

      const still = await tenant.agent.get(`/financial/expenses/${target.id}`);
      expect(still.status).toBe(200);
      expect(still.body.data.deletedAt ?? null).toBeNull();
    });

    it('IT-288: restaurar despesa paga para dentro do mes fechado e recusado', async () => {
      // A despesa nasce paga num mes aberto, e removida, e so entao o mes dela e
      // fechado — assim a exclusao passa e a restauracao encontra o mes travado.
      const outro = await registerIsolatedTenant(ctx, 'restaura');
      await seedMovement(outro);

      const created = await outro.agent.post('/financial/expenses').send({
        condominiumId: outro.condominiumId,
        description: 'Despesa removida antes do fechamento',
        competence: previous,
        dueDate: previousDay(11).format('YYYY-MM-DD'),
        amount: 45,
        status: 'PAID',
        paidAt: previousDay(11).toISOString(),
      });
      expect(created.status).toBe(201);

      expect((await outro.agent.delete(`/financial/expenses/${created.body.data.id}`)).status).toBe(
        204,
      );
      expect((await close(outro)).status).toBe(200);

      const response = await outro.agent.post(
        `/financial/expenses/${created.body.data.id}/restore`,
      );

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(new RegExp(previous));
    });

    it('IT-289: cobranca com competencia no mes fechado continua permitida', async () => {
      const frozen = await read(tenant);

      const response = await tenant.agent.post('/financial/charges').send({
        condominiumId: tenant.condominiumId,
        unitId: tenant.unitId,
        description: 'Cobranca retroativa, que nao move o caixa',
        referenceMonth: previous,
        dueDate: previousDay(28).format('YYYY-MM-DD'),
        amount: 400,
      });
      expect(response.status).toBe(201);

      const after = await read(tenant);
      expect(after.totalIncome).toBe(frozen.totalIncome);
      expect(after.closingBalance).toBe(frozen.closingBalance);
    });

    it('IT-290: aplicar encargos sobre o mes fechado nao altera o documento gravado', async () => {
      const frozen = await read(tenant);

      const applied = await tenant.agent
        .post('/financial/charges/apply-late-fees')
        .send({ condominiumId: tenant.condominiumId });
      expect(applied.status).toBe(200);

      const after = await read(tenant);

      // Inclusive a inadimplencia, que e o unico numero do documento derivado de
      // cobranca — ela esta congelada por ter sido gravada, e nao por bloqueio.
      expect(after.delinquency).toEqual(frozen.delinquency);
      expect(after.closingBalance).toBe(frozen.closingBalance);
    });

    it('IT-295: reabrir um mes que nunca foi fechado e recusado', async () => {
      const response = await reopen(tenant, dayjs().subtract(5, 'month').format('YYYY-MM'));

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/nao esta fechada/i);
    });
  });

  describe('Reabrir o mes', () => {
    let tenant: IsolatedTenant;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'reabre');
      await seedMovement(tenant);
      expect((await close(tenant)).status).toBe(200);
    });

    it('IT-291: reabrir registra quem, quando e quantas vezes', async () => {
      const response = await reopen(tenant);
      expect(response.status).toBe(200);

      const body = response.body.data as StatementBody;
      expect(body.status).toBe('OPEN');
      expect(body.reopenedAt).toBeTruthy();
      expect(body.reopenCount).toBe(1);

      const audit = await tenant.agent.get('/audit-logs?resource=financial-closing&perPage=10');
      expect(audit.status).toBe(200);
      expect(
        audit.body.data.some((entry: { description: string }) =>
          /reaberto/i.test(entry.description ?? ''),
        ),
      ).toBe(true);
    });

    it('IT-292: com o mes reaberto, o lancamento volta a ser aceito', async () => {
      const charge = await tenant.agent.post('/financial/charges').send({
        condominiumId: tenant.condominiumId,
        unitId: tenant.unitId,
        description: 'Cobranca lancada apos a reabertura',
        referenceMonth: previous,
        dueDate: previousDay(25).format('YYYY-MM-DD'),
        amount: 320,
      });
      expect(charge.status).toBe(201);

      const response = await tenant.agent
        .post(`/financial/charges/${charge.body.data.id}/payments`)
        .send({ amount: 320, paidAt: previousDay(26).toISOString(), method: 'PIX' });

      expect(response.status).toBe(201);
    });

    it('IT-293: refechar atualiza a mesma linha, preserva a contagem e incorpora o novo', async () => {
      const beforeClose = await read(tenant);
      expect(beforeClose.status).toBe('OPEN');

      const closed = await close(tenant);
      expect(closed.status).toBe(200);

      const body = closed.body.data as StatementBody;
      expect(body.status).toBe('CLOSED');
      expect(body.reopenCount).toBe(1);
      expect(body.totalIncome).toBe(beforeClose.totalIncome);

      const list = await tenant.agent.get(
        `/financial/closings?condominiumId=${tenant.condominiumId}`,
      );
      expect(list.body.meta.total).toBe(1);
    });
  });

  describe('Matriz de papeis do seed', () => {
    it('IT-303: morador nao le o balancete', async () => {
      const morador = await login(ctx, seedUsers.morador);

      const response = await morador.get(
        `/financial/closings/${previous}?condominiumId=${ctx.seed.condominiumId}`,
      );

      expect(response.status).toBe(403);
    });

    it('IT-304: sindico le, fecha e reabre com as permissoes que o seed concede', async () => {
      const sindico = await login(ctx, seedUsers.sindico);
      const url = `/financial/closings/${previous}?condominiumId=${ctx.seed.condominiumId}`;

      expect((await sindico.get(url)).status).toBe(200);

      const closed = await sindico
        .post(`/financial/closings/${previous}/close`)
        .send({ condominiumId: ctx.seed.condominiumId });
      expect(closed.status).toBe(200);
      expect((closed.body.data as StatementBody).status).toBe('CLOSED');

      const reopened = await sindico
        .post(`/financial/closings/${previous}/reopen`)
        .send({ condominiumId: ctx.seed.condominiumId });
      expect(reopened.status).toBe(200);
      expect((reopened.body.data as StatementBody).status).toBe('OPEN');
    });
  });
});
