/**
 * Contratos Zod do modulo LGPD, espelhando `backend/src/modules/lgpd/lgpd.schema.ts`.
 */

import { z } from 'zod';

const LGPD_CONSENT_TYPES = ['DATA_PROCESSING'] as const;

/**
 * O id do condominio vem do shell e sempre esta la quando o formulario abre;
 * manter a exigencia de formato e proteger o contrato, e nao o formulario.
 */
export const condominiumSchema = z.string().uuid('Condomínio obrigatório.');

export const createDeleteRequestSchema = z.object({
  condominiumId: condominiumSchema,
  notes: z.string().max(2000).optional().nullable(),
});

export const updateConsentSchema = z.object({
  consentType: z.enum(LGPD_CONSENT_TYPES).default('DATA_PROCESSING'),
  granted: z.boolean(),
  description: z.string().max(2000).optional().nullable(),
});

export type CreateDeleteRequestValues = z.infer<typeof createDeleteRequestSchema>;
export type UpdateConsentValues = z.infer<typeof updateConsentSchema>;
