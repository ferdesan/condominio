import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';
import { freshCnpj, registerIsolatedTenant } from '../helpers/test-data';

describe('Backend: Service-Providers (IT-051)', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
  });

  afterAll(teardownTestContext);

  let providerCounter = 0;
  async function createProvider(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    providerCounter += 1;
    const response = await admin.post('/service-providers').send({
      condominiumId: ctx.seed.condominiumId,
      companyName: `Prestadora IT-051 ${providerCounter}`,
      tradeName: `Prestadora ${providerCounter}`,
      document: freshCnpj(),
      serviceType: 'Manutencao',
      contactName: 'Contato Tecnico',
      phone: '(11) 91111-0001',
      status: 'ACTIVE',
      rating: 5,
      ...overrides,
    });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  it('IT-051 - CRUD completo (create, read, update, soft delete, restore)', async () => {
    const created = await admin.post('/service-providers').send({
      condominiumId: ctx.seed.condominiumId,
      companyName: 'Elevadores Seguros LTDA',
      tradeName: 'Seguros Elevadores',
      document: freshCnpj(),
      serviceType: 'Manutencao de elevadores',
      contactName: 'Sergio Prado',
      phone: '(11) 3222-1000',
      status: 'ACTIVE',
      contractStart: '2024-01-01',
      contractEnd: '2026-12-31',
      rating: 5,
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      companyName: 'Elevadores Seguros LTDA',
      tradeName: 'Seguros Elevadores',
      serviceType: 'Manutencao de elevadores',
      status: 'ACTIVE',
      rating: 5,
    });
    const id = created.body.data.id as string;

    const read = await admin.get(`/service-providers/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.data.companyName).toBe('Elevadores Seguros LTDA');

    const updated = await admin.patch(`/service-providers/${id}`).send({
      tradeName: 'Seguros Elevadores Atualizado',
      rating: 4,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.tradeName).toBe('Seguros Elevadores Atualizado');
    expect(updated.body.data.rating).toBe(4);

    const removed = await admin.delete(`/service-providers/${id}`);
    expect(removed.status).toBe(204);

    const afterDelete = await admin.get(`/service-providers/${id}`);
    expect(afterDelete.status).toBe(404);

    const restored = await admin.post(`/service-providers/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.id).toBe(id);
    expect(restored.body.data.tradeName).toBe('Seguros Elevadores Atualizado');
  });

  it('IT-051.E1 - isolamento entre tenants: tenant A so enxerga os proprios prestadores', async () => {
    const other = await registerIsolatedTenant(ctx, 'providers');

    const foreign = await other.agent.post('/service-providers').send({
      condominiumId: other.condominiumId,
      companyName: 'Prestadora Forasteira',
      document: freshCnpj(),
      serviceType: 'Jardinagem',
      status: 'ACTIVE',
    });
    expect(foreign.status).toBe(201);

    const own = await createProvider();

    const listA = await admin.get('/service-providers?perPage=200');
    expect(listA.status).toBe(200);
    const idsA = listA.body.data.map((item: { id: string }) => item.id);
    expect(idsA).toContain(own.id);
    expect(idsA).not.toContain(foreign.body.data.id);

    const listB = await other.agent.get('/service-providers?perPage=200');
    expect(listB.status).toBe(200);
    const idsB = listB.body.data.map((item: { id: string }) => item.id);
    expect(idsB).toContain(foreign.body.data.id);
    expect(idsB).not.toContain(own.id);
  });

  it('IT-051.E2 - validacao: CNPJ com formato invalido e recusado (422)', async () => {
    const response = await admin.post('/service-providers').send({
      condominiumId: ctx.seed.condominiumId,
      companyName: 'Executora Invalida',
      document: '12345',
      serviceType: 'Limpeza',
      status: 'ACTIVE',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});