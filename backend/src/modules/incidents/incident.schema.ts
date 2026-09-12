import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { INCIDENT_CATEGORIES, INCIDENT_PRIORITIES, INCIDENT_STATUSES } from './incident.entity';

export const createIncidentSchema = z.object({
  condominiumId: uuidSchema,
  unitId: uuidSchema.optional().nullable(),
  title: z.string().min(3, 'Informe o titulo da ocorrencia.').max(180),
  description: z.string().min(5, 'Descreva a ocorrencia.').max(5000),
  category: z.enum(INCIDENT_CATEGORIES).default('OTHER'),
  priority: z.enum(INCIDENT_PRIORITIES).default('MEDIUM'),
  occurredAt: z.coerce.date().optional().nullable(),
  isAnonymous: z.boolean().default(false),
  location: z.string().max(180).optional().nullable(),
  attachments: z.array(z.string().max(255)).max(10).optional().nullable(),
});

export const updateIncidentSchema = createIncidentSchema.partial().extend({
  status: z.enum(INCIDENT_STATUSES).optional(),
  assignedToId: uuidSchema.optional().nullable(),
  resolution: z.string().max(5000).optional().nullable(),
});

export const changeStatusSchema = z.object({
  status: z.enum(INCIDENT_STATUSES),
  resolution: z.string().max(5000).optional().nullable(),
});

export const assignIncidentSchema = z.object({
  assignedToId: uuidSchema,
});

export type CreateIncidentDTO = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentDTO = z.infer<typeof updateIncidentSchema>;
export type ChangeIncidentStatusDTO = z.infer<typeof changeStatusSchema>;
export type AssignIncidentDTO = z.infer<typeof assignIncidentSchema>;
