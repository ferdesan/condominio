import { z } from 'zod';

export const uuidSchema = z.string().uuid('Identificador invalido.');

export const idParamSchema = z.object({ id: uuidSchema });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(200).optional(),
  sortBy: z.string().max(60).optional(),
  sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
  search: z.string().max(120).optional(),
  includeDeleted: z.enum(['true', 'false']).optional(),
});

/** Aceita datas ISO (`2026-01-31`) e datetimes ISO-8601. */
export const dateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Data invalida.');

export const optionalDateSchema = dateStringSchema.optional().nullable();

export const moneySchema = z
  .number({ invalid_type_error: 'Valor monetario invalido.' })
  .min(0, 'Valor nao pode ser negativo.')
  .max(99_999_999.99, 'Valor acima do limite suportado.');

export const emailSchema = z
  .string()
  .email('E-mail invalido.')
  .max(180)
  .transform((value) => value.toLowerCase().trim());

export const phoneSchema = z
  .string()
  .min(8, 'Telefone invalido.')
  .max(20)
  .regex(/^[0-9()+\-\s]+$/, 'Telefone deve conter apenas numeros e simbolos validos.');

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .max(72, 'A senha deve ter no maximo 72 caracteres.')
  .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiuscula.')
  .regex(/[a-z]/, 'A senha deve conter ao menos uma letra minuscula.')
  .regex(/[0-9]/, 'A senha deve conter ao menos um numero.');

export const cpfSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 11, 'CPF deve conter 11 digitos.');

export const cnpjSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 14, 'CNPJ deve conter 14 digitos.');

export const zipCodeSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 8, 'CEP deve conter 8 digitos.');

export const stateSchema = z
  .string()
  .length(2, 'UF deve conter 2 caracteres.')
  .transform((value) => value.toUpperCase());

export const addressSchema = z.object({
  zipCode: zipCodeSchema.optional(),
  street: z.string().max(180).optional(),
  number: z.string().max(20).optional(),
  complement: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: stateSchema.optional(),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
