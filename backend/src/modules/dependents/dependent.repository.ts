import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Dependent } from './dependent.entity';

export class DependentRepository extends BaseRepository<Dependent> {
  constructor() {
    super(Dependent, {
      alias: 'dependent',
      searchableFields: ['name', 'document'],
      filterableFields: ['condominiumId', 'unitId', 'residentId', 'relationship', 'active'],
      relations: ['resident'],
      defaultSort: { field: 'name', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async softDeleteByResidentId(scope: TenantScope, residentId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({ deletedAt: new Date() })
      .where('tenant_id = :tenantId', { tenantId: scope.tenantId })
      .andWhere('resident_id = :residentId', { residentId })
      .andWhere('deleted_at IS NULL')
      .execute();
  }
}

export const dependentRepository = new DependentRepository();
