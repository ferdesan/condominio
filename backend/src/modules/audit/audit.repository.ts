import { BaseRepository } from '@/shared/repositories/base.repository';
import { AuditLog } from './audit-log.entity';

export class AuditRepository extends BaseRepository<AuditLog> {
  constructor() {
    super(AuditLog, {
      alias: 'audit_log',
      searchableFields: ['description', 'resource', 'userName'],
      filterableFields: ['action', 'resource', 'resourceId', 'userId'],
      defaultSort: { field: 'createdAt', order: 'DESC' },
    });
  }
}

export const auditRepository = new AuditRepository();
