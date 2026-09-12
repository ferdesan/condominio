import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import type { Vehicle } from './vehicle.entity';
import type { CreateVehicleDTO, UpdateVehicleDTO } from './vehicle.schema';
import { createVehicleSchema, updateVehicleSchema } from './vehicle.schema';
import { vehicleService } from './vehicle.service';

export const vehicleRouter = createCrudRouter({
  resource: 'vehicle',
  controller: new BaseCrudController<Vehicle, CreateVehicleDTO, UpdateVehicleDTO>(vehicleService),
  createSchema: createVehicleSchema,
  updateSchema: updateVehicleSchema,
});
