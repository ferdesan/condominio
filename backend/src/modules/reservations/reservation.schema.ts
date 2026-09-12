import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';

export const createReservationSchema = z
  .object({
    condominiumId: uuidSchema,
    commonAreaId: uuidSchema,
    unitId: uuidSchema,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    guestsCount: z.coerce.number().int().min(0).max(10000).default(0),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'O termino deve ser posterior ao inicio.',
    path: ['endsAt'],
  });

export const updateReservationSchema = createReservationSchema.innerType().partial().extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELED', 'COMPLETED']).optional(),
  statusReason: z.string().max(255).optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
});

export const reviewReservationSchema = z.object({
  reason: z.string().max(255).optional().nullable(),
});

export const availabilityQuerySchema = z.object({
  condominiumId: uuidSchema,
  commonAreaId: uuidSchema.optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type CreateReservationDTO = z.infer<typeof createReservationSchema>;
export type UpdateReservationDTO = z.infer<typeof updateReservationSchema>;
export type ReviewReservationDTO = z.infer<typeof reviewReservationSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
