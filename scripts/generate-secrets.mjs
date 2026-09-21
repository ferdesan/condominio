#!/usr/bin/env node
/**
 * Gera um .env com secrets aleatorios a partir do .env.example.
 *
 * O .env.example nao guarda valor de secret nenhum: o que ele traz sao as
 * chaves vazias, e quem as preenche e este script. Assim o repositorio nunca
 * carrega uma senha que funcione, e cada maquina roda com as suas.
 *
 *   node scripts/generate-secrets.mjs           cria o .env (falha se ja existir)
 *   node scripts/generate-secrets.mjs --force   sobrescreve o .env existente
 *   node scripts/generate-secrets.mjs --print   imprime um conjunto novo, sem escrever
 */
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, '.env.example');
const TARGET = join(ROOT, '.env');

// Sem $ # ' " \ e afins: o valor atravessa dotenv, a interpolacao do docker
// compose e a linha de comando do mysql sem precisar de aspas nem de escape.
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const token = (bytes) => randomBytes(bytes).toString('base64url');
const password = (length) =>
  Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');

// O que nao estiver aqui vem do template intacto.
const GENERATORS = {
  JWT_SECRET: () => token(48),
  JWT_REFRESH_SECRET: () => token(48),
  DB_PASSWORD: () => password(32),
  DB_ROOT_PASSWORD: () => password(32),
};

function fail(message) {
  console.error(`erro: ${message}`);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => !['--force', '--print'].includes(arg));
if (unknown.length > 0) fail(`opcao desconhecida: ${unknown.join(', ')}`);

const secrets = Object.fromEntries(
  Object.entries(GENERATORS).map(([key, generate]) => [key, generate()])
);

if (args.has('--print')) {
  // Conjunto novo em folha — nao le o .env. Serve para colar num gerenciador
  // de secrets ou nas variaveis do CI.
  for (const [key, value] of Object.entries(secrets)) console.log(`${key}=${value}`);
  process.exit(0);
}

if (!existsSync(TEMPLATE)) fail(`.env.example nao encontrado em ${TEMPLATE}`);

if (existsSync(TARGET) && !args.has('--force')) {
  fail(
    '.env ja existe. Use --force para sobrescrever — isso troca a senha do banco,\n' +
      '       que os volumes do MySQL ja criados nao aceitam, e invalida as sessoes ativas.'
  );
}

const template = readFileSync(TEMPLATE, 'utf8');
const missing = Object.keys(secrets).filter((key) => !new RegExp(`^${key}=`, 'm').test(template));
if (missing.length > 0) fail(`chave ausente no .env.example: ${missing.join(', ')}`);

const filled = template
  .split(/\r?\n/)
  .map((line) => {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    return key && key in secrets ? `${key}=${secrets[key]}` : line;
  })
  .join('\n');

writeFileSync(TARGET, filled, { encoding: 'utf8', mode: 0o600 });

console.log(`${relative(ROOT, TARGET)} criado com secrets novos:`);
for (const [key, value] of Object.entries(secrets)) {
  console.log(`  ${key.padEnd(20)} ${value.length} caracteres`);
}
console.log('\nOs valores ficam so no arquivo, que e gitignored. O resto veio do .env.example.');
