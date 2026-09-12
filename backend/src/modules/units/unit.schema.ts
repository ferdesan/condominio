import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { UNIT_STATUSES, UNIT_TYPES } from './unit.entity';

export const createUnitSchema = z.object({
  condominiumId: uuidSchema,
  blockId: uuidSchema,
  number: z.string().min(1, 'Informe o numero da unidade.').max(20),
  floor: z.coerce.number().int().min(-10).max(200).default(0),
  type: z.enum(UNIT_TYPES).default('APARTMENT'),
  status: z.enum(UNIT_STATUSES).default('VACANT'),
  area: z.coerce.number().min(0).max(100000).optional().nullable(),
  idealFraction: z.coerce.number().min(0).max(1).optional().nullable(),
  monthlyFee: z.coerce.number().min(0).max(999999.99).default(0),
  bedrooms: z.coerce.number().int().min(0).max(20).default(0),
  parkingSpots: z.coerce.number().int().min(0).max(20).default(0),
  petsAllowed: z.boolean().default(true),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateUnitSchema = createUnitSchema.partial();

/** Geracao em lote: cria `unitsPerFloor` unidades para cada andar do bloco. */
export const bulkCreateUnitsSchema = z.object({
  condominiumId: uuidSchema,
  blockId: uuidSchema,
  floors: z.coerce.number().int().min(1).max(100),
  unitsPerFloor: z.coerce.number().int().min(1).max(50),
  startFloor: z.coerce.number().int().min(0).max(100).default(1),
  /** Padrao do numero: {floor} e {index} sao substituidos. */
  numberPattern: z.string().max(30).default('{floor}{index}'),
  type: z.enum(UNIT_TYPES).default('APARTMENT'),
  monthlyFee: z.coerce.number().min(0).default(0),
  area: z.coerce.number().min(0).optional().nullable(),
});

export type CreateUnitDTO = z.infer<typeof createUnitSchema>;
export type UpdateUnitDTO = z.infer<typeof updateUnitSchema>;
export type BulkCreateUnitsDTO = z.infer<typeof bulkCreateUnitsSchema>;
