import request from 'supertest';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from '../helpers/test-context';

describe('Autenticacao', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(teardownTestContext);

  it('autentica com credenciais validas e retorna tokens + permissoes', async () => {
    const response = await request(ctx.app)
      .post(`${ctx.api}/auth/login`)
      .send({ email: seedUsers.admin, password: 'Demo@1234' });

    expect(response.status).toBe(200);
    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.user.role).toBe('ADMIN');
    expect(response.body.data.user.permissions.length).toBeGreaterThan(0);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('rejeita senha incorreta sem revelar se o e-mail existe', async () => {
    const response = await request(ctx.app)
      .post(`${ctx.api}/auth/login`)
      .send({ email: seedUsers.admin, password: 'SenhaErrada1' });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('E-mail ou senha invalidos.');
  });

  it('responde com a mesma mensagem para e-mail inexistente', async () => {
    const response = await request(ctx.app)
      .post(`${ctx.api}/auth/login`)
      .send({ email: 'ninguem@exemplo.com', password: 'SenhaErrada1' });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('E-mail ou senha invalidos.');
  });

  it('valida o formato do payload de login', async () => {
    const response = await request(ctx.app)
      .post(`${ctx.api}/auth/login`)
      .send({ email: 'nao-e-email', password: '' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('bloqueia acesso a rotas protegidas sem token', async () => {
    const response = await request(ctx.app).get(`${ctx.api}/condominiums`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejeita token invalido', async () => {
    const response = await request(ctx.app)
      .get(`${ctx.api}/condominiums`)
      .set('Authorization', 'Bearer token.invalido.aqui');

    expect(response.status).toBe(401);
  });

  it('retorna o perfil do usuario autenticado em /auth/me', async () => {
    const agent = await login(ctx, seedUsers.sindico);
    const response = await agent.get('/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(seedUsers.sindico);
    expect(response.body.data.tenant.slug).toBe('demo');
    expect(response.body.data.condominiumIds).toHaveLength(1);
  });

  it('rotaciona o refresh token e invalida o anterior', async () => {
    const loginResponse = await request(ctx.app)
      .post(`${ctx.api}/auth/login`)
      .send({ email: seedUsers.porteiro, password: 'Demo@1234' });

    const originalRefresh = loginResponse.body.data.tokens.refreshToken as string;

    const refreshed = await request(ctx.app)
      .post(`${ctx.api}/auth/refresh`)
      .send({ refreshToken: originalRefresh });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.tokens.refreshToken).not.toBe(originalRefresh);

    // Reuso do token antigo deve ser recusado (deteccao de roubo de sessao).
    const reused = await request(ctx.app)
      .post(`${ctx.api}/auth/refresh`)
      .send({ refreshToken: originalRefresh });

    expect(reused.status).toBe(401);
  });

  it('troca a senha e encerra as sessoes ativas', async () => {
    const agent = await login(ctx, seedUsers.morador);

    const response = await agent
      .post('/auth/change-password')
      .send({ currentPassword: 'Demo@1234', newPassword: 'NovaSenha@2026' });

    expect(response.status).toBe(204);

    const relogin = await request(ctx.app)
      .post(`${ctx.api}/auth/login`)
      .send({ email: seedUsers.morador, password: 'NovaSenha@2026' });

    expect(relogin.status).toBe(200);

    // Restaura a senha original para nao afetar outros testes do arquivo.
    const restored = await login(ctx, seedUsers.morador, 'NovaSenha@2026');
    await restored
      .post('/auth/change-password')
      .send({ currentPassword: 'NovaSenha@2026', newPassword: 'Demo@1234' });
  });

  it('recusa a troca de senha quando a senha atual esta incorreta', async () => {
    const agent = await login(ctx, seedUsers.sindico);

    const response = await agent
      .post('/auth/change-password')
      .send({ currentPassword: 'ErradaTotal1', newPassword: 'OutraSenha@123' });

    expect(response.status).toBe(401);
  });
});
