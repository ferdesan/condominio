import 'reflect-metadata';
import { closeDatabase, initializeDatabase } from '@/config/data-source';
import { logger } from '@/config/logger';
import { runSeeds } from './seed';

/** CLI: `npm run seed`. Seguro para rodar varias vezes (idempotente). */
async function main(): Promise<void> {
  await initializeDatabase();

  const result = await runSeeds();

  if (result?.users?.admin) {
    logger.info('--------------------------------------------------');
    logger.info('Credenciais de demonstracao (senha unica: Demo@1234)');
    Object.entries(result.users).forEach(([label, user]) => {
      logger.info(`  ${label.padEnd(11)} ${user.email}`);
    });
    logger.info('--------------------------------------------------');
  }

  await closeDatabase();
}

main().catch(async (error: Error) => {
  logger.error(`Seed failed: ${error.message}`, { stack: error.stack });
  await closeDatabase();
  process.exit(1);
});
