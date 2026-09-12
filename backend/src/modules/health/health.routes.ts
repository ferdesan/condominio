import { Router, type Request, type Response } from 'express';
import { AppDataSource } from '@/config/data-source';
import { env } from '@/config/env';
import { getRedis } from '@/config/redis';

export const healthRouter = Router();

const startedAt = Date.now();

/** Liveness: responde enquanto o processo estiver de pe. */
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) } });
});

/** Readiness: so responde 200 quando as dependencias criticas respondem. */
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  try {
    await AppDataSource.query('SELECT 1');
    checks.database = 'up';
  } catch {
    checks.database = 'down';
  }

  const redis = getRedis();
  checks.redis = redis ? (redis.status === 'ready' ? 'up' : 'degraded') : 'disabled';

  const healthy = checks.database === 'up';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ready' : 'unavailable',
      environment: env.NODE_ENV,
      version: process.env.npm_package_version ?? '1.0.0',
      checks,
    },
  });
});

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: env.APP_NAME,
      status: 'ok',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});
