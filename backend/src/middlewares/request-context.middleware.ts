import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '@/config/logger';

/** Correlates logs, audit records and client error reports. */
export const requestId: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

/** Structured access log with duration; noisy health checks are skipped. */
export const httpLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (req.path.endsWith('/health') || req.path.endsWith('/health/live')) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const payload = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      tenantId: req.auth?.tenantId,
      userId: req.auth?.userId,
    };

    if (res.statusCode >= 500) logger.error('request.failed', payload);
    else if (res.statusCode >= 400) logger.warn('request.rejected', payload);
    else logger.http('request.completed', payload);
  });

  next();
};
