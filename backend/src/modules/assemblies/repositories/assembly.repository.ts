import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Assembly } from '../entities/assembly.entity';

export class AssemblyRepository extends BaseRepository<Assembly> {
  constructor() {
    super(Assembly, {
      alias: 'assembly',
      searchableFields: ['title', 'description', 'location'],
      filterableFields: ['condominiumId', 'status', 'type', 'mode'],
      defaultSort: { field: 'scheduledAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async listUpcoming(scope: TenantScope, condominiumId?: string, limit = 5): Promise<Assembly[]> {
    const qb = this.query(scope)
      .andWhere('assembly.scheduledAt >= :now', { now: new Date() })
      .andWhere('assembly.status IN (:...statuses)', { statuses: ['SCHEDULED', 'IN_PROGRESS'] })
      .orderBy('assembly.scheduledAt', 'ASC')
      .take(limit);

    if (condominiumId) qb.andWhere('assembly.condominiumId = :condominiumId', { condominiumId });
    return qb.getMany();
  }
}

export const assemblyRepository = new AssemblyRepository();
