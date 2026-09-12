import { z } from 'zod';
import { moneySchema, uuidSchema } from '@/shared/dto/common.schema';
import {
  MAINTENANCE_RECURRENCES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
} from './maintenance.entity';

export const createMaintenanceSchema = z.object({
  condominiumId: uuidSchema,
  title: z.string().min(3, 'Informe o titulo da manutencao.').max(180),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(MAINTENANCE_TYPES).default('PREVENTIVE'),
  status: z.enum(MAINTENANCE_STATUSES).default('SCHEDULED'),
  recurrence: z.enum(MAINTENANCE_RECURRENCES).default('NONE'),
  assetName: z.string().max(150).optional().nullable(),
  serviceProviderId: uuidSchema.optional().nullable(),
  responsibleId: uuidSchema.optional().nullable(),
  scheduledFor: z.coerce.date(),
  estimatedCost: moneySchema.default(0),
  attachments: z.array(z.string().max(255)).max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateMaintenanceSchema = createMaintenanceSchema.partial().extend({
  startedAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
  finalCost: moneySchema.optional().nullable(),
  nextExecutionAt: z.string().date().optional().nullable(),
});

export const completeMaintenanceSchema = z.object({
  finalCost: moneySchema.optional(),
  completedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional().nullable(),
  /** Gera automaticamente a proxima ordem quando a manutencao e recorrente. */
  scheduleNext: z.boolean().default(true),
});

export type CreateMaintenanceDTO = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceDTO = z.infer<typeof updateMaintenanceSchema>;
export type CompleteMaintenanceDTO = z.infer<typeof completeMaintenanceSchema>;
