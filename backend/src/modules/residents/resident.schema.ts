import { z } from 'zod';
import { cpfSchema, emailSchema, phoneSchema, uuidSchema } from '@/shared/dto/common.schema';
import { RESIDENT_STATUSES, RESIDENT_TYPES } from './resident.entity';

export const createResidentSchema = z.object({
  condominiumId: uuidSchema,
  unitId: uuidSchema,
  userId: uuidSchema.optional().nullable(),
  name: z.string().min(3, 'Informe o nome do morador.').max(150),
  document: cpfSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  birthDate: z.string().date().optional().nullable(),
  type: z.enum(RESIDENT_TYPES).default('OWNER'),
  status: z.enum(RESIDENT_STATUSES).default('ACTIVE'),
  isPrimary: z.boolean().default(false),
  moveInDate: z.string().date().optional().nullable(),
  moveOutDate: z.string().date().optional().nullable(),
  emergencyContact: z.string().max(150).optional().nullable(),
  emergencyPhone: phoneSchema.optional().nullable(),
  photoUrl: z.string().url().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateResidentSchema = createResidentSchema.partial();

export type CreateResidentDTO = z.infer<typeof createResidentSchema>;
export type UpdateResidentDTO = z.infer<typeof updateResidentSchema>;
