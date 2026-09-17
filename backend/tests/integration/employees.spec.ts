import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';
import { freshCpf, registerIsolatedTenant } from '../helpers/test-data';

describe('Backend: Employees (IT-050)', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
  });

  afterAll(teardownTestContext);

  let employeeCounter = 0;
  async function createEmployee(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    employeeCounter += 1;
    const response = await admin.post('/employees').send({
      condominiumId: ctx.seed.condominiumId,
      name: `Funcionario IT-050 ${employeeCounter}`,
      document: freshCpf(),
      position: 'Porteiro',
      department: 'Portaria',
      contractType: 'CLT',
      status: 'ACTIVE',
      admissionDate: '2024-01-10',
      workSchedule: '12x36 - Diurno',
      salary: 2600,
      email: `emp-${employeeCounter}-${Date.now()}@exemplo.com.br`,
      ...overrides,
    });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  it('IT-050 - CRUD completo (create, read, update, soft delete, restore)', async () => {
    const created = await admin.post('/employees').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Funcionario CRUD',
      document: freshCpf(),
      position: 'Porteiro',
      department: 'Portaria',
      contractType: 'CLT',
      status: 'ACTIVE',
      admissionDate: '2024-01-10',
      salary: 2600,
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Funcionario CRUD',
      position: 'Porteiro',
      status: 'ACTIVE',
      salary: 2600,
    });
    const id = created.body.data.id as string;

    const read = await admin.get(`/employees/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.name).toBe('Funcionario CRUD');

    const updated = await admin.patch(`/employees/${id}`).send({
      position: 'Supervisor',
      salary: 3100,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.position).toBe('Supervisor');
    expect(updated.body.data.salary).toBe(3100);

    const removed = await admin.delete(`/employees/${id}`);
    expect(removed.status).toBe(204);

    const afterDelete = await admin.get(`/employees/${id}`);
    expect(afterDelete.status).toBe(404);

    const restored = await admin.post(`/employees/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.id).toBe(id);
    expect(restored.body.data.position).toBe('Supervisor');
  });

  it('IT-050.E1 - isolamento entre tenants: tenant A so enxerga os proprios funcionarios', async () => {
    const other = await registerIsolatedTenant(ctx, 'employees');

    const foreign = await other.agent.post('/employees').send({
      condominiumId: other.condominiumId,
      name: 'Funcionario Forasteiro',
      document: freshCpf(),
      position: 'Zelador',
      department: 'Limpeza',
      contractType: 'CLT',
      status: 'ACTIVE',
      salary: 1800,
    });
    expect(foreign.status).toBe(201);

    const own = await createEmployee();

    const listA = await admin.get('/employees?perPage=200');
    expect(listA.status).toBe(200);
    const idsA = listA.body.data.map((item: { id: string }) => item.id);
    expect(idsA).toContain(own.id);
    expect(idsA).not.toContain(foreign.body.data.id);

    const listB = await other.agent.get('/employees?perPage=200');
    expect(listB.status).toBe(200);
    const idsB = listB.body.data.map((item: { id: string }) => item.id);
    expect(idsB).toContain(foreign.body.data.id);
    expect(idsB).not.toContain(own.id);
  });

  it('IT-050.E2 - validacao: salario negativo e recusado (422)', async () => {
    const response = await admin.post('/employees').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Funcionario Salario Invalido',
      position: 'Auxiliar',
      salary: -1000,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('IT-050.E3 - CPF duplicado no mesmo condominio retorna 409', async () => {
    const cpf = freshCpf();

    const first = await admin.post('/employees').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Funcionario Primeiro',
      document: cpf,
      position: 'Porteiro',
      contractType: 'CLT',
      status: 'ACTIVE',
    });
    expect(first.status).toBe(201);

    const duplicate = await admin.post('/employees').send({
      condominiumId: ctx.seed.condominiumId,
      name: 'Funcionario Duplicado',
      document: cpf,
      position: 'Zelador',
      contractType: 'CLT',
      status: 'ACTIVE',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');

    const second = await createEmployee();
    const conflictOnUpdate = await admin.patch(`/employees/${second.id}`).send({ document: cpf });
    expect(conflictOnUpdate.status).toBe(409);
    expect(conflictOnUpdate.body.error.code).toBe('CONFLICT');
  });
});