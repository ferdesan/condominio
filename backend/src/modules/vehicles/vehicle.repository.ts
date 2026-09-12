import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Vehicle } from './vehicle.entity';

export class VehicleRepository extends BaseRepository<Vehicle> {
  constructor() {
    super(Vehicle, {
      alias: 'vehicle',
      searchableFields: ['plate', 'brand', 'model', 'parkingSpot'],
      filterableFields: ['condominiumId', 'unitId', 'residentId', 'type', 'status'],
      relations: ['unit'],
      defaultSort: { field: 'plate', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async plateTaken(scope: TenantScope, plate: string, exceptId?: string): Promise<boolean> {
    const qb = this.query(scope, true).andWhere('vehicle.plate = :plate', { plate });
    if (exceptId) qb.andWhere('vehicle.id != :exceptId', { exceptId });
    return qb.getExists();
  }
}

export const vehicleRepository = new VehicleRepository();
