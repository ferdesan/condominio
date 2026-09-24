import request from 'supertest';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('Dashboard executivo e administracao de acessos', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
  });

  afterAll(teardownTestContext);

  describe('dashboard', () => {
    it('consolida os indicadores do condominio', async () => {
      const response = await admin.get(
        `/dashboard/overview?condominiumId=${ctx.seed.condominiumId}`,
      );

      expect(response.status).toBe(200);
      const data = response.body.data;

      expect(data.condominium.name).toBe('Residencial Parque das Flores');
      expect(data.units.total).toBe(ctx.seed.unitIds.length);
      expect(data.units.occupied + data.units.vacant).toBe(data.units.total);
      expect(data.units.occupancyRate).toBeGreaterThan(0);
      expect(data.people.residents).toBeGreaterThan(0);
      expect(data.finance).toHaveProperty('delinquencyRate');
      expect(data.operations).toHaveProperty('openIncidents');
    });

    it('retorna a serie financeira dos ultimos meses', async () => {
      const response = await admin.get(
        `/dashboard/financial-series?condominiumId=${ctx.seed.condominiumId}&months=6`,
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(6);
      expect(response.body.data[0]).toHaveProperty('billed');
      expect(response.body.data[0]).toHaveProperty('received');
      expect(response.body.data.some((item: { billed: number }) => item.billed > 0)).toBe(true);
    });

    it('agrupa despesas por categoria com nome resolvido', async () => {
      const response = await admin.get(
        `/dashboard/expenses-by-category?condominiumId=${ctx.seed.condominiumId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].name).toBeTruthy();
    });

    it('exige o condominio na consulta do dashboard', async () => {
      const response = await admin.get('/dashboard/overview');

      expect(response.status).toBe(422);
    });

    it('nega dashboard de condominio fora do escopo do usuario', async () => {
      const outOfScope = await admin.post('/condominiums').send({ name: 'Condominio Fora do Escopo' });
      const sindico = await login(ctx, seedUsers.sindico);

      const response = await sindico.get(
        `/dashboard/overview?condominiumId=${outOfScope.body.data.id}`,
      );

      expect(response.status).toBe(403);
    });

    it('lista a atividade recente da administradora', async () => {
      const response = await admin.get('/dashboard/recent-activity');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('action');
    });
  });

  describe('usuarios e papeis', () => {
    let createdUserId: string;

    it('convida usuario gerando senha temporaria', async () => {
      const roles = await admin.get('/roles?search=STAFF');
      const staffRole = roles.body.data.find((role: { name: string }) => role.name === 'STAFF');

      const response = await admin.post('/users').send({
        name: 'Novo Porteiro',
        email: 'novo.porteiro@parqueflores.com.br',
        roleId: staffRole.id,
        condominiumIds: [ctx.seed.condominiumId],
      });

      expect(response.status).toBe(201);
      expect(response.body.data.temporaryPassword).toEqual(expect.any(String));
      expect(response.body.data.mustChangePassword).toBe(true);

      createdUserId = response.body.data.id;

      const loginResponse = await request(ctx.app).post(`${ctx.api}/auth/login`).send({
        email: 'novo.porteiro@parqueflores.com.br',
        password: response.body.data.temporaryPassword,
      });
      expect(loginResponse.status).toBe(200);
    });

    it('recusa e-mail duplicado no mesmo tenant', async () => {
      const roles = await admin.get('/roles?search=STAFF');
      const staffRole = roles.body.data.find((role: { name: string }) => role.name === 'STAFF');

      const response = await admin.post('/users').send({
        name: 'Duplicado',
        email: 'novo.porteiro@parqueflores.com.br',
        roleId: staffRole.id,
      });

      expect(response.status).toBe(409);
    });

    it('reseta a senha invalidando as sessoes ativas', async () => {
      const response = await admin.post(`/users/${createdUserId}/reset-password`).send({});

      expect(response.status).toBe(200);
      expect(response.body.data.temporaryPassword).toEqual(expect.any(String));
    });

    it('impede o usuario de remover a si mesmo', async () => {
      const me = await admin.get('/auth/me');
      const response = await admin.delete(`/users/${me.body.data.id}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/proprio usuario/i);
    });

    it('impede desativar a ultima conta administradora', async () => {
      const me = await admin.get('/auth/me');
      const response = await admin.patch(`/users/${me.body.data.id}`).send({ status: 'INACTIVE' });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/administradora ativa/i);
    });

    it('cria papel personalizado e aplica as permissoes na hora', async () => {
      const created = await admin.post('/roles').send({
        name: 'Conselho Fiscal',
        description: 'Acesso somente leitura ao financeiro.',
        permissions: ['charge:read', 'expense:read', 'dashboard:read', 'condominium:read'],
      });

      expect(created.status).toBe(201);
      expect(created.body.data.name).toBe('CONSELHO FISCAL');
      expect(created.body.data.isSystem).toBe(false);

      const invited = await admin.post('/users').send({
        name: 'Membro do Conselho',
        email: 'conselho@parqueflores.com.br',
        roleId: created.body.data.id,
        condominiumIds: [ctx.seed.condominiumId],
      });

      const agent = await login(
        ctx,
        'conselho@parqueflores.com.br',
        invited.body.data.temporaryPassword,
      );

      expect((await agent.get('/financial/charges')).status).toBe(200);
      expect((await agent.post('/financial/charges').send({})).status).toBe(403);
    });

    it('troca o papel de um usuario ja cadastrado e persiste a mudanca', async () => {
      const customRole = await admin.post('/roles').send({
        name: 'Apoio Administrativo',
        description: 'Papel personalizado usado na troca de perfil.',
        permissions: ['dashboard:read', 'condominium:read'],
      });
      expect(customRole.status).toBe(201);

      const patched = await admin.patch(`/users/${createdUserId}`).send({
        roleId: customRole.body.data.id,
      });

      expect(patched.status).toBe(200);
      expect(patched.body.data.roleId).toBe(customRole.body.data.id);

      const fetched = await admin.get(`/users/${createdUserId}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.data.roleId).toBe(customRole.body.data.id);
      expect(fetched.body.data.role.id).toBe(customRole.body.data.id);
    });

    it('sessao ativa enxerga a troca de papel e o admin nao perde acesso a listagem', async () => {
      const fullRole = await admin.post('/roles').send({
        name: 'Cadastro Completo',
        permissions: ['user:read', 'user:update', 'dashboard:read'],
      });
      const limitedRole = await admin.post('/roles').send({
        name: 'Somente Painel',
        permissions: ['dashboard:read'],
      });
      expect(fullRole.status).toBe(201);
      expect(limitedRole.status).toBe(201);

      const invited = await admin.post('/users').send({
        name: 'Ana Cadastro',
        email: 'ana.cadastro@parqueflores.com.br',
        roleId: fullRole.body.data.id,
        condominiumIds: [ctx.seed.condominiumId],
      });
      expect(invited.status).toBe(201);

      const agent = await login(
        ctx,
        'ana.cadastro@parqueflores.com.br',
        invited.body.data.temporaryPassword,
      );
      expect((await agent.get('/users')).status).toBe(200);

      const denied = await admin.patch(`/users/${invited.body.data.id}`).send({
        roleId: limitedRole.body.data.id,
      });
      expect(denied.status).toBe(200);
      expect(denied.body.data.roleId).toBe(limitedRole.body.data.id);

      // A sessao aberta antes da troca usa o cache de autorizacao: a
      // invalidacao do afterUpdate tem que fazer a mudanca valer na hora.
      const blocked = await agent.get('/users');
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.message).toBe('Voce nao possui permissao para executar esta acao.');

      // Quem fez a troca continua com o proprio papel.
      expect((await admin.get('/users')).status).toBe(200);

      // Devolvendo a permissao, a mesma sessao volta a enxergar a listagem.
      const restored = await admin.patch(`/users/${invited.body.data.id}`).send({
        roleId: fullRole.body.data.id,
      });
      expect(restored.status).toBe(200);
      expect((await agent.get('/users')).status).toBe(200);
    });

    it('nao permite alterar permissoes de papel do sistema', async () => {
      const roles = await admin.get('/roles?search=SINDICO');
      const sindicoRole = roles.body.data.find((role: { name: string }) => role.name === 'SINDICO');

      const response = await admin
        .patch(`/roles/${sindicoRole.id}`)
        .send({ permissions: ['charge:read'] });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/papeis do sistema/i);
    });

    it('nao permite conceder a permissao total para tenants comuns', async () => {
      const response = await admin.post('/roles').send({
        name: 'Deus',
        permissions: ['*'],
      });

      expect(response.status).toBe(409);
    });

    it('expoe o catalogo de permissoes para a tela de papeis', async () => {
      const response = await admin.get('/roles/permissions');

      expect(response.status).toBe(200);
      expect(response.body.data.permissions).toContain('unit:read');
      expect(response.body.data.permissions.length).toBeGreaterThan(50);
    });
  });

  describe('documentacao e saude', () => {
    it('publica o contrato OpenAPI', async () => {
      const response = await request(ctx.app).get(`${ctx.api}/docs.json`);

      expect(response.status).toBe(200);
      expect(response.body.openapi).toBe('3.0.3');
      expect(Object.keys(response.body.paths).length).toBeGreaterThan(50);
      expect(response.body.paths['/auth/login']).toBeDefined();
    });

    it('responde ao readiness com o status das dependencias', async () => {
      const response = await request(ctx.app).get(`${ctx.api}/health/ready`);

      expect(response.status).toBe(200);
      expect(response.body.data.checks.database).toBe('up');
    });

    it('retorna 404 padronizado para rota inexistente', async () => {
      const response = await admin.get('/rota-que-nao-existe');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.requestId).toBeTruthy();
    });

    it('exige autenticacao antes de revelar se uma rota existe', async () => {
      const response = await request(ctx.app).get(`${ctx.api}/rota-que-nao-existe`);

      expect(response.status).toBe(401);
    });
  });
});
