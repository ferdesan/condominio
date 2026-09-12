import type { Request } from 'express';
import { UnauthorizedError } from '@/shared/errors';
import type { TenantScope } from '@/shared/repositories/types';
import type { AuthContext } from '@/shared/types/auth-context';

/**
 * Everything a service needs to know about "who is asking", decoupled from
 * Express so services stay framework agnostic and trivially testable.
 */
export type RequestContext = {
  scope: TenantScope;
  actor: AuthContext;
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function toTenantScope(auth: AuthContext): TenantScope {
  return {
    tenantId: auth.tenantId,
    condominiumIds: auth.condominiumIds,
    superAdmin: auth.isSuperAdmin,
  };
}

export function buildRequestContext(req: Request): RequestContext {
  if (!req.auth) throw new UnauthorizedError();
  return {
    scope: toTenantScope(req.auth),
    actor: req.auth,
    requestId: req.requestId,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}
