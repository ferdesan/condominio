import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Maintenance } from './maintenance.entity';

export class MaintenanceRepository extends BaseRepository<Maintenance> {
  constructor() {
    super(Maintenance, {
      alias: 'maintenance',
      searchableFields: ['title', 'description', 'assetName'],
      filterableFields: [
        'condominiumId',
        'status',
        'type',
        'recurrence',
        'serviceProviderId',
        'responsibleId',
      ],
      defaultSort: { field: 'scheduledFor', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async listUpcoming(scope: TenantScope, condominiumId?: string, limit = 10): Promise<Maintenance[]> {
    const qb = this.query(scope)
      .andWhere('maintenance.status IN (:...statuses)', {
        statuses: ['SCHEDULED', 'IN_PROGRESS', 'OVERDUE'],
      })
      .orderBy('maintenance.scheduledFor', 'ASC')
      .take(limit);

    if (condominiumId) qb.andWhere('maintenance.condominiumId = :condominiumId', { condominiumId });
    return qb.getMany();
  }

  /** Marca como atrasadas as ordens vencidas (job diario). */
  async markOverdue(tenantId: string, reference: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Maintenance)
      .set({ status: 'OVERDUE' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('scheduled_for < :reference', { reference })
      .andWhere("status = 'SCHEDULED'")
      .andWhere('deleted_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }
}

export const maintenanceRepository = new MaintenanceRepository();
