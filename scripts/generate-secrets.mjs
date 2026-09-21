#!/usr/bin/env node
/**
 * Gera ou rotaciona os secrets de um arquivo .env.
 *
 * Sao dois alvos, porque sao dois jeitos de rodar o projeto:
 *
 *   npm run secrets           .env da raiz      stack em container
 *   npm run secrets:backend   backend/.env      API fora do container
 *
 * Nenhum dos dois `.env.example` guarda secret que funcione: o que eles trazem
 * sao as chaves vazias, e quem as preenche e este script. Assim o repositorio
 * nunca carrega um segredo que assina token de verdade.
 *
 * Sem o arquivo, ele e criado a partir do template. Com o arquivo e `--force`,
 * os secrets sao trocados **no lugar**: todo o resto da linha por linha
 * permanece, porque um .env em uso guarda escolha de quem o escreveu — host do
 * banco, porta, nivel de log — e sobrescrever com o template apagaria tudo.
 *
 *   --backend   opera sobre backend/.env (o padrao e o .env da raiz)
 *   --force     troca os secrets de um arquivo que ja existe
 *   --print     imprime um conjunto novo, sem escrever em lugar nenhum
 */
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Sem $ # ' " \ e afins: o valor atravessa dotenv, a interpolacao do docker
// compose e a linha de comando do mysql sem precisar de aspas nem de escape.
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const token = (bytes) => randomBytes(bytes).toString('base64url');
const password = (length) =>
  Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');

const GENERATORS = {
  JWT_SECRET: () => token(48),
  JWT_REFRESH_SECRET: () => token(48),
  DB_PASSWORD: () => password(32),
  DB_ROOT_PASSWORD: () => password(32),
};

const TARGETS = {
  root: {
    template: '.env.example',
    file: '.env',
    // O compose cria o MySQL a partir deste mesmo arquivo, entao sortear a
    // senha do banco aqui e o certo: nao ha instancia previa a contrariar.
    keys: ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_PASSWORD', 'DB_ROOT_PASSWORD'],
  },
  backend: {
    template: 'backend/.env.example',
    file: 'backend/.env',
    // `DB_PASSWORD` fica de fora de proposito: fora do container o MySQL ja
    // existe e a senha e a dele. Sortear uma aqui so quebraria a conexao.
    keys: ['JWT_SECRET', 'JWT_REFRESH_SECRET'],
  },
};

function fail(message) {
  console.error(`erro: ${message}`);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const conhecidas = ['--backend', '--force', '--print'];
const desconhecidas = [...args].filter((arg) => !conhecidas.includes(arg));
if (desconhecidas.length > 0) {
  fail(`opcao desconhecida: ${desconhecidas.join(', ')}. Use ${conhecidas.join(', ')}.`);
}

const target = args.has('--backend') ? TARGETS.backend : TARGETS.root;
const templatePath = join(ROOT, target.template);
const filePath = join(ROOT, target.file);

const secrets = Object.fromEntries(target.keys.map((key) => [key, GENERATORS[key]()]));

if (args.has('--print')) {
  // Conjunto novo em folha — nao le nem escreve arquivo. Serve para colar num
  // gerenciador de secrets ou nas variaveis do CI.
  for (const [key, value] of Object.entries(secrets)) console.log(`${key}=${value}`);
  process.exit(0);
}

const existe = existsSync(filePath);

if (existe && !args.has('--force')) {
  fail(
    `${target.file} ja existe. Use --force para trocar os secrets — isso invalida\n` +
      '       as sessoes ativas, e quem estiver logado precisa entrar de novo.'
  );
}

const origem = existe ? filePath : templatePath;
if (!existsSync(origem)) fail(`${relative(ROOT, origem)} nao encontrado`);

const conteudo = readFileSync(origem, 'utf8');
const ausentes = target.keys.filter((key) => !new RegExp(`^${key}=`, 'm').test(conteudo));
if (ausentes.length > 0) {
  fail(`chave ausente em ${relative(ROOT, origem)}: ${ausentes.join(', ')}`);
}

// Preserva a quebra de linha do arquivo: no Windows ele costuma estar em CRLF,
// e trocar isso encheria o editor de diferenca que nao e do secret.
const quebra = conteudo.includes('\r\n') ? '\r\n' : '\n';
const resultado = conteudo
  .split(/\r?\n/)
  .map((linha) => {
    const key = /^([A-Z0-9_]+)=/.exec(linha)?.[1];
    return key && key in secrets ? `${key}=${secrets[key]}` : linha;
  })
  .join(quebra);

writeFileSync(filePath, resultado, { encoding: 'utf8', mode: 0o600 });

console.log(`${target.file} ${existe ? 'rotacionado' : 'criado'}:`);
for (const [key, value] of Object.entries(secrets)) {
  console.log(`  ${key.padEnd(20)} ${value.length} caracteres`);
}
console.log(
  existe
    ? '\nO resto do arquivo ficou como estava. Reinicie a API: o segredo antigo\nnao valida mais os tokens que ele proprio assinou.'
    : '\nOs valores ficam so no arquivo, que e gitignored. O resto veio do template.'
);
