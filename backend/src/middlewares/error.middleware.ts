import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { MulterError } from 'multer';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { ZodError } from 'zod';
import { logger } from '@/config/logger';
import { isProduction } from '@/config/env';
import { AppError, NotFoundError } from '@/shared/errors';
import { toValidationDetails } from './validate.middleware';

type NormalizedError = {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
};

const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_FK_CONSTRAINT = 'ER_ROW_IS_REFERENCED_2';
const SQLITE_CONSTRAINT = 'SQLITE_CONSTRAINT_UNIQUE';

/**
 * Translates any thrown value into a safe, predictable API error.
 * Database driver messages never reach the client — they leak schema details.
 */
function normalize(error: unknown): NormalizedError {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Falha na validacao dos dados enviados.',
      details: toValidationDetails(error),
    };
  }

  if (error instanceof MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo excede o tamanho maximo permitido.'
        : 'Falha no envio do arquivo.';
    return { statusCode: 400, code: `UPLOAD_${error.code}`, message };
  }

  if (error instanceof EntityNotFoundError) {
    return { statusCode: 404, code: 'NOT_FOUND', message: 'Recurso nao encontrado.' };
  }

  if (error instanceof QueryFailedError) {
    const driverCode = (error as QueryFailedError & { code?: string }).code;
    if (driverCode === MYSQL_DUPLICATE_ENTRY || driverCode?.startsWith(SQLITE_CONSTRAINT)) {
      return {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Ja existe um registro com estes dados.',
      };
    }
    if (driverCode === MYSQL_FK_CONSTRAINT) {
      return {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Registro possui vinculos e nao pode ser removido.',
      };
    }
    return { statusCode: 500, code: 'DATABASE_ERROR', message: 'Erro ao acessar os dados.' };
  }

  return { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno do servidor.' };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Rota ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const normalized = normalize(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: normalized.statusCode,
    userId: req.auth?.userId,
    tenantId: req.auth?.tenantId,
  };

  if (normalized.statusCode >= 500) {
    logger.error(`${normalized.code}: ${(error as Error)?.message ?? 'unknown'}`, {
      ...logPayload,
      stack,
    });
  } else {
    logger.warn(`${normalized.code}: ${normalized.message}`, logPayload);
  }

  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      ...(isProduction || normalized.statusCode < 500 ? {} : { stack }),
    },
  });
};
