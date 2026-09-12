import type { DeepPartial } from 'typeorm';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import type { RequestContext } from '@/shared/services/request-context';
import { isValidCnpj, isValidCpf } from '@/shared/utils/document.util';
import { ServiceProvider } from './service-provider.entity';
import {
  serviceProviderRepository,
  type ServiceProviderRepository,
} from './service-provider.repository';
import type { CreateServiceProviderDTO, UpdateServiceProviderDTO } from './service-provider.schema';

export class ServiceProviderService extends CondominiumScopedService<
  ServiceProvider,
  CreateServiceProviderDTO,
  UpdateServiceProviderDTO
> {
  constructor(repository: ServiceProviderRepository = serviceProviderRepository) {
    super(repository, { resource: 'service-provider', label: 'Prestador de servico' });
  }

  protected override async prepareCreate(
    _ctx: RequestContext,
    dto: CreateServiceProviderDTO,
  ): Promise<DeepPartial<ServiceProvider>> {
    this.assertDocument(dto.document ?? null);
    this.assertContractPeriod(dto.contractStart ?? null, dto.contractEnd ?? null);
    return dto as DeepPartial<ServiceProvider>;
  }

  protected override async prepareUpdate(
    _ctx: RequestContext,
    current: ServiceProvider,
    dto: UpdateServiceProviderDTO,
  ): Promise<DeepPartial<ServiceProvider>> {
    if (dto.document) this.assertDocument(dto.document);
    this.assertContractPeriod(
      dto.contractStart ?? current.contractStart ?? null,
      dto.contractEnd ?? current.contractEnd ?? null,
    );
    return dto as DeepPartial<ServiceProvider>;
  }

  private assertDocument(document: string | null): void {
    if (!document) return;
    const valid = document.length === 11 ? isValidCpf(document) : isValidCnpj(document);
    if (!valid) throw new BusinessRuleError('Documento informado e invalido.');
  }

  private assertContractPeriod(start: string | null, end: string | null): void {
    if (start && end && end < start) {
      throw new BusinessRuleError('O termino do contrato nao pode ser anterior ao inicio.');
    }
  }
}

export const serviceProviderService = new ServiceProviderService();
