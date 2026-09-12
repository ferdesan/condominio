import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import type { ServiceProvider } from './service-provider.entity';
import type { CreateServiceProviderDTO, UpdateServiceProviderDTO } from './service-provider.schema';
import {
  createServiceProviderSchema,
  updateServiceProviderSchema,
} from './service-provider.schema';
import { serviceProviderService } from './service-provider.service';

export const serviceProviderRouter = createCrudRouter({
  resource: 'service-provider',
  controller: new BaseCrudController<
    ServiceProvider,
    CreateServiceProviderDTO,
    UpdateServiceProviderDTO
  >(serviceProviderService),
  createSchema: createServiceProviderSchema,
  updateSchema: updateServiceProviderSchema,
});
