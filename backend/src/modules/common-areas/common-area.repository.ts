import { BaseRepository } from '@/shared/repositories/base.repository';
import { CommonArea } from './common-area.entity';

export class CommonAreaRepository extends BaseRepository<CommonArea> {
  constructor() {
    super(CommonArea, {
      alias: 'common_area',
      searchableFields: ['name', 'description'],
      filterableFields: ['condominiumId', 'status', 'requiresApproval'],
      defaultSort: { field: 'name', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }
}

export const commonAreaRepository = new CommonAreaRepository();
