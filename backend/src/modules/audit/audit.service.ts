import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/logger';
import type { AuthContext } from '@/shared/types/auth-context';
import type { Paginated, QueryOptions } from '@/shared/types/pagination';
import type { TenantScope } from '@/shared/repositories/types';
import { AuditLog, type AuditAction } from './audit-log.entity';
import { auditRepository, type AuditRepository } from './audit.repository';

/** Never persisted in the audit trail, even if present in the payload. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'passwordConfirmation',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'cardNumber',
  'cvv',
]);

export type AuditInput = {
  tenantId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  description?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actor?: Pick<AuthContext, 'userId' | 'name'> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export function maskSensitive(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!payload) return null;
  return Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (SENSITIVE_KEYS.has(key)) {
      acc[key] = '***';
    } else if (value instanceof Date) {
      acc[key] = value.toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      acc[key] = maskSensitive(value as Record<string, unknown>);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}

/**
 * Keeps only the properties that actually changed, so the trail stays readable
 * and small even for wide entities.
 */
export function diffChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  if (!before || !after) return null;
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of Object.keys(after)) {
    if (['updatedAt', 'createdAt', 'deletedAt'].includes(key)) continue;
    const previous = before[key];
    const next = after[key];
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      changedBefore[key] = previous ?? null;
      changedAfter[key] = next ?? null;
    }
  }

  if (!Object.keys(changedAfter).length) return null;
  return { before: changedBefore, after: changedAfter };
}

export class AuditService {
  constructor(private readonly repository: AuditRepository = auditRepository) {}

  /**
   * Fire-and-forget by design: an audit failure must never break the business
   * operation, but it is always logged so the gap is visible in observability.
   */
  async record(input: AuditInput): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) return;

      const changes =
        input.before || input.after
          ? {
              before: maskSensitive(input.before),
              after: maskSensitive(input.after),
            }
          : null;

      const entry = AppDataSource.getRepository(AuditLog).create({
        tenantId: input.tenantId,
        userId: input.actor?.userId ?? null,
        userName: input.actor?.name ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        description: input.description?.slice(0, 255) ?? null,
        changes,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
        requestId: input.requestId ?? null,
      });

      await AppDataSource.getRepository(AuditLog).save(entry);
    } catch (error) {
      logger.error(`Failed to persist audit log: ${(error as Error).message}`, {
        resource: input.resource,
        action: input.action,
      });
    }
  }

  async list(scope: TenantScope, options: QueryOptions): Promise<Paginated<AuditLog>> {
    return this.repository.findMany(scope, options);
  }

  async listByResource(
    scope: TenantScope,
    resource: string,
    resourceId: string,
  ): Promise<AuditLog[]> {
    return this.repository.findAllBy(scope, { resource, resourceId }, 100);
  }
}

export const auditService = new AuditService();
