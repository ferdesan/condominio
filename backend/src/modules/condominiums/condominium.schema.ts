import { z } from 'zod';
import {
  cnpjSchema,
  emailSchema,
  moneySchema,
  phoneSchema,
  stateSchema,
  zipCodeSchema,
} from '@/shared/dto/common.schema';
import { CONDOMINIUM_STATUSES, CONDOMINIUM_TYPES } from './condominium.entity';

export const createCondominiumSchema = z.object({
  name: z.string().min(3, 'Informe o nome do condominio.').max(150),
  document: cnpjSchema.optional().nullable(),
  type: z.enum(CONDOMINIUM_TYPES).default('RESIDENTIAL'),
  status: z.enum(CONDOMINIUM_STATUSES).default('ACTIVE'),
  zipCode: zipCodeSchema.optional().nullable(),
  street: z.string().max(180).optional().nullable(),
  number: z.string().max(20).optional().nullable(),
  complement: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: stateSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  logoUrl: z.string().url().max(255).optional().nullable(),
  syndicName: z.string().max(150).optional().nullable(),
  syndicPhone: phoneSchema.optional().nullable(),
  syndicTermEndsAt: z.string().date().optional().nullable(),
  chargeDueDay: z.coerce.number().int().min(1).max(28).default(10),
  openingBalance: moneySchema.default(0),
  openingBalanceDate: z.string().date().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateCondominiumSchema = createCondominiumSchema.partial();

export type CreateCondominiumDTO = z.infer<typeof createCondominiumSchema>;
export type UpdateCondominiumDTO = z.infer<typeof updateCondominiumSchema>;
