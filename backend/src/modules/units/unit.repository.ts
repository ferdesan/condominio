import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Unit } from './unit.entity';

export class UnitRepository extends BaseRepository<Unit> {
  constructor() {
    super(Unit, {
      alias: 'unit',
      searchableFields: ['number'],
      filterableFields: ['condominiumId', 'blockId', 'status', 'type', 'floor'],
      relations: ['block', 'condominium'],
      defaultSort: { field: 'number', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async numberTaken(
    scope: TenantScope,
    blockId: string,
    number: string,
    exceptId?: string,
  ): Promise<boolean> {
    const qb = this.query(scope, true)
      .andWhere('unit.blockId = :blockId', { blockId })
      .andWhere('unit.number = :number', { number });
    if (exceptId) qb.andWhere('unit.id != :exceptId', { exceptId });
    return qb.getExists();
  }

  async sumIdealFraction(scope: TenantScope, condominiumId: string): Promise<number> {
    const row = await this.query(scope)
      .andWhere('unit.condominiumId = :condominiumId', { condominiumId })
      .select('SUM(unit.idealFraction)', 'total')
      .getRawOne<{ total: string | null }>();
    return Number(row?.total ?? 0);
  }

  async listByCondominium(scope: TenantScope, condominiumId: string): Promise<Unit[]> {
    return this.query(scope)
      .andWhere('unit.condominiumId = :condominiumId', { condominiumId })
      .orderBy('unit.number', 'ASC')
      .getMany();
  }
}

export const unitRepository = new UnitRepository();
