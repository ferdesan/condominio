import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import type { Dependent } from './dependent.entity';
import type { CreateDependentDTO, UpdateDependentDTO } from './dependent.schema';
import { createDependentSchema, updateDependentSchema } from './dependent.schema';
import { dependentService } from './dependent.service';

export const dependentRouter = createCrudRouter({
  resource: 'dependent',
  controller: new BaseCrudController<Dependent, CreateDependentDTO, UpdateDependentDTO>(
    dependentService,
  ),
  createSchema: createDependentSchema,
  updateSchema: updateDependentSchema,
});
