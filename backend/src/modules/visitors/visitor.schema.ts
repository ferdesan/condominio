import { z } from 'zod';
import { cpfSchema, phoneSchema, uuidSchema } from '@/shared/dto/common.schema';
import { VISITOR_STATUSES, VISITOR_TYPES } from './visitor.entity';

export const createVisitorSchema = z.object({
  condominiumId: uuidSchema,
  unitId: uuidSchema,
  name: z.string().min(3, 'Informe o nome do visitante.').max(150),
  document: cpfSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  type: z.enum(VISITOR_TYPES).default('VISITOR'),
  status: z.enum(VISITOR_STATUSES).default('EXPECTED'),
  company: z.string().max(120).optional().nullable(),
  vehiclePlate: z.string().max(10).optional().nullable(),
  expectedAt: z.coerce.date().optional().nullable(),
  expectedUntil: z.coerce.date().optional().nullable(),
  badgeNumber: z.string().max(30).optional().nullable(),
  photoUrl: z.string().url().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateVisitorSchema = createVisitorSchema
  .extend({
    checkedInAt: z.coerce.date().optional().nullable(),
    checkedOutAt: z.coerce.date().optional().nullable(),
  })
  .partial();

export const checkInSchema = z.object({
  badgeNumber: z.string().max(30).optional().nullable(),
  vehiclePlate: z.string().max(10).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const checkOutSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateVisitorDTO = z.infer<typeof createVisitorSchema>;
export type UpdateVisitorDTO = z.infer<typeof updateVisitorSchema>;
export type CheckInDTO = z.infer<typeof checkInSchema>;
export type CheckOutDTO = z.infer<typeof checkOutSchema>;
