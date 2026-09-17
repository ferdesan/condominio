import request from 'supertest';
import { login, type AuthenticatedAgent, type TestContext } from './test-context';

// ---------------------------------------------------------------------------
// Geradores de CPF/CNPJ com digitos verificadores validos (Receita Federal).
// O deslocamento aleatorio por processo evita colisoes entre arquivos de teste
// que rodam no mesmo worker.
// ---------------------------------------------------------------------------

function cpfCheckDigit(digits: string): number {
  const slice = digits.length;
  let sum = 0;
  for (let index = 0; index < slice; index += 1) {
    sum += Number(digits[index]) * (slice + 1 - index);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function validCpf(seed: number): string {
  const base = String(1_000_000 + seed).padStart(9, '0').slice(-9);
  const first = cpfCheckDigit(base);
  const second = cpfCheckDigit(`${base}${first}`);
  return `${base}${first}${second}`;
}

function cnpjCheckDigit(digits: string): number {
  const weights =
    digits.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    sum += Number(digits[index]) * weights[index];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function validCnpj(seed: number): string {
  const base = String(10_000_000_000 + seed).padStart(12, '0').slice(-12);
  const first = cnpjCheckDigit(base);
  const second = cnpjCheckDigit(`${base}${first}`);
  return `${base}${first}${second}`;
}

let cpfSeed = Math.floor(Math.random() * 90_000_000);
export function freshCpf(): string {
  cpfSeed += 7;
  return validCpf(cpfSeed % 90_000_000);
}

let cnpjSeed = Math.floor(Math.random() * 90_000_000_000);
export function freshCnpj(): string {
  cnpjSeed += 13;
  return validCnpj(cnpjSeed % 90_000_000_000);
}

// ---------------------------------------------------------------------------
// Tenant isolado: administradora + condominio + bloco + unidade proprios.
// ---------------------------------------------------------------------------

let tenantCounter = 0;

export type IsolatedTenant = {
  agent: AuthenticatedAgent;
  tenantId: string;
  condominiumId: string;
  unitId: string;
};

/**
 * Cadastra uma administradora nova (self-service), autentica o admin e monta o
 * cenario minimo (condominio, bloco e unidade) para os testes de isolamento.
 */
export async function registerIsolatedTenant(
  ctx: TestContext,
  label: string,
): Promise<IsolatedTenant> {
  tenantCounter += 1;
  const n = tenantCounter;
  const stamp = `${Date.now()}${n}`;
  const slug = `iso-${label}-${stamp}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const email = `iso.${label}.${stamp}@exemplo.com.br`;
  const document = validCnpj(Number(stamp.slice(-12)) % 90_000_000_000);

  const registered = await request(ctx.app).post(`${ctx.api}/auth/register`).send({
    tenantName: `Isolamento ${label} ${n}`,
    slug,
    adminName: `Admin ${label} ${n}`,
    email,
    password: 'Demo@1234',
    acceptedTerms: true,
    document,
  });

  expect(registered.status).toBe(201);
  expect(registered.body.data.tokens.accessToken).toBeTruthy();

  const agent = await login(ctx, email, 'Demo@1234', slug);
  const tenantId = registered.body.data.user.tenantId as string;

  const condominium = await agent.post('/condominiums').send({
    name: `Condominio ${label} ${n}`,
    type: 'RESIDENTIAL',
    chargeDueDay: 10,
  });
  expect(condominium.status).toBe(201);
  const condominiumId = condominium.body.data.id as string;

  const block = await agent.post('/blocks').send({
    condominiumId,
    name: 'Bloco Unico',
    type: 'BLOCK',
    floors: 1,
    unitsPerFloor: 1,
  });
  expect(block.status).toBe(201);

  const unit = await agent.post('/units').send({
    condominiumId,
    blockId: block.body.data.id,
    number: 'I-01',
    type: 'APARTMENT',
    status: 'VACANT',
  });
  expect(unit.status).toBe(201);

  return { agent, tenantId, condominiumId, unitId: unit.body.data.id as string };
}