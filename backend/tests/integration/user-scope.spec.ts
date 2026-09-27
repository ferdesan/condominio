import { AppDataSource } from '@/config/data-source';
import { Condominium } from '@/modules/condominiums/condominium.entity';
import { Role } from '@/modules/roles/role.entity';
import { Tenant } from '@/modules/tenants/tenant.entity';
import { User } from '@/modules/users/user.entity';
import { ROLE_SINDICO, ROLE_STAFF } from '@/shared/constants/roles';
import { hashPassword } from '@/shared/utils/password.util';
import {
  login,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

/** Papel do tenant de teste, resolvido por nome. */
async function roleIdByName(ctx: TestContext, name: string): Promise<string> {
  const role = await AppDataSource.manager
    .createQueryBuilder()
    .select('role')
    .from(Role, 'role')
    .where('role.tenantId = :tenantId', { tenantId: ctx.seed.tenantId })
    .andWhere('role.name = :roleName', { roleName: name })
    .getOneOrFail();

  return role.id;
}

type OutOfScope = { condominium: Condominium; user: User };

/**
 * Cria um condominio do mesmo tenant e um usuario vinculado apenas a ele.
 * E o par que prova o escopo: o sindico do condominio seed nao administra este
 * segundo, entao nao pode nem ve-lo nem alcanca-lo.
 *
 * Memoizado porque o e-mail e unico por tenant — chamar a cada teste estouraria
 * o indice, e o proprio.fixture se tornaria a causa da falha.
 */
let outOfScope: OutOfScope | null = null;

async function seedOutOfScopeCondominium(ctx: TestContext): Promise<OutOfScope> {
  if (outOfScope) return outOfScope;

  const manager = AppDataSource.manager;

  const condominium = await manager.save(
    manager.create(Condominium, {
      tenantId: ctx.seed.tenantId,
      name: 'Condominio Fora do Escopo',
      status: 'ACTIVE',
      chargeDueDay: 10,
    }),
  );

  const user = await manager.save(
    manager.create(User, {
      tenantId: ctx.seed.tenantId,
      name: 'Zelador Fora do Escopo',
      email: 'fora.escopo@exemplo.com.br',
      passwordHash: await hashPassword('Demo@1234'),
      status: 'ACTIVE',
      roleId: await roleIdByName(ctx, ROLE_STAFF),
    }),
  );

  await manager.createQueryBuilder().relation(User, 'condominiums').of(user.id).add(condominium.id);

  outOfScope = { condominium, user };
  return outOfScope;
}

describe('Escopo de condominio na listagem de usuarios', () => {
  let ctx: TestContext;
  let sindico: AuthenticatedAgent;
  let admin: AuthenticatedAgent;

  beforeAll(async () => {
    ctx = await setupTestContext();
    sindico = await login(ctx, 'sindico@parqueflores.com.br');
    admin = await login(ctx, 'admin@horizonte.com.br');
  });

  afterAll(async () => {
    await teardownTestContext();
  });

  describe('Leitura', () => {
    it('UT-SCOPE-01: o sindico ve os usuarios do seu condominio e as contas globais', async () => {
      const response = await sindico.get('/users?perPage=200');

      expect(response.status).toBe(200);

      const emails = response.body.data.map((user: { email: string }) => user.email);

      // Do proprio condominio.
      expect(emails).toContain('portaria@parqueflores.com.br');
      expect(emails).toContain('morador@parqueflores.com.br');
      // Sem vinculo: sao globais e precisam continuar visiveis para suporte.
      expect(emails).toContain('admin@horizonte.com.br');
      // O proprio.
      expect(emails).toContain('sindico@parqueflores.com.br');
    });

    it('UT-SCOPE-02: usuario de condominio que o sindico nao administra fica de fora', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.get('/users?perPage=200');

      expect(response.status).toBe(200);
      expect(response.body.data.map((row: { email: string }) => row.email)).not.toContain(
        user.email,
      );
    });

    it('UT-SCOPE-03: o filtro de busca tambem respeita o escopo', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.get(`/users?search=${encodeURIComponent(user.email)}`);

      expect(response.status).toBe(200);
      expect(response.body.meta.total).toBe(0);
    });

    it('UT-SCOPE-04: detalhe de usuario fora do escopo responde 404, sem revelar existencia', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.get(`/users/${user.id}`);

      expect(response.status).toBe(404);
    });

    it('UT-SCOPE-05: o administrador sem vinculo continua enxergando todo o tenant', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await admin.get('/users?perPage=200');

      expect(response.status).toBe(200);
      expect(response.body.data.map((row: { email: string }) => row.email)).toContain(user.email);
    });
  });

  describe('Escopo de condominio na escrita', () => {
    it('UT-SCOPE-06: o sindico nao altera usuario de condominio que nao administra', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.patch(`/users/${user.id}`).send({ name: 'Renomeado' });

      expect(response.status).toBe(404);
    });

    it('UT-SCOPE-07: o sindico nao remove usuario de condominio que nao administra', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.delete(`/users/${user.id}`);

      expect(response.status).toBe(404);
    });

    it('UT-SCOPE-08: o sindico nao redefine a senha de usuario fora do escopo', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.post(`/users/${user.id}/reset-password`).send({});

      expect(response.status).toBe(404);
    });

    it('UT-SCOPE-09: o sindico nao vincula o novo usuario a condominio alheio', async () => {
      const { condominium } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.post('/users').send({
        name: 'Funcionario Invasor',
        email: 'invasor@exemplo.com.br',
        roleId: await roleIdByName(ctx, ROLE_STAFF),
        condominiumIds: [condominium.id],
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Contas globais', () => {
    it('UT-SCOPE-10: o sindico le a conta global mas nao a altera', async () => {
      const response = await sindico.patch(`/users/${ctx.seed.users.admin.id}`).send({
        name: 'Mariana Alterada',
      });

      expect(response.status).toBe(403);
    });

    it('UT-SCOPE-11: o sindico nao remove a conta global', async () => {
      const response = await sindico.delete(`/users/${ctx.seed.users.admin.id}`);

      expect(response.status).toBe(403);
    });

    it('UT-SCOPE-12: o sindico nao redefine a senha da conta global', async () => {
      const response = await sindico
        .post(`/users/${ctx.seed.users.admin.id}/reset-password`)
        .send({});

      expect(response.status).toBe(403);
    });

    it('UT-SCOPE-13: o sindico nao promove usuario do escopo a conta global', async () => {
      const response = await sindico.patch(`/users/${ctx.seed.users.porteiro.id}`).send({
        condominiumIds: [],
      });

      expect(response.status).toBe(403);
    });

    it('UT-SCOPE-14: o sindico nao cria conta global', async () => {
      const response = await sindico.post('/users').send({
        name: 'Conta Sem Escopo',
        email: 'sem.escopo@exemplo.com.br',
        roleId: await roleIdByName(ctx, ROLE_STAFF),
      });

      expect(response.status).toBe(403);
    });

    it('UT-SCOPE-15: o administrador sem vinculo continua administranco a conta global', async () => {
      const response = await admin.patch(`/users/${ctx.seed.users.admin.id}`).send({
        phone: '(11) 97777-0000',
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Regras que ignoram o escopo do ator', () => {
    it('UT-SCOPE-16: e-mail de usuario fora do escopo continua ocupado', async () => {
      const { user } = await seedOutOfScopeCondominium(ctx);

      const response = await sindico.post('/users').send({
        name: 'Conflito de E-mail',
        email: user.email,
        roleId: await roleIdByName(ctx, ROLE_SINDICO),
        condominiumIds: [ctx.seed.condominiumId],
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('UT-SCOPE-17: o limite de usuarios do plano e contado no tenant inteiro', async () => {
      const { tenantId } = ctx.seed;
      const manager = AppDataSource.manager;

      const tenant = await manager.findOneByOrFail(Tenant, { id: tenantId });
      const previousMax = tenant.maxUsers;

      // Espreme o plano ate o numero exato de usuarios ja cadastrados. Contando
      // apenas o escopo do sindico sobraria folga e o cadastro passaria.
      const total = await manager
        .createQueryBuilder()
        .select('user')
        .from(User, 'user')
        .where('user.tenant_id = :tenantId', { tenantId })
        .andWhere('user.deleted_at IS NULL')
        .getCount();

      await manager.update(Tenant, { id: tenantId }, { maxUsers: total });

      try {
        const response = await sindico.post('/users').send({
          name: 'Usuario Acima do Plano',
          email: 'acima.plano@exemplo.com.br',
          roleId: await roleIdByName(ctx, ROLE_STAFF),
          condominiumIds: [ctx.seed.condominiumId],
        });

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
        expect(response.body.error.message).toContain('permite ate');
      } finally {
        await manager.update(Tenant, { id: tenantId }, { maxUsers: previousMax });
      }
    });
  });
});
