import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('Estrutura do condominio (condominios, blocos e unidades)', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
  });

  afterAll(teardownTestContext);

  it('cria um condominio e retorna os indicadores consolidados', async () => {
    const created = await admin.post('/condominiums').send({
      name: 'Residencial Vista Verde',
      document: '11444777000161',
      city: 'Campinas',
      state: 'sp',
      chargeDueDay: 5,
    });

    expect(created.status).toBe(201);
    expect(created.body.data.state).toBe('SP');

    const stats = await admin.get(`/condominiums/${created.body.data.id}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({ units: 0, residents: 0, openIncidents: 0 });
  });

  it('recusa CNPJ duplicado no mesmo tenant', async () => {
    const response = await admin.post('/condominiums').send({
      name: 'Clone do Parque das Flores',
      document: '98765432000188',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('valida o payload de criacao de bloco', async () => {
    const response = await admin.post('/blocks').send({ name: '' });

    expect(response.status).toBe(422);
    expect(response.body.error.details.map((detail: { field: string }) => detail.field)).toContain(
      'condominiumId',
    );
  });

  it('impede dois blocos com o mesmo nome no condominio', async () => {
    const response = await admin.post('/blocks').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Torre A',
      floors: 3,
    });

    expect(response.status).toBe(409);
  });

  it('cria unidades em lote respeitando o padrao de numeracao', async () => {
    const block = await admin.post('/blocks').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Torre C',
      type: 'TOWER',
      floors: 3,
      unitsPerFloor: 2,
    });
    expect(block.status).toBe(201);

    const bulk = await admin.post('/units/bulk').send({
      condominiumId: ctx.seed.condominiumId,
      blockId: block.body.data.id,
      floors: 3,
      unitsPerFloor: 2,
      startFloor: 1,
      numberPattern: '{floor}{index}',
      monthlyFee: 520,
    });

    expect(bulk.status).toBe(201);
    expect(bulk.body.data.created).toBe(6);

    const units = await admin.get(`/units?blockId=${block.body.data.id}&perPage=100`);
    expect(units.body.meta.total).toBe(6);
    expect(units.body.data.map((unit: { number: string }) => unit.number)).toContain('101');
  });

  it('nao repete unidades ja existentes em uma segunda geracao em lote', async () => {
    const block = await admin.post('/blocks').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Torre D',
      floors: 2,
      unitsPerFloor: 2,
    });

    const payload = {
      condominiumId: ctx.seed.condominiumId,
      blockId: block.body.data.id,
      floors: 2,
      unitsPerFloor: 2,
    };

    const first = await admin.post('/units/bulk').send(payload);
    expect(first.body.data.created).toBe(4);

    const second = await admin.post('/units/bulk').send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('bloqueia a exclusao de bloco com unidades vinculadas', async () => {
    const units = await admin.get(`/units?condominiumId=${ctx.seed.condominiumId}&perPage=1`);
    const blockId = units.body.data[0].blockId;

    const response = await admin.delete(`/blocks/${blockId}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/unidades vinculadas/i);
  });

  it('bloqueia a exclusao de unidade com moradores ativos', async () => {
    const response = await admin.delete(`/units/${ctx.seed.unitIds[0]}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/moradores ativos/i);
  });

  it('pagina, filtra e ordena a listagem de unidades', async () => {
    const response = await admin.get(
      `/units?condominiumId=${ctx.seed.condominiumId}&page=1&perPage=5&sortBy=number&sortOrder=ASC`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(5);
    expect(response.body.meta).toMatchObject({ page: 1, perPage: 5, hasPrevious: false });
    expect(response.body.meta.total).toBeGreaterThan(5);

    const numbers = response.body.data.map((unit: { number: string }) => unit.number);
    expect([...numbers].sort()).toEqual(numbers);
  });

  it('busca unidades por texto livre', async () => {
    const response = await admin.get(`/units?search=101&perPage=50`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    for (const unit of response.body.data) {
      expect(unit.number).toContain('101');
    }
  });

  it('remove logicamente e restaura uma unidade', async () => {
    const block = await admin.post('/blocks').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Torre E',
      floors: 1,
      unitsPerFloor: 1,
    });

    const unit = await admin.post('/units').send({
      condominiumId: ctx.seed.condominiumId,
      blockId: block.body.data.id,
      number: '999',
      floor: 1,
      monthlyFee: 300,
    });
    expect(unit.status).toBe(201);

    const removed = await admin.delete(`/units/${unit.body.data.id}`);
    expect(removed.status).toBe(204);

    const afterDelete = await admin.get(`/units/${unit.body.data.id}`);
    expect(afterDelete.status).toBe(404);

    const restored = await admin.post(`/units/${unit.body.data.id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.number).toBe('999');
  });

  it('calcula a soma das fracoes ideais do condominio', async () => {
    const response = await admin.get(
      `/units/ideal-fraction?condominiumId=${ctx.seed.condominiumId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBeGreaterThan(0);
    expect(typeof response.body.data.isBalanced).toBe('boolean');
  });
});
