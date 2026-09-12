import path from 'node:path';
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { env, isProduction, isTest } from './env';
import { logger } from './logger';

const rootDir = path.resolve(__dirname, '..');
const entities = [path.join(rootDir, 'modules', '**', '*.entity.{ts,js}')];
const migrations = [path.join(rootDir, 'database', 'migrations', '*.{ts,js}')];

/**
 * Tests run against an in-memory SQLite (sql.js, sem binario nativo) para
 * exercitar o caminho completo HTTP -> service -> repository -> banco sem
 * depender de infraestrutura externa.
 * Entity column types are intentionally kept portable (varchar/decimal/simple-json).
 */
const testOptions: DataSourceOptions = {
  type: 'sqljs',
  autoSave: false,
  entities,
  synchronize: true,
  dropSchema: true,
  logging: false,
};

const mysqlOptions: DataSourceOptions = {
  type: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  entities,
  migrations,
  migrationsTableName: 'typeorm_migrations',
  synchronize: env.DB_SYNCHRONIZE && !isProduction,
  logging: env.DB_LOGGING ? ['query', 'error', 'warn'] : ['error'],
  extra: {
    connectionLimit: env.DB_POOL_SIZE,
    charset: 'utf8mb4_unicode_ci',
  },
};

export const dataSourceOptions: DataSourceOptions = isTest ? testOptions : mysqlOptions;

export const AppDataSource = new DataSource(dataSourceOptions);

export async function initializeDatabase(): Promise<DataSource> {
  if (AppDataSource.isInitialized) return AppDataSource;
  await AppDataSource.initialize();
  logger.info(`Database connected (${dataSourceOptions.type})`);
  return AppDataSource;
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info('Database connection closed');
  }
}
