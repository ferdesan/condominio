import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : value.toLowerCase() === 'true'));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('Condominio SaaS'),
  API_URL: z.string().default('http://localhost:3333'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('condominio'),
  DB_PASSWORD: z.string().default('condominio'),
  DB_NAME: z.string().default('condominio'),
  DB_LOGGING: booleanFromString.default(false),
  DB_SYNCHRONIZE: booleanFromString.default(false),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_ENABLED: booleanFromString.default(true),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  // Auth
  JWT_SECRET: z.string().min(16).default('change-me-in-production-please-32-chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16).default('change-me-refresh-in-production-32ch'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  // E-mail (SMTP). Sem SMTP_HOST o mailer cai para console: em desenvolvimento
  // imprime o link, em producao so registra o erro — nunca o token.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromString.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@example.com'),

  /**
   * Base publica do front, de onde sai o link de redefinicao de senha. E a URL
   * que o navegador do usuario abre, nao a da API — por isso tem variavel
   * propria em vez de reaproveitar `API_URL`. Valor vazio vira o default: o
   * compose exporta a chave mesmo quando o `.env` nao a define.
   */
  FRONTEND_URL: z
    .string()
    .default('')
    .transform((value) => value.trim() || 'http://localhost:5173')
    .pipe(z.string().url()),

  // Security
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  TRUST_PROXY: booleanFromString.default(false),

  // Uploads
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().positive().default(10),

  // Observability
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  SWAGGER_ENABLED: booleanFromString.default(true),

  /**
   * Permite o bootstrap de producao rodar o seed de demo. Default `false` de
   * proposito: o seed cria super-admin com senha publica e nunca pode entrar
   * sozinho num deploy. Semente real e comando manual.
   */
  SEED_ON_BOOT: booleanFromString.default(false),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Nomes antigos, que o docker-compose e o `.env` da raiz nunca usaram.
 *
 * O backend lia `DB_USERNAME`/`DB_DATABASE` enquanto o compose exportava
 * `DB_USER`/`DB_NAME`: as duas variaveis chegavam ao container e nenhuma era
 * lida, entao a API caia nos defaults do schema sem reclamar. Renomear resolve
 * a divergencia, mas deixa um `.env` antigo com a mesma falha silenciosa — por
 * isso o nome velho agora e um erro, e nao um valor ignorado.
 */
const RENAMED_ENV_VARS: Record<string, string> = {
  DB_USERNAME: 'DB_USER',
  DB_DATABASE: 'DB_NAME',
  APP_URL: 'API_URL',
};

function loadEnv(): Env {
  const renamed = Object.entries(RENAMED_ENV_VARS).filter(([old]) => process.env[old]);
  if (renamed.length > 0) {
    const lines = renamed.map(([old, current]) => `  - ${old} virou ${current}`).join('\n');
    throw new Error(`Variaveis de ambiente renomeadas — atualize o seu .env:\n${lines}`);
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  if (parsed.data.NODE_ENV === 'production') {
    const insecureDefaults = [
      'change-me-in-production-please-32-chars',
      'change-me-refresh-in-production-32ch',
      // Valores que circularam no .env.example e no docker-compose antes de
      // `npm run secrets` existir, e que ainda estao em .env antigos por ai.
      // O primeiro tem 14 caracteres e ja morre no min(16) acima; esta na
      // lista para o dia em que alguem afrouxar o tamanho minimo.
      'supersecretkey',
      'refreshsecretkey',
    ];
    if (insecureDefaults.includes(parsed.data.JWT_SECRET) || insecureDefaults.includes(parsed.data.JWT_REFRESH_SECRET)) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be overridden in production.');
    }

    // Link de recuperacao de senha sai apontando para este endereco: se ficar
    // no default local, todo e-mail de producao leva o usuario para localhost.
    if (parsed.data.FRONTEND_URL.startsWith('http://localhost')) {
      throw new Error('FRONTEND_URL must be overridden in production.');
    }
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
