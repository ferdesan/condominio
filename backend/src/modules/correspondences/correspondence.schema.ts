import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { CORRESPONDENCE_STATUSES, CORRESPONDENCE_TYPES } from './correspondence.entity';

export const createCorrespondenceSchema = z.object({
  condominiumId: uuidSchema,
  unitId: uuidSchema,
  residentId: uuidSchema.optional().nullable(),
  type: z.enum(CORRESPONDENCE_TYPES).default('PACKAGE'),
  status: z.enum(CORRESPONDENCE_STATUSES).default('PENDING'),
  carrier: z.string().max(120).optional().nullable(),
  trackingCode: z.string().max(60).optional().nullable(),
  description: z.string().max(255).optional().nullable(),
  receivedAt: z.coerce.date().default(() => new Date()),
  receivedBy: z.string().max(150).optional().nullable(),
  photoUrl: z.string().url().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateCorrespondenceSchema = createCorrespondenceSchema
  .extend({
    deliveredAt: z.coerce.date().optional().nullable(),
    deliveredTo: z.string().max(150).optional().nullable(),
  })
  .partial();

export const deliverCorrespondenceSchema = z.object({
  deliveredTo: z.string().min(3, 'Informe quem retirou a correspondencia.').max(150),
  deliveredAt: z.coerce.date().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateCorrespondenceDTO = z.infer<typeof createCorrespondenceSchema>;
export type UpdateCorrespondenceDTO = z.infer<typeof updateCorrespondenceSchema>;
export type DeliverCorrespondenceDTO = z.infer<typeof deliverCorrespondenceSchema>;
