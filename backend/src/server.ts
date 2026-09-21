import 'reflect-metadata';
import http from 'node:http';
import { app } from './app';
import { closeDatabase, initializeDatabase } from './config/data-source';
import { env } from './config/env';
import { logger } from './config/logger';
import { closeRedis, getRedis } from './config/redis';
import { startScheduledJobs, stopScheduledJobs } from './jobs';
import { initSocketServer } from './realtime/socket-server';

async function bootstrap(): Promise<void> {
  await initializeDatabase();
  getRedis();

  const server = http.createServer(app);
  const io = initSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(`${env.APP_NAME} running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`API:     ${env.API_URL}${env.API_PREFIX}`);
    if (env.SWAGGER_ENABLED) logger.info(`Swagger: ${env.API_URL}${env.API_PREFIX}/docs`);
  });

  startScheduledJobs();

  /** Encerramento gracioso: para de aceitar conexoes e fecha os recursos. */
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down gracefully...`);

    stopScheduledJobs();
    io.close();

    server.close(async () => {
      await closeDatabase();
      await closeRedis();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Rede de seguranca: nao deixa conexoes penduradas travarem o deploy.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${String(reason)}`);
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error(`Uncaught exception: ${error.message}`, { stack: error.stack });
    process.exit(1);
  });
}

bootstrap().catch((error: Error) => {
  logger.error(`Failed to start server: ${error.message}`, { stack: error.stack });
  process.exit(1);
});
