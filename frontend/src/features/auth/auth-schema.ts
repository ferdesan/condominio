/**
 * Espelho cliente de `forgotPasswordSchema` e `resetPasswordSchema`, em
 * `backend/src/modules/auth/auth.schema.ts`.
 *
 * **`tenantSlug` fica de fora dos dois.** O servidor o aceita como opcional,
 * para o caso de um e-mail existir em mais de uma administradora, mas
 * `auth-provider.tsx` tambem nao o envia no login — tratar esse caso e mudar o
 * fluxo de entrada inteiro, e nao acrescentar um campo a estas telas. Enquanto
 * o login nao o pedir, pedi-lo aqui criaria um caminho que so esta metade do
 * produto conhece.
 */

import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail.')
    .email('E-mail inválido.')
    .max(180, 'Use no máximo 180 caracteres.'),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/**
 * As tres regras de `passwordSchema` mais a confirmacao.
 *
 * A confirmacao e so do cliente — o servidor nao a conhece —, e existe porque a
 * redefinicao derruba todas as sessoes: um erro de digitacao aqui custa o
 * acesso ate lembrar o que foi digitado. E a mesma razao pela qual a troca de
 * senha no perfil tambem a pede.
 */
const resetFields = z.object({
  password: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres.')
    .max(72, 'A senha deve ter no máximo 72 caracteres.')
    .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiuscula.')
    .regex(/[a-z]/, 'A senha deve conter ao menos uma letra minuscula.')
    .regex(/[0-9]/, 'A senha deve conter ao menos um número.'),
  confirmPassword: z.string().min(1, 'Repita a nova senha.'),
});

export const resetPasswordSchema = resetFields.refine(
  (data) => data.password === data.confirmPassword,
  { message: 'As senhas não conferem.', path: ['confirmPassword'] },
);

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function resetPasswordDefaults(): ResetPasswordValues {
  return { password: '', confirmPassword: '' };
}

/** Nomes que cada formulario possui — `applyApiError` usa isto. */
export const FORGOT_FIELDS: ReadonlySet<string> = new Set(Object.keys(forgotPasswordSchema.shape));
export const RESET_FIELDS: ReadonlySet<string> = new Set(Object.keys(resetFields.shape));
