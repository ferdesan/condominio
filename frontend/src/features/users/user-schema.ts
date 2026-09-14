/**
 * Espelho cliente de `backend/src/modules/users/user.schema.ts`.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string
 * (ou lista de strings), entao `z.infer` basta e o `useForm` precisa de um
 * generico so. A conversao para o corpo da requisicao acontece em
 * `toUserPayload`.
 *
 * **Senha nao e campo.** `createUserSchema` a aceita como opcional e
 * `updateUserSchema` a omite por completo; a tela nao a oferece em nenhum dos
 * dois casos. Omitida na criacao, o servidor gera uma temporaria e a devolve uma
 * unica vez, ja marcando a troca no primeiro acesso — e o reset administrativo,
 * que exige `user:manage`, e a unica via depois disso. Um campo de senha em
 * texto seria uma segunda via, mais fraca e sem aquele gate.
 *
 * `condominiumId` tambem nao existe aqui: este recurso e por tenant.
 */

import { z } from 'zod';
import { USER_STATUSES, type User } from '@/types/user';

const DOCUMENT_DIGITS = 11;

const userFields = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Informe o nome do usuario.')
    .max(150, 'Use no maximo 150 caracteres.'),
  email: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail do usuario.')
    .email('E-mail invalido.')
    .max(180, 'Use no maximo 180 caracteres.'),
  /** Opcional, mas o servidor exige forma quando presente (`phoneSchema`). */
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || value.replace(/\D/g, '').length >= 8, {
      message: 'Telefone invalido.',
    })
    .refine((value) => value.length <= 20, { message: 'Use no maximo 20 caracteres.' }),
  /** CPF: o servidor normaliza para digitos e exige exatamente onze. */
  document: z
    .string()
    .trim()
    .refine((value) => value === '' || value.replace(/\D/g, '').length === DOCUMENT_DIGITS, {
      message: 'CPF deve conter 11 digitos.',
    }),
  roleId: z.string().min(1, 'Selecione o papel de acesso.'),
  status: z.enum(USER_STATUSES),
  /** Vazio significa "sem unidade": o seletor usa string vazia, o corpo usa `null`. */
  unitId: z.string(),
  /** Vazio significa "todos os condominios do tenant", e nao "nenhum". */
  condominiumIds: z.array(z.string()),
});

export const userSchema = userFields;

export type UserFormValues = z.infer<typeof userSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const USER_FIELDS: ReadonlySet<string> = new Set(Object.keys(userFields.shape));

/** Os padroes sao os do servidor: conta ativa e sem vinculos. */
export function userFormDefaults(): UserFormValues {
  return {
    name: '',
    email: '',
    phone: '',
    document: '',
    roleId: '',
    status: 'ACTIVE',
    unitId: '',
    condominiumIds: [],
  };
}

/**
 * Corpo aceito por `POST /users`; a atualizacao e o parcial dele.
 *
 * `password` e `mustChangePassword` ficam de fora: o servidor cuida dos dois
 * quando a senha nao vem, e o reset administrativo e a unica via de troca.
 * `avatarUrl` tambem fica de fora — nao ha requisito de imagem nesta entrega.
 */
export type UserPayload = {
  name: string;
  email: string;
  /** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor. */
  phone: string | null;
  document: string | null;
  roleId: string;
  status: UserFormValues['status'];
  unitId: string | null;
  condominiumIds: string[];
};

function orNull(value: string): string | null {
  return value === '' ? null : value;
}

/** O servidor guarda apenas digitos no CPF; mandar o mascarado o faria recusar. */
function digitsOrNull(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  return digits === '' ? null : digits;
}

export function toUserPayload(values: UserFormValues): UserPayload {
  return {
    name: values.name,
    email: values.email,
    phone: orNull(values.phone),
    document: digitsOrNull(values.document),
    roleId: values.roleId,
    status: values.status,
    unitId: orNull(values.unitId),
    condominiumIds: values.condominiumIds,
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toUserFormValues(user: User): UserFormValues {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    document: user.document ?? '',
    roleId: user.roleId,
    status: user.status,
    unitId: user.unitId ?? '',
    condominiumIds: (user.condominiums ?? []).map((item) => item.id),
  };
}
