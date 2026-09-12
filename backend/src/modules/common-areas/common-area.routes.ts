import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import type { CommonArea } from './common-area.entity';
import type { CreateCommonAreaDTO, UpdateCommonAreaDTO } from './common-area.schema';
import { createCommonAreaSchema, updateCommonAreaSchema } from './common-area.schema';
import { commonAreaService } from './common-area.service';

export const commonAreaRouter = createCrudRouter({
  resource: 'common-area',
  controller: new BaseCrudController<CommonArea, CreateCommonAreaDTO, UpdateCommonAreaDTO>(
    commonAreaService,
  ),
  createSchema: createCommonAreaSchema,
  updateSchema: updateCommonAreaSchema,
});
