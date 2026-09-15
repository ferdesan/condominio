/**
 * Espelho cliente de `updateProfileSchema` e `changePasswordSchema`, em
 * `backend/src/modules/auth/auth.schema.ts`.
 *
 * Sao **dois** formularios e nao um: o servidor tem duas rotas, com efeitos
 * muito diferentes — salvar o nome nao mexe em sessao nenhuma, trocar a senha
 * derruba todas. Junta-los num submit so daria ao botao "Salvar" a chance de
 * deslogar quem so queria corrigir o telefone.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta. A conversao para o corpo da requisicao acontece nas
 * funcoes `to*Payload`.
 */

import { z } from 'zod';
import type { AuthUser, UserPreferences } from '@/types/api';

export const THEMES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEMES)[number];

// ---------------------------------------------------------------------------
// Dados pessoais
// ---------------------------------------------------------------------------

/**
 * O que `PATCH /auth/me` aceita, menos o que a tela nao oferece.
 *
 * **E-mail nao esta aqui porque o servidor nao o aceita.** `updateProfileSchema`
 * conhece `name`, `phone`, `avatarUrl` e `preferences` — e so. Trocar o endereco
 * de acesso e acao administrativa, em `/usuarios`, sob `user:update`.
 *
 * **`avatarUrl` tambem fica de fora.** O servidor exige uma URL valida e nao ha
 * rota de upload: o campo so aceitaria um endereco colado de outro lugar. A
 * mesma decisao ja valia no cadastro de usuarios.
 */
const profileFields = z.object({
  name: z.string().trim().min(3, 'Informe seu nome.').max(150, 'Use no maximo 150 caracteres.'),
  /** Opcional, mas o servidor exige forma quando presente (`phoneSchema`). */
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || value.replace(/\D/g, '').length >= 8, {
      message: 'Telefone invalido.',
    })
    .refine((value) => value.length <= 20, { message: 'Use no maximo 20 caracteres.' }),
  theme: z.enum(THEMES),
});

export const profileSchema = profileFields;
export type ProfileFormValues = z.infer<typeof profileSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto. */
export const PROFILE_FIELDS: ReadonlySet<string> = new Set(Object.keys(profileFields.shape));

/**
 * Valores iniciais.
 *
 * O tema vem do provedor, e nao de `user.preferences`: o que a tela deve mostrar
 * e o que esta aplicado agora. Quem alternou na topbar e abriu o perfil veria um
 * seletor desmentindo a propria tela se lessemos a conta aqui.
 */
export function toProfileFormValues(
  user: AuthUser,
  appliedTheme: ThemePreference,
): ProfileFormValues {
  return {
    name: user.name,
    phone: user.phone ?? '',
    theme: appliedTheme,
  };
}

export type ProfilePayload = {
  name: string;
  /** Vazio vira `null`, e nunca chave ausente: limpar o campo precisa apagar o valor. */
  phone: string | null;
  /** Mesclado no servidor com o que ja existe, entao mandar so o tema preserva o resto. */
  preferences: UserPreferences;
};

export function toProfilePayload(values: ProfileFormValues): ProfilePayload {
  return {
    name: values.name.trim(),
    phone: values.phone.trim() === '' ? null : values.phone.trim(),
    preferences: { theme: values.theme },
  };
}

// ---------------------------------------------------------------------------
// Senha
// ---------------------------------------------------------------------------

/**
 * As tres regras de `passwordSchema` mais as duas do `changePasswordSchema`.
 *
 * A confirmacao e so do cliente — o servidor nao a conhece —, e existe porque a
 * troca derruba todas as sessoes: um erro de digitacao aqui custa o acesso ate
 * lembrar o que foi digitado.
 */
const passwordFields = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(72),
  newPassword: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres.')
    .max(72, 'A senha deve ter no maximo 72 caracteres.')
    .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiuscula.')
    .regex(/[a-z]/, 'A senha deve conter ao menos uma letra minuscula.')
    .regex(/[0-9]/, 'A senha deve conter ao menos um numero.'),
  confirmPassword: z.string().min(1, 'Repita a nova senha.'),
});

export const passwordSchema = passwordFields
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da atual.',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas nao conferem.',
    path: ['confirmPassword'],
  });

export type PasswordFormValues = z.infer<typeof passwordSchema>;

export const PASSWORD_FIELDS: ReadonlySet<string> = new Set(Object.keys(passwordFields.shape));

export function passwordFormDefaults(): PasswordFormValues {
  return { currentPassword: '', newPassword: '', confirmPassword: '' };
}

/** `confirmPassword` nao vai para o servidor: ele nao a conhece. */
export function toPasswordPayload(values: PasswordFormValues): {
  currentPassword: string;
  newPassword: string;
} {
  return { currentPassword: values.currentPassword, newPassword: values.newPassword };
}
