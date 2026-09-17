import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { LgpdRequest } from './lgpd-request.entity';

export class LgpdRequestRepository extends BaseRepository<LgpdRequest> {
  constructor() {
    super(LgpdRequest, {
      alias: 'lgpd_request',
      searchableFields: ['status', 'notes'],
      filterableFields: ['condominiumId', 'residentId', 'status'],
      relations: ['resident'],
      defaultSort: { field: 'requestedAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  /** Quantidade de solicitacoes pendentes de um morador (base da regra anti-duplicidade). */
  async countPendingByResident(scope: TenantScope, residentId: string): Promise<number> {
    return this.query(scope, true)
      .andWhere('lgpd_request.residentId = :residentId', { residentId })
      .andWhere('lgpd_request.status = :status', { status: 'PENDING' })
      .getCount();
  }
}

export const lgpdRequestRepository = new LgpdRequestRepository();
