import { financialClosingRepository } from '@/modules/financial/repositories/financial-closing.repository';
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

type EntryBody = {
  kind: 'INCOME' | 'EXPENSE';
  occurredAt: string;
  categoryId: string | null;
  categoryName: string;
  description: string;
  counterpart: string | null;
  amount: number;
  method: string | null;
  sourceId: string;
};

type EntriesBody = { entries: EntryBody[]; frozen: boolean };

describe('Balancete detalhado — os lancamentos, nos dois modos', () => {
  let ctx: TestContext;

  const current = dayjs().format('YYYY-MM');
  const previous = dayjs().subtract(1, 'month').format('YYYY-MM');
  const previousDay = (day: number) => dayjs().subtract(1, 'month').date(day);

  const readEntries = async (
    agent: AuthenticatedAgent,
    month: string,
    condominiumId: string,
  ): Promise<EntriesBody> => {
    const response = await agent.get(
      `/financial/closings/${month}/entries?condominiumId=${condominiumId}`,
    );
    expect(response.status).toBe(200);
    return response.body.data as EntriesBody;
  };

  /**
   * Um mes anterior com dois movimentos, para haver o que fechar — e para que a
   * lista fechada tenha mais de uma linha e a ordem signifique alguma coisa.
   */
  const seedMovement = async (tenant: IsolatedTenant) => {
    const payCharge = async (description: string, amount: number, day: number) => {
      const charge = await tenant.agent.post('/financial/charges').send({
        condominiumId: tenant.condominiumId,
        unitId: tenant.unitId,
        description,
        referenceMonth: previous,
        dueDate: previousDay(10).format('YYYY-MM-DD'),
        amount,
      });
      expect(charge.status).toBe(201);

      const payment = await tenant.agent
        .post(`/financial/charges/${charge.body.data.id}/payments`)
        .send({ amount, paidAt: previousDay(day).toISOString(), method: 'PIX' });
      expect(payment.status).toBe(201);

      return charge.body.data.id as string;
    };

    // Pagos fora da ordem do documento de proposito — o mais recente primeiro —,
    // porque a ordem que o balancete mostra e dele, e nao pode depender da ordem
    // em que os movimentos entraram.
    await payCharge('Taxa avulsa da unidade I-01', 250, 20);
    const chargeId = await payCharge('Taxa do mes fechado', 600, 12);

    return { chargeId };
  };

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(teardownTestContext);

  describe('Mes fechado: a lista servida e a gravada', () => {
    let tenant: IsolatedTenant;
    let seededChargeId: string;
    let frozenList: EntriesBody;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'lancamentos-fechado');
      seededChargeId = (await seedMovement(tenant)).chargeId;

      // As linhas saem do proprio fechamento, e nao de uma semeadura pelo
      // repositorio: quando estes casos foram escritos, `close` ainda nao
      // gravava lancamento nenhum (a escrita era da task_01) e a semeadura era
      // o unico jeito de ter o que ler. Agora que ela existe, ler o que a
      // escrita de verdade produziu e o que torna o caso honesto.
      const closed = await tenant.agent
        .post(`/financial/closings/${previous}/close`)
        .send({ condominiumId: tenant.condominiumId });
      expect(closed.status).toBe(200);
    });

    it('IT-324: mes fechado devolve os lancamentos gravados, congelados e em ordem', async () => {
      frozenList = await readEntries(tenant.agent, previous, tenant.condominiumId);

      expect(frozenList.frozen).toBe(true);
      expect(frozenList.entries).toHaveLength(2);
      expect(frozenList.entries.map((entry) => entry.amount)).toEqual([600, 250]);
      expect(frozenList.entries.map((entry) => dayjs(entry.occurredAt).date())).toEqual([12, 20]);
      expect(frozenList.entries[0].counterpart).toBe('I-01');
      expect(frozenList.entries[0].categoryName).toBe('Sem categoria');
      expect(frozenList.entries[0].kind).toBe('INCOME');
    });

    it('IT-325: escrita direta no banco depois do fechamento nao muda a lista', async () => {
      expect(frozenList.entries.length).toBeGreaterThan(0);

      // Pelo repositorio, contornando toda guarda de servico: e o unico jeito de
      // provar que a leitura serve o gravado em vez de recalcular. Se a lista
      // fosse recalculada, este pagamento apareceria nela — e o total acima
      // dela, congelado, continuaria a exclui-lo.
      await paymentRepository.create({ tenantId: tenant.tenantId }, {
        condominiumId: tenant.condominiumId,
        chargeId: seededChargeId,
        amount: 5000,
        paidAt: previousDay(22).toDate(),
        method: 'PIX',
      } as never);

      const after = await readEntries(tenant.agent, previous, tenant.condominiumId);

      expect(after.frozen).toBe(true);
      expect(after.entries).toEqual(frozenList.entries);
      expect(after.entries.some((entry) => entry.amount === 5000)).toBe(false);
    });
  });

  describe('Mes aberto: a lista e calculada', () => {
    let tenant: IsolatedTenant;
    let paymentSourceId: string;

    beforeAll(async () => {
      tenant = await registerIsolatedTenant(ctx, 'lancamentos-aberto');

      const charge = await tenant.agent.post('/financial/charges').send({
        condominiumId: tenant.condominiumId,
        unitId: tenant.unitId,
        description: 'Taxa do mes corrente',
        referenceMonth: current,
        dueDate: dayjs().date(10).format('YYYY-MM-DD'),
        amount: 400,
      });
      expect(charge.status).toBe(201);

      const payment = await tenant.agent
        .post(`/financial/charges/${charge.body.data.id}/payments`)
        .send({ amount: 400, paidAt: new Date().toISOString(), method: 'PIX' });
      expect(payment.status).toBe(201);
      // A baixa responde `{ charge, payment }`: o id do lancamento e o do
      // pagamento, e nao o da cobranca que ele quitou.
      paymentSourceId = payment.body.data.payment.id as string;

      const expense = await tenant.agent.post('/financial/expenses').send({
        condominiumId: tenant.condominiumId,
        description: 'Conta do mes corrente',
        competence: current,
        dueDate: dayjs().date(15).format('YYYY-MM-DD'),
        amount: 175.5,
        status: 'PAID',
        paidAt: new Date().toISOString(),
      });
      expect(expense.status).toBe(201);
    });

    it('IT-326: mes aberto calcula a lista, e o que foi pago ha pouco esta nela', async () => {
      const body = await readEntries(tenant.agent, current, tenant.condominiumId);

      expect(body.frozen).toBe(false);

      const income = body.entries.find((entry) => entry.sourceId === paymentSourceId);
      expect(income).toBeDefined();
      expect(income?.kind).toBe('INCOME');
      expect(income?.amount).toBe(400);
      expect(income?.counterpart).toBe('I-01');
      expect(income?.description).toBe('Taxa do mes corrente');
    });

    it('IT-327: a soma dos lancamentos bate com os totais do resumo da mesma competencia', async () => {
      const body = await readEntries(tenant.agent, current, tenant.condominiumId);

      const summary = await tenant.agent.get(
        `/financial/closings/${current}?condominiumId=${tenant.condominiumId}`,
      );
      expect(summary.status).toBe(200);

      const sum = (kind: 'INCOME' | 'EXPENSE') =>
        Math.round(
          body.entries
            .filter((entry) => entry.kind === kind)
            .reduce((total, entry) => total + entry.amount, 0) * 100,
        ) / 100;

      expect(sum('INCOME')).toBeGreaterThan(0);
      expect(sum('EXPENSE')).toBeGreaterThan(0);
      expect(sum('INCOME')).toBeCloseTo(summary.body.data.totalIncome, 2);
      expect(sum('EXPENSE')).toBeCloseTo(summary.body.data.totalExpense, 2);
    });

    it('IT-328: mes sem movimento devolve lista vazia, e nao 404', async () => {
      const empty = dayjs().add(6, 'month').format('YYYY-MM');

      const response = await tenant.agent.get(
        `/financial/closings/${empty}/entries?condominiumId=${tenant.condominiumId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.entries).toEqual([]);
      expect(response.body.data.frozen).toBe(false);
    });

    it('IT-329: os lancamentos vem ordenados por data crescente', async () => {
      const ordenado = await registerIsolatedTenant(ctx, 'lancamentos-ordem');

      // Lancados fora de ordem: 20, 5, 12.
      for (const [day, amount] of [
        [20, 90],
        [5, 110],
        [12, 130],
      ] as const) {
        const charge = await ordenado.agent.post('/financial/charges').send({
          condominiumId: ordenado.condominiumId,
          unitId: ordenado.unitId,
          description: `Taxa do dia ${day}`,
          referenceMonth: previous,
          dueDate: previousDay(1).format('YYYY-MM-DD'),
          amount,
        });
        expect(charge.status).toBe(201);

        const payment = await ordenado.agent
          .post(`/financial/charges/${charge.body.data.id}/payments`)
          .send({ amount, paidAt: previousDay(day).toISOString(), method: 'PIX' });
        expect(payment.status).toBe(201);
      }

      const body = await readEntries(ordenado.agent, previous, ordenado.condominiumId);

      expect(body.frozen).toBe(false);
      expect(body.entries.map((entry) => dayjs(entry.occurredAt).date())).toEqual([5, 12, 20]);
    });
  });

  describe('Recusas da rota', () => {
    let admin: AuthenticatedAgent;
    let sindico: AuthenticatedAgent;

    beforeAll(async () => {
      admin = await login(ctx, seedUsers.admin);
      sindico = await login(ctx, seedUsers.sindico);
    });

    it('IT-330: competencia impossivel e recusada antes de qualquer consulta', async () => {
      const response = await admin.get(
        `/financial/closings/2026-13/entries?condominiumId=${ctx.seed.condominiumId}`,
      );

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBeTruthy();
    });

    it('IT-331: condominio e obrigatorio', async () => {
      const response = await admin.get(`/financial/closings/${current}/entries`);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBeTruthy();
    });

    it('IT-332: condominio fora do escopo do usuario e recusado', async () => {
      const other = await admin.post('/condominiums').send({
        name: 'Condominio fora do escopo dos lancamentos',
        type: 'RESIDENTIAL',
        chargeDueDay: 10,
      });
      expect(other.status).toBe(201);

      const response = await sindico.get(
        `/financial/closings/${current}/entries?condominiumId=${other.body.data.id}`,
      );

      expect(response.status).toBe(403);
    });

    it('IT-333: quem le cobranca sem ler o balancete nao alcanca os lancamentos', async () => {
      const tenant = await registerIsolatedTenant(ctx, 'lancamentos-permissao');
      const slug = (await tenant.agent.get('/auth/me')).body.data.tenant.slug as string;

      const role = await tenant.agent.post('/roles').send({
        name: 'Papel so de cobranca',
        permissions: ['charge:read', 'condominium:read'],
      });
      expect(role.status).toBe(201);

      const email = `cobranca.${Date.now()}@exemplo.com.br`;
      const user = await tenant.agent.post('/users').send({
        name: 'Usuario so de cobranca',
        email,
        password: 'Demo@1234',
        roleId: role.body.data.id,
      });
      expect(user.status).toBe(201);

      const cobrador = await login(ctx, email, 'Demo@1234', slug);
      const response = await cobrador.get(
        `/financial/closings/${current}/entries?condominiumId=${tenant.condominiumId}`,
      );

      expect(response.status).toBe(403);
    });
  });

  describe('O documento anterior ao registro dos lancamentos', () => {
    it('IT-334: fechamento sem lancamentos gravados responde congelado e vazio', async () => {
      const tenant = await registerIsolatedTenant(ctx, 'lancamentos-legado');

      // Exatamente o estado do documento que ja existe no banco: fechado, com
      // total acima de zero, e sem lancamento nenhum gravado.
      await financialClosingRepository.create({ tenantId: tenant.tenantId }, {
        condominiumId: tenant.condominiumId,
        referenceMonth: previous,
        status: 'CLOSED',
        openingBalance: 0,
        openingBalanceSource: 'COMPUTED',
        totalIncome: 1234.56,
        totalExpense: 0,
        closingBalance: 1234.56,
        breakdown: { income: [], expense: [], unresolvedPaidExpenses: { count: 0, total: 0 } },
        closedAt: new Date(),
      } as never);

      const body = await readEntries(tenant.agent, previous, tenant.condominiumId);

      // `frozen: true` com lista vazia e o que distingue este documento de um
      // mes que simplesmente nao teve movimento, que responderia `false`.
      expect(body.frozen).toBe(true);
      expect(body.entries).toEqual([]);

      const summary = await tenant.agent.get(
        `/financial/closings/${previous}?condominiumId=${tenant.condominiumId}`,
      );
      expect(summary.body.data.totalIncome).toBeCloseTo(1234.56, 2);
    });
  });
});
