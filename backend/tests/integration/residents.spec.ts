import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';
import { freshCpf, registerIsolatedTenant } from '../helpers/test-data';

describe('Backend: Residents (IT-052)', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let testUnitId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);

    const block = await admin.post('/blocks').send({
      condominiumId: ctx.seed.condominiumId,
      name: `Bloco IT-052 ${Date.now()}`,
      type: 'BLOCK',
      floors: 1,
      unitsPerFloor: 1,
    });
    expect(block.status).toBe(201);

    const unit = await admin.post('/units').send({
      condominiumId: ctx.seed.condominiumId,
      blockId: block.body.data.id,
      number: '052-01',
      type: 'APARTMENT',
      status: 'VACANT',
    });
    expect(unit.status).toBe(201);
    testUnitId = unit.body.data.id;
  });

  afterAll(teardownTestContext);

  let residentCounter = 0;
  async function createResident(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    residentCounter += 1;
    const response = await admin.post('/residents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      name: `Morador IT-052 ${residentCounter}`,
      document: freshCpf(),
      email: `res-${residentCounter}-${Date.now()}@exemplo.com.br`,
      phone: '(11) 97777-0002',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
      moveInDate: '2026-02-15',
      ...overrides,
    });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  it('IT-052 - CRUD completo (create, read, update, soft delete, restore)', async () => {
    const created = await admin.post('/residents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      name: 'Morador CRUD',
      document: freshCpf(),
      email: `res-crud-${Date.now()}@exemplo.com.br`,
      phone: '(11) 97777-0002',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
      moveInDate: '2026-02-15',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Morador CRUD',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
    });
    const id = created.body.data.id as string;

    const read = await admin.get(`/residents/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.name).toBe('Morador CRUD');

    const updated = await admin.patch(`/residents/${id}`).send({
      type: 'TENANT',
      phone: '(11) 98888-0002',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.type).toBe('TENANT');
    expect(updated.body.data.phone).toBe('(11) 98888-0002');

    const removed = await admin.delete(`/residents/${id}`);
    expect(removed.status).toBe(204);

    const afterDelete = await admin.get(`/residents/${id}`);
    expect(afterDelete.status).toBe(404);

    const restored = await admin.post(`/residents/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.id).toBe(id);
    expect(restored.body.data.type).toBe('TENANT');
  });

  it('IT-052.E1 - isolamento entre tenants: tenant A so enxerga os proprios moradores', async () => {
    const other = await registerIsolatedTenant(ctx, 'residents');

    const foreign = await other.agent.post('/residents').send({
      condominiumId: other.condominiumId,
      unitId: other.unitId,
      name: 'Morador Forasteiro',
      document: freshCpf(),
      email: 'iso.res.foreign@exemplo.com.br',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
    });
    expect(foreign.status).toBe(201);

    const own = await createResident();

    const listA = await admin.get(`/residents?unitId=${testUnitId}&perPage=200`);
    expect(listA.status).toBe(200);
    const idsA = listA.body.data.map((item: { id: string }) => item.id);
    expect(idsA).toContain(own.id);
    expect(idsA).not.toContain(foreign.body.data.id);

    const listB = await other.agent.get('/residents?perPage=200');
    expect(listB.status).toBe(200);
    const idsB = listB.body.data.map((item: { id: string }) => item.id);
    expect(idsB).toContain(foreign.body.data.id);
    expect(idsB).not.toContain(own.id);
  });

  it('IT-052.E2 - morador criado aparece na lista de moradores da unidade', async () => {
    const resident = await createResident();

    const list = await admin.get(`/residents?unitId=${testUnitId}&perPage=200`);
    expect(list.status).toBe(200);
    const ids = list.body.data.map((item: { id: string }) => item.id);
    expect(ids).toContain(resident.id);
    expect(
      list.body.data.every((item: { unitId: string }) => item.unitId === testUnitId),
    ).toBe(true);
  });

  it('IT-052.E3 - validacao: CPF invalido e recusado (409)', async () => {
    const response = await admin.post('/residents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      name: 'Morador CPF Invalido',
      document: '11111111111',
      email: 'res-invalid-@exemplo.com.br',
      type: 'OWNER',
      status: 'ACTIVE',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(response.body.error.message).toContain('CPF');
  });

  it('IT-052.E4 - exclusao do morador soft-deleta dependentes, mas o restore nao restaura', async () => {
    const resident = await createResident();

    const depA = await admin.post('/dependents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      residentId: resident.id,
      name: 'Dependente A',
      relationship: 'CHILD',
      document: freshCpf(),
      active: true,
    });
    expect(depA.status).toBe(201);
    const depB = await admin.post('/dependents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      residentId: resident.id,
      name: 'Dependente B',
      relationship: 'SPOUSE',
      document: freshCpf(),
      active: true,
    });
    expect(depB.status).toBe(201);

    const removed = await admin.delete(`/residents/${resident.id}`);
    expect(removed.status).toBe(204);

    const withDeleted = await admin.get('/dependents?includeDeleted=true&perPage=200');
    const found = withDeleted.body.data.filter(
      (item: { id: string }) => item.id === depA.body.data.id || item.id === depB.body.data.id,
    );
    expect(found).toHaveLength(2);
    expect(found.every((item: { deletedAt: unknown }) => !!item.deletedAt)).toBe(true);

    const restored = await admin.post(`/residents/${resident.id}/restore`);
    expect(restored.status).toBe(200);

    const afterRestore = await admin.get('/dependents?includeDeleted=true&perPage=200');
    const stillDeleted = afterRestore.body.data.filter(
      (item: { id: string }) => item.id === depA.body.data.id || item.id === depB.body.data.id,
    );
    expect(stillDeleted).toHaveLength(2);
    expect(stillDeleted.every((item: { deletedAt: unknown }) => !!item.deletedAt)).toBe(true);
  });
});