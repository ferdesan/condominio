import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Visitor } from './visitor.entity';

export class VisitorRepository extends BaseRepository<Visitor> {
  constructor() {
    super(Visitor, {
      alias: 'visitor',
      searchableFields: ['name', 'document', 'company', 'vehiclePlate', 'badgeNumber'],
      filterableFields: ['condominiumId', 'unitId', 'status', 'type', 'authorizedById'],
      relations: ['unit'],
      defaultSort: { field: 'createdAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async findByAccessCode(scope: TenantScope, accessCode: string): Promise<Visitor | null> {
    return this.query(scope)
      .andWhere('visitor.accessCode = :accessCode', { accessCode })
      .andWhere('visitor.status = :status', { status: 'EXPECTED' })
      .getOne();
  }

  async countInside(scope: TenantScope, condominiumId?: string): Promise<number> {
    const qb = this.query(scope).andWhere('visitor.status = :status', { status: 'CHECKED_IN' });
    if (condominiumId) qb.andWhere('visitor.condominiumId = :condominiumId', { condominiumId });
    return qb.getCount();
  }
}

export const visitorRepository = new VisitorRepository();
