import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { COMMON_AREA_STATUSES } from './common-area.entity';

const timeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Horario invalido. Use o formato HH:mm.');

const commonAreaBaseSchema = z.object({
  condominiumId: uuidSchema,
  name: z.string().min(2, 'Informe o nome da area comum.').max(120),
  description: z.string().max(2000).optional().nullable(),
  capacity: z.coerce.number().int().min(0).max(10000).default(0),
  status: z.enum(COMMON_AREA_STATUSES).default('AVAILABLE'),
  requiresApproval: z.boolean().default(true),
  reservationFee: z.coerce.number().min(0).max(999999).default(0),
  opensAt: timeSchema.default('08:00'),
  closesAt: timeSchema.default('22:00'),
  availableWeekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional().nullable(),
  minHours: z.coerce.number().int().min(1).max(24).default(1),
  maxHours: z.coerce.number().int().min(1).max(24).default(6),
  advanceBookingDays: z.coerce.number().int().min(0).max(365).default(60),
  minIntervalDays: z.coerce.number().int().min(0).max(365).default(0),
  photoUrl: z.string().url().max(255).optional().nullable(),
  rules: z.string().max(5000).optional().nullable(),
});

export const createCommonAreaSchema = commonAreaBaseSchema
  .refine((data) => data.closesAt > data.opensAt, {
    message: 'O horario de fechamento deve ser posterior ao de abertura.',
    path: ['closesAt'],
  })
  .refine((data) => data.maxHours >= data.minHours, {
    message: 'A duracao maxima deve ser maior ou igual a minima.',
    path: ['maxHours'],
  });

export const updateCommonAreaSchema = commonAreaBaseSchema.partial();

export type CreateCommonAreaDTO = z.infer<typeof createCommonAreaSchema>;
export type UpdateCommonAreaDTO = z.infer<typeof updateCommonAreaSchema>;
