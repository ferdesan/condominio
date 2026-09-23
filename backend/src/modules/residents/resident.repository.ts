import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Resident } from './resident.entity';

export class ResidentRepository extends BaseRepository<Resident> {
  constructor() {
    super(Resident, {
      alias: 'resident',
      searchableFields: ['name', 'email', 'document', 'phone'],
      filterableFields: ['condominiumId', 'unitId', 'type', 'status', 'userId'],
      relations: ['unit'],
      defaultSort: { field: 'name', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async documentTaken(scope: TenantScope, document: string, exceptId?: string): Promise<boolean> {
    const qb = this.query(scope, true).andWhere('resident.document = :document', { document });
    if (exceptId) qb.andWhere('resident.id != :exceptId', { exceptId });
    return qb.getExists();
  }

  async clearPrimaryFlag(scope: TenantScope, unitId: string, exceptId?: string): Promise<void> {
    const qb = this.repository
      .createQueryBuilder()
      .update(Resident)
      .set({ isPrimary: false })
      .where('unit_id = :unitId', { unitId })
      .andWhere('tenant_id = :tenantId', { tenantId: scope.tenantId })
      .andWhere('is_primary = :isPrimary', { isPrimary: true });

    if (exceptId) qb.andWhere('id != :exceptId', { exceptId });
    await qb.execute();
  }

  async countActiveByUnit(scope: TenantScope, unitId: string): Promise<number> {
    return this.query(scope)
      .andWhere('resident.unitId = :unitId', { unitId })
      .andWhere('resident.status = :status', { status: 'ACTIVE' })
      .getCount();
  }

  async findByUser(scope: TenantScope, userId: string): Promise<Resident | null> {
    return this.findOneBy(scope, { userId } as Partial<Record<keyof Resident, unknown>>);
  }

  async listActiveOwnersByCondominium(
    scope: TenantScope,
    condominiumId: string,
  ): Promise<Resident[]> {
    return this.query(scope)
      .andWhere('resident.condominiumId = :condominiumId', { condominiumId })
      .andWhere('resident.type = :type', { type: 'OWNER' })
      .andWhere('resident.status = :status', { status: 'ACTIVE' })
      .getMany();
  }

  async listActiveByUnit(scope: TenantScope, unitId: string): Promise<Resident[]> {
    return this.query(scope)
      .andWhere('resident.unitId = :unitId', { unitId })
      .andWhere('resident.status = :status', { status: 'ACTIVE' })
      .orderBy('resident.isPrimary', 'DESC')
      .getMany();
  }
}

export const residentRepository = new ResidentRepository();
