import Redis from 'ioredis';
import { env, isTest } from './env';
import { logger } from './logger';

let client: Redis | null = null;
let disabledReason: string | null = null;

/**
 * Redis is optional: when it is unavailable (local dev, CI, tests) the
 * application degrades gracefully to in-process caching / memory rate limiting
 * instead of failing to boot.
 */
export function getRedis(): Redis | null {
  if (!env.REDIS_ENABLED || isTest) return null;
  if (client) return client;

  client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
  });

  client.on('error', (error: Error) => {
    if (disabledReason !== error.message) {
      disabledReason = error.message;
      logger.warn(`Redis unavailable, falling back to in-memory cache: ${error.message}`);
    }
  });

  client.on('connect', () => {
    disabledReason = null;
    logger.info('Redis connected');
  });

  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}
