import { z } from 'zod';
import { PERMISSION_CATALOG } from '@/shared/constants/permissions';

const permissionValues = ['*', ...PERMISSION_CATALOG] as [string, ...string[]];

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(3, 'Informe o nome do papel.')
    .max(60)
    .regex(/^[A-Za-z0-9_ -]+$/, 'Use apenas letras, numeros, espaco, hifen ou underscore.'),
  description: z.string().max(255).optional().nullable(),
  permissions: z
    .array(z.enum(permissionValues))
    .min(1, 'Selecione ao menos uma permissao.')
    .max(400),
});

export const updateRoleSchema = createRoleSchema.partial();

export type CreateRoleDTO = z.infer<typeof createRoleSchema>;
export type UpdateRoleDTO = z.infer<typeof updateRoleSchema>;
