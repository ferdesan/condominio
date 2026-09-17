import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_CHANGED',
  'PERMISSION_DENIED',
  'EXPORT',
  'IMPORT',
  'LGPD_DELETE_REQUEST',
  'LGPD_DELETE',
  'LGPD_DELETE_CANCEL',
  'LGPD_EXPORT',
  'LGPD_CONSENT_GRANTED',
  'LGPD_CONSENT_REVOKED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditChanges = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * Append-only trail required by LGPD art. 37 and by condominium legislation
 * (prestacao de contas). Rows are never updated nor soft-deleted by the app.
 */
@Entity('audit_logs')
@Index(['tenantId', 'resource', 'resourceId'])
@Index(['tenantId', 'createdAt'])
export class AuditLog extends TenantScopedEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @Column({ name: 'user_name', type: 'varchar', length: 150, nullable: true })
  userName?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 60 })
  resource: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 36, nullable: true })
  resourceId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  changes?: AuditChanges | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId?: string | null;
}
