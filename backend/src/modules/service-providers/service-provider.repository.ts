import { BaseRepository } from '@/shared/repositories/base.repository';
import { ServiceProvider } from './service-provider.entity';

export class ServiceProviderRepository extends BaseRepository<ServiceProvider> {
  constructor() {
    super(ServiceProvider, {
      alias: 'service_provider',
      searchableFields: ['companyName', 'tradeName', 'document', 'serviceType', 'contactName'],
      filterableFields: ['condominiumId', 'status', 'serviceType'],
      defaultSort: { field: 'companyName', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }
}

export const serviceProviderRepository = new ServiceProviderRepository();
