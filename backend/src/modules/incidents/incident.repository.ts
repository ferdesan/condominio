import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Incident } from './incident.entity';

export class IncidentRepository extends BaseRepository<Incident> {
  constructor() {
    super(Incident, {
      alias: 'incident',
      searchableFields: ['protocol', 'title', 'description', 'location'],
      filterableFields: [
        'condominiumId',
        'unitId',
        'status',
        'category',
        'priority',
        'assignedToId',
        'reportedById',
      ],
      defaultSort: { field: 'createdAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  /** Ultimo sequencial do ano, base para o proximo protocolo. */
  async countByYear(scope: TenantScope, year: number): Promise<number> {
    return this.query(scope, true)
      .andWhere('incident.protocol LIKE :prefix', { prefix: `OC-${year}-%` })
      .getCount();
  }

  async protocolTaken(scope: TenantScope, protocol: string): Promise<boolean> {
    return this.query(scope, true).andWhere('incident.protocol = :protocol', { protocol }).getExists();
  }

  async countOpen(scope: TenantScope, condominiumId?: string): Promise<number> {
    const qb = this.query(scope).andWhere('incident.status IN (:...statuses)', {
      statuses: ['OPEN', 'IN_ANALYSIS', 'IN_PROGRESS'],
    });
    if (condominiumId) qb.andWhere('incident.condominiumId = :condominiumId', { condominiumId });
    return qb.getCount();
  }

  async countByStatus(scope: TenantScope, condominiumId: string) {
    return this.query(scope)
      .andWhere('incident.condominiumId = :condominiumId', { condominiumId })
      .select('incident.status', 'status')
      .addSelect('COUNT(1)', 'total')
      .groupBy('incident.status')
      .getRawMany<{ status: string; total: string }>();
  }
}

export const incidentRepository = new IncidentRepository();
