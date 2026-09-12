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
  APP_URL: z.string().default('http://localhost:3333'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USERNAME: z.string().default('condominio'),
  DB_PASSWORD: z.string().default('condominio'),
  DB_DATABASE: z.string().default('condominio'),
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
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  if (parsed.data.NODE_ENV === 'production') {
    const insecureDefaults = ['change-me-in-production-please-32-chars', 'change-me-refresh-in-production-32ch'];
    if (insecureDefaults.includes(parsed.data.JWT_SECRET) || insecureDefaults.includes(parsed.data.JWT_REFRESH_SECRET)) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be overridden in production.');
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
