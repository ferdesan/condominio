import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Condominium } from './condominium.entity';

export class CondominiumRepository extends BaseRepository<Condominium> {
  constructor() {
    super(Condominium, {
      alias: 'condominium',
      searchableFields: ['name', 'document', 'city', 'district'],
      filterableFields: ['status', 'type', 'city', 'state'],
      defaultSort: { field: 'name', order: 'ASC' },
      condominiumField: 'id',
    });
  }

  async countActive(scope: TenantScope): Promise<number> {
    return this.count(scope, { status: 'ACTIVE' } as Partial<Record<keyof Condominium, unknown>>);
  }

  /** Mantem `total_units` coerente apos alteracoes no cadastro de unidades. */
  async refreshUnitCounter(tenantId: string, condominiumId: string): Promise<void> {
    const row = await this.repository.manager
      .createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from('units', 'unit')
      .where('unit.condominium_id = :condominiumId', { condominiumId })
      .andWhere('unit.tenant_id = :tenantId', { tenantId })
      .andWhere('unit.deleted_at IS NULL')
      .getRawOne<{ total: string }>();

    await this.repository.update(
      { id: condominiumId, tenantId },
      { totalUnits: Number(row?.total ?? 0) },
    );
  }
}

export const condominiumRepository = new CondominiumRepository();
