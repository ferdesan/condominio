/**
 * Espelho cliente de `backend/src/modules/condominiums/condominium.schema.ts`.
 *
 * Todo campo entra e sai como string: o formulario e o mesmo objeto do inicio ao
 * fim, entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toCondominiumPayload`, nao aqui.
 *
 * O servidor continua sendo a autoridade — o que este schema evita e a viagem de
 * ida e volta para descobrir o que ja da para responder na hora.
 */

import { z } from 'zod';
import { CONDOMINIUM_STATUSES, CONDOMINIUM_TYPES, type Condominium } from '@/types/api';

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
}

/**
 * Campo opcional que so aceita um numero exato de digitos. A pontuacao e
 * descartada antes da conferencia, do mesmo jeito que o backend faz.
 */
function optionalDigits(length: number, message: string) {
  return z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value === '' || value.length === length, message);
}

export const condominiumSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome do condomínio.').max(150),
  document: optionalDigits(14, 'CNPJ deve conter 14 digitos.'),
  type: z.enum(CONDOMINIUM_TYPES),
  status: z.enum(CONDOMINIUM_STATUSES),
  zipCode: optionalDigits(8, 'CEP deve conter 8 digitos.'),
  street: optionalText(180),
  number: optionalText(20),
  complement: optionalText(120),
  district: optionalText(120),
  city: optionalText(120),
  // O servidor guarda sempre em caixa alta; normalizar aqui evita que o valor
  // exibido apos salvar difira do que foi digitado.
  state: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value === '' || value.length === 2, 'UF deve conter 2 caracteres.'),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine(
      (value) => value === '' || (value.length >= 8 && value.length <= 11),
      'Telefone inválido.',
    ),
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().email().safeParse(value).success,
      'E-mail inválido.',
    ),
  syndicName: optionalText(150),
  syndicPhone: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine(
      (value) => value === '' || (value.length >= 8 && value.length <= 11),
      'Telefone inválido.',
    ),
  syndicTermEndsAt: z
    .string()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Data inválida.'),
  chargeDueDay: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 28,
      'O dia de vencimento deve estar entre 1 e 28.',
    ),
  logoUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().url().safeParse(value).success,
      'Informe uma URL válida.',
    ),
  notes: optionalText(2000),
});

export type CondominiumFormValues = z.infer<typeof condominiumSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const CONDOMINIUM_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(condominiumSchema.shape),
);

export const CONDOMINIUM_FORM_DEFAULTS: CondominiumFormValues = {
  name: '',
  document: '',
  type: 'RESIDENTIAL',
  status: 'ACTIVE',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  phone: '',
  email: '',
  syndicName: '',
  syndicPhone: '',
  syndicTermEndsAt: '',
  chargeDueDay: '10',
  logoUrl: '',
  notes: '',
};

/** Corpo aceito por `POST /condominiums`; a atualizacao e o parcial dele. */
export type CondominiumPayload = {
  name: string;
  document: string | null;
  type: CondominiumFormValues['type'];
  status: CondominiumFormValues['status'];
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  syndicName: string | null;
  syndicPhone: string | null;
  syndicTermEndsAt: string | null;
  chargeDueDay: number;
  logoUrl: string | null;
  notes: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toCondominiumPayload(values: CondominiumFormValues): CondominiumPayload {
  return {
    name: values.name,
    document: orNull(values.document),
    type: values.type,
    status: values.status,
    zipCode: orNull(values.zipCode),
    street: orNull(values.street),
    number: orNull(values.number),
    complement: orNull(values.complement),
    district: orNull(values.district),
    city: orNull(values.city),
    state: orNull(values.state),
    phone: orNull(values.phone),
    email: orNull(values.email),
    syndicName: orNull(values.syndicName),
    syndicPhone: orNull(values.syndicPhone),
    syndicTermEndsAt: orNull(values.syndicTermEndsAt),
    chargeDueDay: Number(values.chargeDueDay),
    logoUrl: orNull(values.logoUrl),
    notes: orNull(values.notes),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toCondominiumFormValues(condominium: Condominium): CondominiumFormValues {
  return {
    name: condominium.name,
    document: condominium.document ?? '',
    type: condominium.type,
    status: condominium.status,
    zipCode: condominium.zipCode ?? '',
    street: condominium.street ?? '',
    number: condominium.number ?? '',
    complement: condominium.complement ?? '',
    district: condominium.district ?? '',
    city: condominium.city ?? '',
    state: condominium.state ?? '',
    phone: condominium.phone ?? '',
    email: condominium.email ?? '',
    syndicName: condominium.syndicName ?? '',
    syndicPhone: condominium.syndicPhone ?? '',
    // A coluna e `date`, entao ja chega como `YYYY-MM-DD`.
    syndicTermEndsAt: condominium.syndicTermEndsAt ?? '',
    chargeDueDay: String(condominium.chargeDueDay),
    logoUrl: condominium.logoUrl ?? '',
    notes: condominium.notes ?? '',
  };
}
