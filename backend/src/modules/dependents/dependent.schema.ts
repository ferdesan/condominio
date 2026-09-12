import { z } from 'zod';
import { cpfSchema, phoneSchema, uuidSchema } from '@/shared/dto/common.schema';
import { DEPENDENT_RELATIONSHIPS } from './dependent.entity';

export const createDependentSchema = z.object({
  condominiumId: uuidSchema,
  unitId: uuidSchema,
  residentId: uuidSchema,
  name: z.string().min(3, 'Informe o nome do dependente.').max(150),
  relationship: z.enum(DEPENDENT_RELATIONSHIPS).default('OTHER'),
  document: cpfSchema.optional().nullable(),
  birthDate: z.string().date().optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  photoUrl: z.string().url().max(255).optional().nullable(),
  hasAccessCard: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const updateDependentSchema = createDependentSchema.partial();

export type CreateDependentDTO = z.infer<typeof createDependentSchema>;
export type UpdateDependentDTO = z.infer<typeof updateDependentSchema>;
