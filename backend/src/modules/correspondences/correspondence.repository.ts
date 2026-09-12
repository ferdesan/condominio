import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Correspondence } from './correspondence.entity';

export class CorrespondenceRepository extends BaseRepository<Correspondence> {
  constructor() {
    super(Correspondence, {
      alias: 'correspondence',
      searchableFields: ['description', 'carrier', 'trackingCode', 'receivedBy'],
      filterableFields: ['condominiumId', 'unitId', 'residentId', 'status', 'type'],
      relations: ['unit'],
      defaultSort: { field: 'receivedAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async countPending(scope: TenantScope, condominiumId?: string): Promise<number> {
    const qb = this.query(scope).andWhere('correspondence.status = :status', { status: 'PENDING' });
    if (condominiumId) {
      qb.andWhere('correspondence.condominiumId = :condominiumId', { condominiumId });
    }
    return qb.getCount();
  }
}

export const correspondenceRepository = new CorrespondenceRepository();
