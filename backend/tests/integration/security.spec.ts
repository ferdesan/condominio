import request from 'supertest';
import { AppDataSource } from '@/config/data-source';
import { Condominium } from '@/modules/condominiums/condominium.entity';
import { Role } from '@/modules/roles/role.entity';
import { Tenant } from '@/modules/tenants/tenant.entity';
import { User } from '@/modules/users/user.entity';
import { ROLE_ADMIN, ROLE_DEFINITIONS } from '@/shared/constants/roles';
import { hashPassword } from '@/shared/utils/password.util';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from '../helpers/test-context';

/** Cria um segundo tenant completo para provar o isolamento entre clientes. */
async function createRivalTenant() {
  const manager = AppDataSource.manager;

  const tenant = await manager.save(
    manager.create(Tenant, {
      name: 'Administradora Rival',
      slug: 'rival',
      plan: 'STARTER',
      status: 'ACTIVE',
      maxCondominiums: 5,
      maxUsers: 20,
    }),
  );

  const roles = await manager.save(
    ROLE_DEFINITIONS.map((definition) =>
      manager.create(Role, {
        tenantId: tenant.id,
        name: definition.name,
        description: definition.description,
        permissions: definition.permissions,
        isSystem: true,
      }),
    ),
  );

  const condominium = await manager.save(
    manager.create(Condominium, {
      tenantId: tenant.id,
      name: 'Edificio Rival',
      status: 'ACTIVE',
      chargeDueDay: 5,
    }),
  );

  const user = await manager.save(
    manager.create(User, {
      tenantId: tenant.id,
      name: 'Admin Rival',
      email: 'admin@rival.com.br',
      passwordHash: await hashPassword('Rival@1234'),
      status: 'ACTIVE',
      roleId: roles.find((role) => role.name === ROLE_ADMIN)!.id,
    }),
  );

  return { tenant, condominium, user };
}

describe('Isolamento multi-tenant e RBAC', () => {
  let ctx: TestContext;
  let rival: Awaited<ReturnType<typeof createRivalTenant>>;

  beforeAll(async () => {
    ctx = await setupTestContext();
    rival = await createRivalTenant();
  });

  afterAll(teardownTestContext);

  describe('multi-tenancy', () => {
    it('nao lista condominios de outro tenant', async () => {
      const agent = await login(ctx, seedUsers.admin);
      const response = await agent.get('/condominiums');

      expect(response.status).toBe(200);
      const names = response.body.data.map((item: { name: string }) => item.name);
      expect(names).toContain('Residencial Parque das Flores');
      expect(names).not.toContain('Edificio Rival');
    });

    it('retorna 404 ao acessar um registro de outro tenant pelo id', async () => {
      const agent = await login(ctx, seedUsers.admin);
      const response = await agent.get(`/condominiums/${rival.condominium.id}`);

      expect(response.status).toBe(404);
    });

    it('impede vincular um recurso a um condominio de outro tenant', async () => {
      const agent = await login(ctx, seedUsers.admin);
      const response = await agent.post('/blocks').send({
        condominiumId: rival.condominium.id,
        name: 'Bloco Invasor',
        floors: 2,
      });

      expect(response.status).toBe(404);
    });

    it('o login do tenant rival enxerga apenas os proprios dados', async () => {
      const response = await request(ctx.app)
        .post(`${ctx.api}/auth/login`)
        .send({ email: 'admin@rival.com.br', password: 'Rival@1234' });

      expect(response.status).toBe(200);

      const token = response.body.data.tokens.accessToken as string;
      const list = await request(ctx.app)
        .get(`${ctx.api}/condominiums`)
        .set('Authorization', `Bearer ${token}`);

      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].name).toBe('Edificio Rival');
    });
  });

  describe('RBAC', () => {
    it('morador nao pode criar condominios', async () => {
      const agent = await login(ctx, seedUsers.morador);
      const response = await agent.post('/condominiums').send({ name: 'Condominio Pirata' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('morador nao pode listar usuarios da administradora', async () => {
      const agent = await login(ctx, seedUsers.morador);
      const response = await agent.get('/users');

      expect(response.status).toBe(403);
    });

    it('porteiro pode registrar visitantes mas nao alterar o financeiro', async () => {
      const agent = await login(ctx, seedUsers.porteiro);

      const allowed = await agent.get('/visitors');
      expect(allowed.status).toBe(200);

      const denied = await agent.post('/financial/charges').send({
        condominiumId: ctx.seed.condominiumId,
        unitId: ctx.seed.unitIds[0],
        description: 'Cobranca indevida',
        referenceMonth: '2026-01',
        dueDate: '2026-01-10',
        amount: 100,
      });
      expect(denied.status).toBe(403);
    });

    it('apenas operadores da plataforma listam todos os tenants', async () => {
      const admin = await login(ctx, seedUsers.admin);
      expect((await admin.get('/tenants')).status).toBe(403);

      const superAdmin = await login(ctx, seedUsers.superAdmin);
      const response = await superAdmin.get('/tenants');
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('registra a negativa de permissao na trilha de auditoria', async () => {
      const morador = await login(ctx, seedUsers.morador);
      await morador.get('/users');

      const admin = await login(ctx, seedUsers.admin);
      const logs = await admin.get('/audit-logs?action=PERMISSION_DENIED');

      expect(logs.status).toBe(200);
      expect(logs.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('protecoes de entrada', () => {
    it('nao permite alterar o tenant de um registro via payload', async () => {
      const agent = await login(ctx, seedUsers.admin);
      const created = await agent.post('/condominiums').send({
        name: 'Condominio Teste Tenant',
        tenantId: rival.tenant.id,
      });

      expect(created.status).toBe(201);
      expect(created.body.data.tenantId).toBe(ctx.seed.tenantId);
    });

    it('ignora ordenacao por campo nao permitido (guarda de SQL injection)', async () => {
      const agent = await login(ctx, seedUsers.admin);
      const response = await agent.get('/units?sortBy=(SELECT 1)&sortOrder=ASC');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('rejeita um id de rota que nao seja UUID', async () => {
      const agent = await login(ctx, seedUsers.admin);
      const response = await agent.get('/units/1 OR 1=1');

      expect(response.status).toBe(422);
    });

    it('nunca expoe o hash da senha nas respostas de usuario', async () => {
      const agent = await login(ctx, seedUsers.admin);
      const response = await agent.get('/users');

      expect(response.status).toBe(200);
      for (const user of response.body.data) {
        expect(user).not.toHaveProperty('passwordHash');
      }
    });
  });
});
