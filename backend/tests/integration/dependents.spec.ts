import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';
import { freshCpf, registerIsolatedTenant } from '../helpers/test-data';

describe('Backend: Dependents (IT-049)', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let testUnitId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);

    const block = await admin.post('/blocks').send({
      condominiumId: ctx.seed.condominiumId,
      name: `Bloco IT-049 ${Date.now()}`,
      type: 'BLOCK',
      floors: 1,
      unitsPerFloor: 1,
    });
    expect(block.status).toBe(201);

    const unit = await admin.post('/units').send({
      condominiumId: ctx.seed.condominiumId,
      blockId: block.body.data.id,
      number: '049-01',
      type: 'APARTMENT',
      status: 'VACANT',
    });
    expect(unit.status).toBe(201);
    testUnitId = unit.body.data.id;
  });

  afterAll(teardownTestContext);

  let residentCounter = 0;
  const residentPayload = (name: string) => ({
    condominiumId: ctx.seed.condominiumId,
    unitId: testUnitId,
    name,
    document: freshCpf(),
    email: `dep-${residentCounter}-${Date.now()}@exemplo.com.br`,
    phone: '(11) 97777-0001',
    type: 'OWNER',
    status: 'ACTIVE',
    isPrimary: true,
    moveInDate: '2026-01-10',
  });

  async function createResident(name: string): Promise<{ id: string }> {
    residentCounter += 1;
    const response = await admin.post('/residents').send(residentPayload(`${name} ${residentCounter}`));
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  async function createDependent(residentId: string, name: string): Promise<{ id: string }> {
    const response = await admin.post('/dependents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      residentId,
      name,
      relationship: 'CHILD',
      document: freshCpf(),
      birthDate: '2012-05-20',
      phone: '(11) 96666-0001',
      hasAccessCard: true,
      active: true,
    });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  it('IT-049 - CRUD completo (create, read, update, soft delete, restore)', async () => {
    const resident = await createResident('CRUD');
    const created = await admin.post('/dependents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      residentId: resident.id,
      name: 'Dependente CRUD',
      relationship: 'CHILD',
      document: freshCpf(),
      birthDate: '2012-05-20',
      phone: '(11) 96666-0001',
      hasAccessCard: true,
      active: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Dependente CRUD',
      residentId: resident.id,
      condominiumId: ctx.seed.condominiumId,
      relationship: 'CHILD',
      hasAccessCard: true,
      active: true,
    });
    const id = created.body.data.id as string;

    const read = await admin.get(`/dependents/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.name).toBe('Dependente CRUD');

    const updated = await admin.patch(`/dependents/${id}`).send({
      name: 'Dependente CRUD Atualizado',
      active: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Dependente CRUD Atualizado');
    expect(updated.body.data.active).toBe(false);

    const removed = await admin.delete(`/dependents/${id}`);
    expect(removed.status).toBe(204);

    const afterDelete = await admin.get(`/dependents/${id}`);
    expect(afterDelete.status).toBe(404);

    const restored = await admin.post(`/dependents/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.id).toBe(id);
    expect(restored.body.data.name).toBe('Dependente CRUD Atualizado');
  });

  it('IT-049.E1 - isolamento entre tenants: tenant A so enxerga os proprios dependentes', async () => {
    const other = await registerIsolatedTenant(ctx, 'dependents');

    const otherResident = await other.agent.post('/residents').send({
      condominiumId: other.condominiumId,
      unitId: other.unitId,
      name: 'Morador Isolado',
      document: freshCpf(),
      email: 'iso.dep.resident@exemplo.com.br',
      phone: '(11) 92222-0001',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
    });
    expect(otherResident.status).toBe(201);

    const foreign = await other.agent.post('/dependents').send({
      condominiumId: other.condominiumId,
      unitId: other.unitId,
      residentId: otherResident.body.data.id,
      name: 'Dependente Forasteiro',
      relationship: 'SPOUSE',
      document: freshCpf(),
      active: true,
    });
    expect(foreign.status).toBe(201);

    const ownResident = await createResident('Isolamento');
    const own = await createDependent(ownResident.id, 'Dependente Proprio');

    const listA = await admin.get('/dependents?perPage=200');
    expect(listA.status).toBe(200);
    const idsA = listA.body.data.map((item: { id: string }) => item.id);
    expect(idsA).toContain(own.id);
    expect(idsA).not.toContain(foreign.body.data.id);

    const listB = await other.agent.get('/dependents?perPage=200');
    expect(listB.status).toBe(200);
    const idsB = listB.body.data.map((item: { id: string }) => item.id);
    expect(idsB).toContain(foreign.body.data.id);
    expect(idsB).not.toContain(own.id);
  });

  it('IT-049.E2 - validacao: CPF invalido e recusado (422)', async () => {
    const resident = await createResident('Validacao');
    const response = await admin.post('/dependents').send({
      condominiumId: ctx.seed.condominiumId,
      unitId: testUnitId,
      residentId: resident.id,
      name: 'Dependente Invalido',
      relationship: 'CHILD',
      document: '123',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('IT-049.E3 - exclusao do morador em cascata soft-deleta os dependentes', async () => {
    const resident = await createResident('Cascata');
    const dependent = await createDependent(resident.id, 'Dependente Cascata');

    const removed = await admin.delete(`/residents/${resident.id}`);
    expect(removed.status).toBe(204);

    const list = await admin.get('/dependents?perPage=200');
    expect(list.body.data.map((item: { id: string }) => item.id)).not.toContain(dependent.id);

    const withDeleted = await admin.get('/dependents?includeDeleted=true&perPage=200');
    const deleted = withDeleted.body.data.find((item: { id: string }) => item.id === dependent.id);
    expect(deleted).toBeDefined();
    expect(deleted.deletedAt).toBeTruthy();

    const exposed = await admin.get(`/dependents/${dependent.id}`);
    expect(exposed.status).toBe(404);
  });
});