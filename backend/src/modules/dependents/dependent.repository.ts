import { BaseRepository } from '@/shared/repositories/base.repository';
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
}

export const dependentRepository = new DependentRepository();
