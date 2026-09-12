import type { DeepPartial } from 'typeorm';
import { residentRepository, type ResidentRepository } from '@/modules/residents/resident.repository';
import { BusinessRuleError, NotFoundError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import type { RequestContext } from '@/shared/services/request-context';
import { Dependent } from './dependent.entity';
import { dependentRepository, type DependentRepository } from './dependent.repository';
import type { CreateDependentDTO, UpdateDependentDTO } from './dependent.schema';

export class DependentService extends CondominiumScopedService<
  Dependent,
  CreateDependentDTO,
  UpdateDependentDTO
> {
  constructor(
    dependents: DependentRepository = dependentRepository,
    private readonly residents: ResidentRepository = residentRepository,
  ) {
    super(dependents, { resource: 'dependent', label: 'Dependente' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateDependentDTO,
  ): Promise<DeepPartial<Dependent>> {
    await this.assertResidentConsistency(ctx, dto.residentId, dto.unitId, dto.condominiumId);
    return dto as DeepPartial<Dependent>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Dependent,
    dto: UpdateDependentDTO,
  ): Promise<DeepPartial<Dependent>> {
    if (dto.residentId && dto.residentId !== current.residentId) {
      await this.assertResidentConsistency(
        ctx,
        dto.residentId,
        dto.unitId ?? current.unitId,
        dto.condominiumId ?? current.condominiumId,
      );
    }
    return dto as DeepPartial<Dependent>;
  }

  /** O dependente sempre herda a unidade e o condominio do morador titular. */
  private async assertResidentConsistency(
    ctx: RequestContext,
    residentId: string,
    unitId: string,
    condominiumId: string,
  ): Promise<void> {
    const resident = await this.residents.findById(ctx.scope, residentId);
    if (!resident) throw new NotFoundError('Morador');

    if (resident.unitId !== unitId || resident.condominiumId !== condominiumId) {
      throw new BusinessRuleError('O dependente deve pertencer a mesma unidade do morador titular.');
    }
  }
}

export const dependentService = new DependentService();
