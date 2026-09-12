import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema } from '@/shared/dto/common.schema';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.').max(72),
  /** Obrigatorio apenas quando o mesmo e-mail existe em mais de uma administradora. */
  tenantSlug: z.string().max(80).optional(),
  rememberMe: z.boolean().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const registerTenantSchema = z.object({
  tenantName: z.string().min(3, 'Informe o nome da administradora.').max(150),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minusculas, numeros e hifen.')
    .optional(),
  document: z.string().max(18).optional(),
  adminName: z.string().min(3, 'Informe o nome do administrador.').max(150),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'E necessario aceitar os termos de uso e a politica de privacidade.' }),
  }),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  tenantSlug: z.string().max(80).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token invalido.'),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.').max(72),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da atual.',
    path: ['newPassword'],
  });

export const updateProfileSchema = z.object({
  name: z.string().min(3).max(150).optional(),
  phone: phoneSchema.nullable().optional(),
  avatarUrl: z.string().url().max(255).nullable().optional(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      locale: z.string().max(10).optional(),
      emailNotifications: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
    })
    .optional(),
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterTenantDTO = z.infer<typeof registerTenantSchema>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>;
