import request from 'supertest';
import { AppDataSource } from '@/config/data-source';
import { env } from '@/config/env';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { User } from '@/modules/users/user.entity';
import { mailService } from '@/shared/mail/mail.service';
import { sha256 } from '@/shared/utils/crypto.util';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from '../helpers/test-context';

/**
 * Os dois lados do fluxo de auto-atendimento: pedir o link e usa-lo.
 *
 * Fora de producao a resposta de `forgot-password` traz o token em claro
 * (`auth.service.ts`), e e por ali que estes testes seguem o fluxo completo —
 * o mesmo caminho que o e-mail levaria o usuario. Consumir esse campo na tela
 * e proibido (ver `frontend/.../password-recovery.test.tsx`); aqui ele e a
 * ponte de teste, nao o contrato do cliente.
 */
describe('Recuperacao de senha', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext();
  });

  afterAll(teardownTestContext);

  afterEach(() => jest.restoreAllMocks());

  const forgot = (email: string) =>
    request(ctx.app).post(`${ctx.api}/auth/forgot-password`).send({ email });

  const reset = (token: string, password: string) =>
    request(ctx.app).post(`${ctx.api}/auth/reset-password`).send({ token, password });

  const tokenFrom = (response: request.Response): string => response.body.data.token as string;

  describe('pedido do link', () => {
    it('responde 202 com a mesma mensagem exista ou nao a conta', async () => {
      const [cadastrado, inexistente] = await Promise.all([
        forgot(seedUsers.admin),
        forgot('ninguem@exemplo.com'),
      ]);

      expect(cadastrado.status).toBe(202);
      expect(inexistente.status).toBe(202);
      expect(cadastrado.body.success).toBe(inexistente.body.success);
      expect(cadastrado.body.data.message).toBe(inexistente.body.data.message);
    });

    it('envia o e-mail com o link de redefinicao para a conta cadastrada', async () => {
      const send = jest.spyOn(mailService, 'sendPasswordResetEmail').mockResolvedValue(undefined);

      const response = await forgot(seedUsers.admin);

      expect(response.status).toBe(202);
      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0][0];
      expect(mail.to).toBe(seedUsers.admin);
      expect(mail.expiresMinutes).toBe(env.PASSWORD_RESET_TTL_MINUTES);
      expect(mail.resetUrl).toBe(
        `${env.FRONTEND_URL}/redefinir-senha?token=${encodeURIComponent(tokenFrom(response))}`,
      );
    });

    it('nao envia e-mail quando o endereco nao esta cadastrado', async () => {
      const send = jest.spyOn(mailService, 'sendPasswordResetEmail').mockResolvedValue(undefined);

      const response = await forgot('ninguem@exemplo.com');

      expect(response.status).toBe(202);
      expect(send).not.toHaveBeenCalled();
    });

    it('valida o formato do payload', async () => {
      const response = await request(ctx.app)
        .post(`${ctx.api}/auth/forgot-password`)
        .send({ email: 'nao-e-email' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('redefinicao com o token', () => {
    it('troca a senha, derruba a antiga e aceita a nova no login', async () => {
      const pedido = await forgot(seedUsers.sindico);
      const token = tokenFrom(pedido);

      const resposta = await reset(token, 'Nova@1234');
      expect(resposta.status).toBe(204);

      const antiga = await request(ctx.app)
        .post(`${ctx.api}/auth/login`)
        .send({ email: seedUsers.sindico, password: 'Demo@1234', tenantSlug: 'demo' });
      expect(antiga.status).toBe(401);

      const nova = await request(ctx.app)
        .post(`${ctx.api}/auth/login`)
        .send({ email: seedUsers.sindico, password: 'Nova@1234', tenantSlug: 'demo' });
      expect(nova.status).toBe(200);
    });

    it('recusa o mesmo token uma segunda vez', async () => {
      const pedido = await forgot(seedUsers.morador);
      const token = tokenFrom(pedido);

      expect((await reset(token, 'Nova@1234')).status).toBe(204);

      const repetido = await reset(token, 'Outra@1234');
      expect(repetido.status).toBe(400);
      expect(repetido.body.error.message).toBe('Token de recuperacao invalido ou expirado.');
    });

    it('invalida o token de um pedido anterior quando chega outro', async () => {
      const primeiro = tokenFrom(await forgot(seedUsers.porteiro));
      const segundo = tokenFrom(await forgot(seedUsers.porteiro));

      const obsoleto = await reset(primeiro, 'Nova@1234');
      expect(obsoleto.status).toBe(400);

      expect((await reset(segundo, 'Nova@1234')).status).toBe(204);
    });

    it('recusa token expirado', async () => {
      const user = await AppDataSource.getRepository(User).findOneByOrFail({
        email: seedUsers.admin,
      });
      const expirado = 'token-expirado-sempre-recusado-pelo-servidor';
      await new AuthRepository().createResetToken({
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: sha256(expirado),
        expiresAt: new Date(Date.now() - 60_000),
      });

      const response = await reset(expirado, 'Nova@1234');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Token de recuperacao invalido ou expirado.');
    });

    it('recusa token desconhecido', async () => {
      const response = await reset('nenhum-token-foi-emitido-para-este-caso', 'Nova@1234');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Token de recuperacao invalido ou expirado.');
    });

    it('valida a nova senha e o tamanho do token', async () => {
      const pedido = await forgot(seedUsers.admin);
      const token = tokenFrom(pedido);

      const fraca = await reset(token, 'fraca');
      expect(fraca.status).toBe(422);
      expect(fraca.body.error.code).toBe('VALIDATION_ERROR');

      const curto = await reset('curto', 'Nova@1234');
      expect(curto.status).toBe(422);

      // A recusa acima nao gastou o token: ele segue valido para a proxima tentativa.
      const ok = await reset(token, 'Nova@1234');
      expect(ok.status).toBe(204);
    });
  });

  describe('apos a troca', () => {
    it('a senha nova autentica e o perfil continua acessivel', async () => {
      const token = tokenFrom(await forgot(seedUsers.admin));
      expect((await reset(token, 'Trocada@123')).status).toBe(204);

      const agent = await login(ctx, seedUsers.admin, 'Trocada@123');

      const perfil = await agent.get('/auth/me');
      expect(perfil.status).toBe(200);
      expect(perfil.body.data.email).toBe(seedUsers.admin);
    });
  });
});
