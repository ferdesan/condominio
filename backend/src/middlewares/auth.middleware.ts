import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { authContextService } from '@/modules/auth/auth-context.service';
import { tokenService } from '@/modules/auth/token.service';
import { auditService } from '@/modules/audit/audit.service';
import { hasPermission, type Permission } from '@/shared/constants/permissions';
import { ForbiddenError, UnauthorizedError } from '@/shared/errors';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  // Socket.IO handshakes and file downloads may carry the token in a cookie.
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.access_token;
  return cookieToken ?? null;
}

/** Requires a valid access token and materialises `req.auth`. */
export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new UnauthorizedError('Token de acesso nao informado.');

    const payload = tokenService.verifyAccessToken(token);
    req.auth = await authContextService.resolve(payload.tid, payload.sub, payload.sid);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization guard. Accepts a single permission or a list (OR semantics).
 * Denials are written to the audit trail — they are a security signal.
 */
export function authorize(...required: Permission[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) {
      next(new UnauthorizedError());
      return;
    }

    const allowed = required.some((permission) => hasPermission(auth.permissions, permission));
    if (allowed) {
      next();
      return;
    }

    void auditService.record({
      tenantId: auth.tenantId,
      action: 'PERMISSION_DENIED',
      resource: required[0]?.split(':')[0] ?? 'unknown',
      description: `Acesso negado: ${required.join(', ')}`,
      actor: auth,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    next(new ForbiddenError('Voce nao possui permissao para executar esta acao.'));
  };
}

/** Restricted to platform operators (cross-tenant administration). */
export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new UnauthorizedError());
    return;
  }
  if (!req.auth.isSuperAdmin) {
    next(new ForbiddenError('Recurso restrito a operadores da plataforma.'));
    return;
  }
  next();
};
