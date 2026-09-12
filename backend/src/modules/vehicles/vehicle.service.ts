import type { DeepPartial } from 'typeorm';
import { BusinessRuleError, ConflictError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { resolveUnitCondominium } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { Vehicle } from './vehicle.entity';
import { vehicleRepository, type VehicleRepository } from './vehicle.repository';
import type { CreateVehicleDTO, UpdateVehicleDTO } from './vehicle.schema';

export class VehicleService extends CondominiumScopedService<
  Vehicle,
  CreateVehicleDTO,
  UpdateVehicleDTO
> {
  constructor(private readonly vehicles: VehicleRepository = vehicleRepository) {
    super(vehicles, { resource: 'vehicle', label: 'Veiculo' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateVehicleDTO,
  ): Promise<DeepPartial<Vehicle>> {
    if (await this.vehicles.plateTaken(ctx.scope, dto.plate)) {
      throw new ConflictError('Ja existe um veiculo cadastrado com esta placa.');
    }
    await this.assertUnitConsistency(ctx, dto.unitId ?? null, dto.condominiumId);
    return dto as DeepPartial<Vehicle>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Vehicle,
    dto: UpdateVehicleDTO,
  ): Promise<DeepPartial<Vehicle>> {
    if (dto.plate && dto.plate !== current.plate) {
      if (await this.vehicles.plateTaken(ctx.scope, dto.plate, current.id)) {
        throw new ConflictError('Ja existe um veiculo cadastrado com esta placa.');
      }
    }
    if (dto.unitId && dto.unitId !== current.unitId) {
      await this.assertUnitConsistency(
        ctx,
        dto.unitId,
        dto.condominiumId ?? current.condominiumId,
      );
    }
    return dto as DeepPartial<Vehicle>;
  }

  private async assertUnitConsistency(
    ctx: RequestContext,
    unitId: string | null,
    condominiumId: string,
  ): Promise<void> {
    if (!unitId) return;
    const unitCondominium = await resolveUnitCondominium(ctx.scope, unitId);
    if (unitCondominium !== condominiumId) {
      throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
    }
  }
}

export const vehicleService = new VehicleService();
