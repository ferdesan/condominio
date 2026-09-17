import { z } from 'zod';
import { idParamSchema, uuidSchema } from '@/shared/dto/common.schema';
import { LGPD_CONSENT_TYPES } from './lgpd-consent.entity';

export const createDeleteRequestSchema = z.object({
  condominiumId: uuidSchema,
  notes: z.string().max(2000).optional().nullable(),
});

export const listDeleteRequestsQuerySchema = z.object({
  condominiumId: uuidSchema.optional(),
});

export const lgpdParamsSchema = idParamSchema;

export const residentParamSchema = z.object({
  residentId: uuidSchema,
});

export const updateConsentSchema = z.object({
  consentType: z.enum(LGPD_CONSENT_TYPES).default('DATA_PROCESSING'),
  granted: z.boolean(),
  description: z.string().max(2000).optional().nullable(),
});

export const getConsentQuerySchema = z.object({
  consentType: z.enum(LGPD_CONSENT_TYPES).default('DATA_PROCESSING'),
});

/** Estrutura canonica do payload de exportacao (ADR-002). */
export const lgpdExportPayloadSchema = z.object({
  exportDate: z.string(),
  platform: z.string(),
  dataSubject: z.object({ name: z.string(), email: z.string().nullable().optional() }),
  resident: z.record(z.string(), z.unknown()),
  dependents: z.array(z.record(z.string(), z.unknown())),
  vehicles: z.array(z.record(z.string(), z.unknown())),
  reservations: z.array(z.record(z.string(), z.unknown())),
  financial: z.object({
    charges: z.array(z.record(z.string(), z.unknown())),
    payments: z.array(z.record(z.string(), z.unknown())),
  }),
  correspondences: z.array(z.record(z.string(), z.unknown())),
  documents: z.array(z.record(z.string(), z.unknown())),
});

export type CreateDeleteRequestDTO = z.infer<typeof createDeleteRequestSchema>;
export type ListDeleteRequestsQuery = z.infer<typeof listDeleteRequestsQuerySchema>;
export type UpdateConsentDTO = z.infer<typeof updateConsentSchema>;
export type GetConsentQuery = z.infer<typeof getConsentQuerySchema>;
export type LgpdExportPayload = z.infer<typeof lgpdExportPayloadSchema>;
