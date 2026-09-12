import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { VEHICLE_STATUSES, VEHICLE_TYPES } from './vehicle.entity';

/** Aceita placas no padrao antigo (AAA1234) e Mercosul (AAA1A23). */
const plateSchema = z
  .string()
  .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .refine(
    (value) => /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(value),
    'Placa invalida. Use o formato ABC1234 ou ABC1D23.',
  );

export const createVehicleSchema = z.object({
  condominiumId: uuidSchema,
  unitId: uuidSchema.optional().nullable(),
  residentId: uuidSchema.optional().nullable(),
  plate: plateSchema,
  brand: z.string().max(60).optional().nullable(),
  model: z.string().max(60).optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  type: z.enum(VEHICLE_TYPES).default('CAR'),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  parkingSpot: z.string().max(20).optional().nullable(),
  stickerNumber: z.string().max(30).optional().nullable(),
  status: z.enum(VEHICLE_STATUSES).default('ACTIVE'),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateVehicleDTO = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleDTO = z.infer<typeof updateVehicleSchema>;
