import { z } from 'zod';
import {
  cpfSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  uuidSchema,
} from '@/shared/dto/common.schema';
import { USER_STATUSES } from './user.entity';

export const createUserSchema = z.object({
  name: z.string().min(3, 'Informe o nome do usuario.').max(150),
  email: emailSchema,
  /** Opcional: quando ausente, uma senha temporaria e gerada e retornada uma unica vez. */
  password: passwordSchema.optional(),
  phone: phoneSchema.optional().nullable(),
  document: cpfSchema.optional().nullable(),
  avatarUrl: z.string().url().max(255).optional().nullable(),
  status: z.enum(USER_STATUSES).default('ACTIVE'),
  roleId: uuidSchema,
  condominiumIds: z.array(uuidSchema).max(100).default([]),
  unitId: uuidSchema.optional().nullable(),
  mustChangePassword: z.boolean().optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

export const adminResetPasswordSchema = z.object({
  password: passwordSchema.optional(),
});

export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
export type AdminResetPasswordDTO = z.infer<typeof adminResetPasswordSchema>;
