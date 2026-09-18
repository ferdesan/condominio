import { expenseRepository } from '@/modules/financial/repositories/expense.repository';
import { financialClosingRepository } from '@/modules/financial/repositories/financial-closing.repository';
import { UNCATEGORIZED_LABEL } from '@/modules/financial/closing-math';
import { dayjs } from '@/shared/utils/date.util';
import { registerIsolatedTenant } from '../helpers/test-data';
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
  openingBalance: { amount: number; source: 'INHERITED' | 'COMPUTED'; from: string | null };
  income: { categoryId: string | null; name: string; total: number }[];
  expense: { categoryId: string | null; name: string; total: number }[];
  totalIncome: number;
  totalExpense: number;
  result: number;
  closingBalance: number;
  unresolvedPaidExpenses: { count: number; total: number };
  delinquency: { amount: number; count: number };
  closedAt: string | null;
  reopenCount: number;
};

describe('Balancete mensal — leitura', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let sindico: AuthenticatedAgent;

  const current = dayjs().format('YYYY-MM');
  const previous = dayjs().subtract(1, 'month').format('YYYY-MM');

  const sum = (lines: { total: number }[]) =>
    Math.round(lines.reduce((total, line) => total + line.total, 0) * 100) / 100;

  const read = async (
    agent: AuthenticatedAgent,
    month: string,
    condominiumId = ctx.seed.condominiumId,
  ): Promise<StatementBody> => {
    const response = await agent.get(
      `/financial/closings/${month}?condominiumId=${condominiumId}`,
    );
    expect(response.status).toBe(200);
    return response.body.data as StatementBody;
  };

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    sindico = await login(ctx, seedUsers.sindico);
  });

  afterAll(teardownTestContext);

  describe('Regime de caixa', () => {
    it('IT-258: a receita segue a data do pagamento, e nao a competencia da cobranca', async () => {
      // O seed paga toda cobranca dentro da propria competencia, entao caixa e
      // competencia coincidem nele. A divergencia e criada aqui: uma cobranca
      // vencida do mes passado, quitada agora.
      const overdue = await admin.get(
        `/financial/charges?condominiumId=${ctx.seed.condominiumId}&referenceMonth=${previous}&status=OVERDUE&perPage=1`,
      );
      const charge = overdue.body.data[0];
      expect(charge).toBeDefined();

      const before = await read(admin, current);
      const summaryBefore = await admin.get(
        `/financial/charges/summary?condominiumId=${ctx.seed.condominiumId}&referenceMonth=${current}`,
      );

      const amount = 150;
      const registered = await admin
        .post(`/financial/charges/${charge.id}/payments`)
        .send({ amount, paidAt: new Date().toISOString(), method: 'PIX' });
      expect(registered.status).toBe(201);

      const after = await read(admin, current);
      const summaryAfter = await admin.get(
        `/financial/charges/summary?condominiumId=${ctx.seed.condominiumId}&referenceMonth=${current}`,
      );

      // O caixa do mes corrente cresce exatamente o valor pago...
      expect(after.totalIncome).toBe(Math.round((before.totalIncome + amount) * 100) / 100);
      // ...e o recebido por competencia do mes corrente nao se move, porque a
      // cobranca pertence ao mes anterior. Sao perguntas diferentes.
      expect(summaryAfter.body.data.received).toBe(summaryBefore.body.data.received);
    });

    it('IT-259: cobranca paga parcialmente entra pelo valor pago, e nao pelo faturado', async () => {
      const unit = await admin.get(`/units?condominiumId=${ctx.seed.condominiumId}&perPage=1`);
      const created = await admin.post('/financial/charges').send({
        condominiumId: ctx.seed.condominiumId,
        unitId: unit.body.data[0].id,
        description: 'Cobranca de teste do balancete parcial',
        referenceMonth: current,
        dueDate: dayjs().date(20).format('YYYY-MM-DD'),
        amount: 500,
      });
      expect(created.status).toBe(201);

      const before = await read(admin, current);
      await admin
        .post(`/financial/charges/${created.body.data.id}/payments`)
        .send({ amount: 200, paidAt: new Date().toISOString(), method: 'PIX' });
      const after = await read(admin, current);

      expect(after.totalIncome - before.totalIncome).toBeCloseTo(200, 2);
    });

    it('IT-260: cobranca cancelada nao entra em lado nenhum', async () => {
      const unit = await admin.get(`/units?condominiumId=${ctx.seed.condominiumId}&perPage=1`);
      const before = await read(admin, current);

      const created = await admin.post('/financial/charges').send({
        condominiumId: ctx.seed.condominiumId,
        unitId: unit.body.data[0].id,
        description: 'Cobranca cancelada do balancete',
        referenceMonth: current,
        dueDate: dayjs().date(20).format('YYYY-MM-DD'),
        amount: 900,
      });
      await admin.post(`/financial/charges/${created.body.data.id}/cancel`).send({});

      const after = await read(admin, current);
      expect(after.totalIncome).toBe(before.totalIncome);
      expect(after.totalExpense).toBe(before.totalExpense);
    });

    it('IT-261: despesa pendente nao entra, por mais que venca no mes', async () => {
      const before = await read(admin, current);

      const created = await admin.post('/financial/expenses').send({
        condominiumId: ctx.seed.condominiumId,
        description: 'Despesa pendente do balancete',
        competence: current,
        dueDate: dayjs().date(25).format('YYYY-MM-DD'),
        amount: 480,
      });
      expect(created.status).toBe(201);

      const after = await read(admin, current);
      expect(after.totalExpense).toBe(before.totalExpense);
    });

    it('IT-262: despesa da competencia anterior paga neste mes sai no caixa deste mes', async () => {
      const created = await admin.post('/financial/expenses').send({
        condominiumId: ctx.seed.condominiumId,
        description: 'Conta do mes passado paga agora',
        competence: previous,
        dueDate: dayjs().subtract(1, 'month').date(28).format('YYYY-MM-DD'),
        amount: 311.5,
      });
      expect(created.status).toBe(201);

      const currentBefore = await read(admin, current);
      const previousBefore = await read(admin, previous);

      const paid = await admin
        .post(`/financial/expenses/${created.body.data.id}/pay`)
        .send({ paidAt: new Date().toISOString(), paymentMethod: 'TRANSFER' });
      expect(paid.status).toBe(200);

      const currentAfter = await read(admin, current);
      const previousAfter = await read(admin, previous);

      expect(currentAfter.totalExpense - currentBefore.totalExpense).toBeCloseTo(311.5, 2);
      expect(previousAfter.totalExpense).toBe(previousBefore.totalExpense);
    });
  });

  describe('Linhas e totais', () => {
    it('IT-263: categoria nula vira linha propria nos dois lados, e o total continua fechando', async () => {
      const unit = await admin.get(`/units?condominiumId=${ctx.seed.condominiumId}&perPage=1`);

      const charge = await admin.post('/financial/charges').send({
        condominiumId: ctx.seed.condominiumId,
        unitId: unit.body.data[0].id,
        description: 'Cobranca sem categoria',
        referenceMonth: current,
        dueDate: dayjs().date(20).format('YYYY-MM-DD'),
        amount: 120,
      });
      await admin
        .post(`/financial/charges/${charge.body.data.id}/payments`)
        .send({ amount: 120, paidAt: new Date().toISOString(), method: 'PIX' });

      const expense = await admin.post('/financial/expenses').send({
        condominiumId: ctx.seed.condominiumId,
        description: 'Despesa sem categoria',
        competence: current,
        dueDate: dayjs().date(20).format('YYYY-MM-DD'),
        amount: 75,
        status: 'PAID',
        paidAt: new Date().toISOString(),
      });
      expect(expense.status).toBe(201);

      const statement = await read(admin, current);

      expect(statement.income.some((line) => line.name === UNCATEGORIZED_LABEL)).toBe(true);
      expect(statement.expense.some((line) => line.name === UNCATEGORIZED_LABEL)).toBe(true);
      expect(statement.totalIncome).toBe(sum(statement.income));
      expect(statement.totalExpense).toBe(sum(statement.expense));
    });

    it('IT-264: o total do topo e a soma das linhas, nos dois lados', async () => {
      const statement = await read(admin, current);

      expect(statement.totalIncome).toBe(sum(statement.income));
      expect(statement.totalExpense).toBe(sum(statement.expense));
    });

    it('IT-265: o saldo final e a abertura mais o resultado do mes', async () => {
      const statement = await read(admin, current);

      expect(statement.result).toBeCloseTo(statement.totalIncome - statement.totalExpense, 2);
      expect(statement.closingBalance).toBeCloseTo(
        statement.openingBalance.amount + statement.result,
        2,
      );
    });

    it('IT-266: a inadimplencia e quadro auxiliar, e nao entra no resultado', async () => {
      const statement = await read(admin, previous);

      expect(statement.delinquency.amount).toBeGreaterThan(0);
      expect(statement.delinquency.count).toBeGreaterThan(0);
      expect(statement.result).toBeCloseTo(statement.totalIncome - statement.totalExpense, 2);
      expect(statement.closingBalance).toBeCloseTo(
        statement.openingBalance.amount + statement.result,
        2,
      );
    });

    it('IT-267: despesa paga sem data aparece a parte, e fora de todo total', async () => {
      const before = await read(admin, current);

      // Escrita direta no repositorio, contornando o servico de proposito: este
      // e o estado que o invariante da task_01 passou a recusar, e o caso existe
      // para provar que uma linha anterior a ele continua visivel.
      await expenseRepository.create({ tenantId: ctx.seed.tenantId }, {
        condominiumId: ctx.seed.condominiumId,
        description: 'Despesa paga sem data, anterior ao invariante',
        competence: current,
        dueDate: dayjs().date(15).format('YYYY-MM-DD'),
        amount: 900,
        status: 'PAID',
        paidAt: null,
      } as never);

      const after = await read(admin, current);

      expect(after.unresolvedPaidExpenses.count).toBe(before.unresolvedPaidExpenses.count + 1);
      expect(after.unresolvedPaidExpenses.total - before.unresolvedPaidExpenses.total).toBeCloseTo(
        900,
        2,
      );
      expect(after.totalExpense).toBe(before.totalExpense);
      expect(after.closingBalance).toBe(before.closingBalance);
    });

    it('IT-268: mes sem lancamento devolve zeros e continua aberto', async () => {
      const empty = dayjs().add(6, 'month').format('YYYY-MM');
      const statement = await read(admin, empty);

      expect(statement.totalIncome).toBe(0);
      expect(statement.totalExpense).toBe(0);
      expect(statement.income).toEqual([]);
      expect(statement.expense).toEqual([]);
      expect(statement.status).toBe('OPEN');
      expect(statement.closedAt).toBeNull();
      expect(statement.reopenCount).toBe(0);
    });
  });

  describe('Recusas da rota', () => {
    it('IT-269: competencia impossivel e recusada antes de qualquer consulta', async () => {
      const response = await admin.get(
        `/financial/closings/2026-13?condominiumId=${ctx.seed.condominiumId}`,
      );

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBeTruthy();
    });

    it('IT-270: condominio e obrigatorio', async () => {
      const response = await admin.get(`/financial/closings/${current}`);

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBeTruthy();
    });

    it('IT-271: condominio fora do escopo do usuario e recusado', async () => {
      const other = await admin.post('/condominiums').send({
        name: 'Condominio fora do escopo do sindico',
        type: 'RESIDENTIAL',
        chargeDueDay: 10,
      });
      expect(other.status).toBe(201);

      const response = await sindico.get(
        `/financial/closings/${current}?condominiumId=${other.body.data.id}`,
      );

      expect(response.status).toBe(403);
    });
  });

  describe('Saldo de abertura', () => {
    it('IT-272: o primeiro mes parte do saldo de abertura do condominio', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'balancete-abertura');

      const patched = await isolated.agent.patch(`/condominiums/${isolated.condominiumId}`).send({
        openingBalance: 1000,
        openingBalanceDate: dayjs().subtract(6, 'month').format('YYYY-MM-DD'),
      });
      expect(patched.status).toBe(200);

      const statement = await read(isolated.agent, current, isolated.condominiumId);

      expect(statement.openingBalance.source).toBe('COMPUTED');
      expect(statement.openingBalance.amount).toBeCloseTo(1000, 2);
      expect(statement.totalIncome).toBe(0);
    });

    it('IT-273: o mes seguinte herda exatamente o saldo final do mes fechado', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'balancete-heranca');

      // A linha e criada pelo repositorio: a rota de fechamento e da task_03, e
      // o que este caso afirma e a heranca, nao o ato de fechar.
      await financialClosingRepository.create({ tenantId: isolated.tenantId }, {
        condominiumId: isolated.condominiumId,
        referenceMonth: previous,
        status: 'CLOSED',
        openingBalance: 0,
        openingBalanceSource: 'COMPUTED',
        totalIncome: 0,
        totalExpense: 0,
        closingBalance: 777.77,
        breakdown: { income: [], expense: [], unresolvedPaidExpenses: { count: 0, total: 0 } },
        closedAt: new Date(),
      } as never);

      const statement = await read(isolated.agent, current, isolated.condominiumId);

      expect(statement.openingBalance).toEqual({
        amount: 777.77,
        source: 'INHERITED',
        from: previous,
      });
    });

    it('IT-274: movimento anterior a data de corte fica de fora do saldo de abertura', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'balancete-corte');

      const cutoff = dayjs().subtract(1, 'month').startOf('month');
      await isolated.agent.patch(`/condominiums/${isolated.condominiumId}`).send({
        openingBalance: 1000,
        openingBalanceDate: cutoff.format('YYYY-MM-DD'),
      });

      const before = await isolated.agent.post('/financial/expenses').send({
        condominiumId: isolated.condominiumId,
        description: 'Paga antes do corte',
        competence: dayjs().subtract(2, 'month').format('YYYY-MM'),
        dueDate: dayjs().subtract(2, 'month').date(10).format('YYYY-MM-DD'),
        amount: 400,
        status: 'PAID',
        paidAt: dayjs().subtract(2, 'month').date(10).toISOString(),
      });
      expect(before.status).toBe(201);

      const after = await isolated.agent.post('/financial/expenses').send({
        condominiumId: isolated.condominiumId,
        description: 'Paga depois do corte',
        competence: previous,
        dueDate: cutoff.date(10).format('YYYY-MM-DD'),
        amount: 250,
        status: 'PAID',
        paidAt: cutoff.date(10).toISOString(),
      });
      expect(after.status).toBe(201);

      const statement = await read(isolated.agent, current, isolated.condominiumId);

      // 1000 - 250: a de 400 e anterior ao corte e nao conta.
      expect(statement.openingBalance.amount).toBeCloseTo(750, 2);
    });
  });

  describe('Listagem dos meses fechados', () => {
    it('IT-296: lista os fechamentos do condominio, do mes mais recente para o mais antigo', async () => {
      const isolated = await registerIsolatedTenant(ctx, 'balancete-lista');
      const older = dayjs().subtract(2, 'month').format('YYYY-MM');

      for (const referenceMonth of [older, previous]) {
        await financialClosingRepository.create({ tenantId: isolated.tenantId }, {
          condominiumId: isolated.condominiumId,
          referenceMonth,
          status: 'CLOSED',
          closingBalance: 10,
          breakdown: { income: [], expense: [], unresolvedPaidExpenses: { count: 0, total: 0 } },
          closedAt: new Date(),
        } as never);
      }

      const response = await isolated.agent.get(
        `/financial/closings?condominiumId=${isolated.condominiumId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.meta.total).toBe(2);
      expect(response.body.data.map((row: { referenceMonth: string }) => row.referenceMonth)).toEqual(
        [previous, older],
      );
    });

    it('IT-297: fechamento de outro condominio nao aparece na lista filtrada', async () => {
      // No tenant demo, e nao num isolado: um tenant auto-registrado nasce com
      // limite de um condominio (`maxCondominiums`), e este caso precisa de dois.
      const second = await admin.post('/condominiums').send({
        name: 'Segundo condominio para o escopo da lista',
        type: 'RESIDENTIAL',
        chargeDueDay: 10,
      });
      expect(second.status).toBe(201);

      await financialClosingRepository.create({ tenantId: ctx.seed.tenantId }, {
        condominiumId: second.body.data.id,
        referenceMonth: previous,
        status: 'CLOSED',
        closingBalance: 55,
        breakdown: { income: [], expense: [], unresolvedPaidExpenses: { count: 0, total: 0 } },
        closedAt: new Date(),
      } as never);

      const own = await admin.get(
        `/financial/closings?condominiumId=${second.body.data.id}`,
      );
      expect(own.status).toBe(200);
      expect(own.body.meta.total).toBe(1);

      const seeded = await admin.get(
        `/financial/closings?condominiumId=${ctx.seed.condominiumId}`,
      );
      expect(seeded.status).toBe(200);
      expect(seeded.body.meta.total).toBe(0);
    });
  });
});
