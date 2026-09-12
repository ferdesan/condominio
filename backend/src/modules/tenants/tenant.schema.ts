import { z } from 'zod';
import { cnpjSchema, emailSchema, phoneSchema } from '@/shared/dto/common.schema';
import { TENANT_PLANS, TENANT_STATUSES } from './tenant.entity';

const settingsSchema = z.object({
  primaryColor: z.string().max(20).optional(),
  timezone: z.string().max(60).optional(),
  locale: z.string().max(10).optional(),
  chargeGraceDays: z.coerce.number().int().min(0).max(30).optional(),
  latePenaltyPercent: z.coerce.number().min(0).max(20).optional(),
  lateInterestPercent: z.coerce.number().min(0).max(20).optional(),
});

export const createTenantSchema = z.object({
  name: z.string().min(3, 'Informe o nome da administradora.').max(150),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minusculas, numeros e hifen.'),
  document: cnpjSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  plan: z.enum(TENANT_PLANS).default('TRIAL'),
  status: z.enum(TENANT_STATUSES).default('ACTIVE'),
  maxCondominiums: z.coerce.number().int().min(1).max(1000).default(1),
  maxUsers: z.coerce.number().int().min(1).max(10000).default(10),
  logoUrl: z.string().url().max(255).optional().nullable(),
  trialEndsAt: z.coerce.date().optional().nullable(),
  settings: settingsSchema.optional(),
});

export const updateTenantSchema = createTenantSchema.partial();

export type CreateTenantDTO = z.infer<typeof createTenantSchema>;
export type UpdateTenantDTO = z.infer<typeof updateTenantSchema>;
