import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Block } from './block.entity';

export class BlockRepository extends BaseRepository<Block> {
  constructor() {
    super(Block, {
      alias: 'block',
      searchableFields: ['name', 'description'],
      filterableFields: ['condominiumId', 'type'],
      relations: ['condominium'],
      defaultSort: { field: 'name', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async nameTaken(
    scope: TenantScope,
    condominiumId: string,
    name: string,
    exceptId?: string,
  ): Promise<boolean> {
    const qb = this.query(scope, true)
      .andWhere('block.condominiumId = :condominiumId', { condominiumId })
      .andWhere('block.name = :name', { name });
    if (exceptId) qb.andWhere('block.id != :exceptId', { exceptId });
    return qb.getExists();
  }
}

export const blockRepository = new BlockRepository();
