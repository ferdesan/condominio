import { z } from 'zod';
import { emailSchema, phoneSchema, uuidSchema } from '@/shared/dto/common.schema';
import { PROVIDER_STATUSES } from './service-provider.entity';

export const createServiceProviderSchema = z.object({
  condominiumId: uuidSchema,
  companyName: z.string().min(3, 'Informe a razao social.').max(150),
  tradeName: z.string().max(150).optional().nullable(),
  document: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 11 || value.length === 14, 'Informe um CPF ou CNPJ valido.')
    .optional()
    .nullable(),
  serviceType: z.string().min(2, 'Informe o tipo de servico.').max(100),
  contactName: z.string().max(150).optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  status: z.enum(PROVIDER_STATUSES).default('ACTIVE'),
  contractStart: z.string().date().optional().nullable(),
  contractEnd: z.string().date().optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateServiceProviderSchema = createServiceProviderSchema.partial();

export type CreateServiceProviderDTO = z.infer<typeof createServiceProviderSchema>;
export type UpdateServiceProviderDTO = z.infer<typeof updateServiceProviderSchema>;
