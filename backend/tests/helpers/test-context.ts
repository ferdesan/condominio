import type { Application } from 'express';
import request from 'supertest';
import { AppDataSource } from '@/config/data-source';
import { env } from '@/config/env';
import { createApp } from '@/app';
import { runSeeds, type SeedResult } from '@/database/seeds/seed';

export type TestContext = {
  app: Application;
  seed: SeedResult;
  api: string;
};

let context: TestContext | null = null;

/**
 * Sobe o contexto compartilhado do arquivo de teste: banco em memoria,
 * schema sincronizado, base semeada e aplicacao Express real (sem sockets).
 */
export async function setupTestContext(): Promise<TestContext> {
  if (context) return context;

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const seed = await runSeeds();
  if (!seed) throw new Error('Seed de teste nao pode ser criado.');

  context = { app: createApp(), seed, api: env.API_PREFIX };
  return context;
}

export async function teardownTestContext(): Promise<void> {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  context = null;
}

export type AuthenticatedAgent = {
  token: string;
  userId: string;
  get: (path: string) => request.Test;
  post: (path: string) => request.Test;
  put: (path: string) => request.Test;
  patch: (path: string) => request.Test;
  delete: (path: string) => request.Test;
};

/** Autentica com as credenciais do seed e devolve um agente com o Bearer pronto. */
export async function login(
  ctx: TestContext,
  email: string,
  password = 'Demo@1234',
): Promise<AuthenticatedAgent> {
  const response = await request(ctx.app)
    .post(`${ctx.api}/auth/login`)
    .send({ email, password, tenantSlug: 'demo' });

  if (response.status !== 200) {
    throw new Error(`Login falhou para ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }

  const token = response.body.data.tokens.accessToken as string;
  const userId = response.body.data.user.id as string;
  const authorize = (test: request.Test) => test.set('Authorization', `Bearer ${token}`);

  return {
    token,
    userId,
    get: (path) => authorize(request(ctx.app).get(`${ctx.api}${path}`)),
    post: (path) => authorize(request(ctx.app).post(`${ctx.api}${path}`)),
    patch: (path) => authorize(request(ctx.app).patch(`${ctx.api}${path}`)),
    put: (path) => authorize(request(ctx.app).put(`${ctx.api}${path}`)),
    delete: (path) => authorize(request(ctx.app).delete(`${ctx.api}${path}`)),
  };
}

export const seedUsers = {
  admin: 'admin@horizonte.com.br',
  sindico: 'sindico@parqueflores.com.br',
  porteiro: 'portaria@parqueflores.com.br',
  morador: 'morador@parqueflores.com.br',
  superAdmin: 'super@condominio.app',
};
