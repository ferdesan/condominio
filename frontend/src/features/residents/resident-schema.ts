/**
 * Espelho cliente de `backend/src/modules/residents/resident.schema.ts`.
 *
 * Mesma convencao do schema de condominios: todo campo entra e sai como string
 * (exceto o booleano de responsavel), entao `z.infer` basta e o `useForm`
 * precisa de um generico so. A conversao para o corpo da requisicao acontece em
 * `toResidentPayload`.
 *
 * Tres regras existem apenas aqui, porque o servidor nao as tem: saida antes da
 * entrada, nascimento no futuro e saida ausente em quem consta como mudado. Sao
 * inconsistencias que ele aceitaria em silencio.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 * `lgpdConsentAt` tambem nao: o servidor o grava sozinho quando ha CPF ou
 * e-mail, e apresenta-lo como editavel seria mentira.
 */

import { z } from 'zod';
import { RESIDENT_STATUSES, RESIDENT_TYPES, type Resident } from '@/types/api';

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no maximo ${max} caracteres.`);
}

/** Telefone opcional. A pontuacao e descartada, como o backend faz. */
function optionalPhone() {
  return z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine(
      (value) => value === '' || (value.length >= 8 && value.length <= 11),
      'Telefone invalido.',
    );
}

/** Coluna `date` no servidor: o formato do input nativo ja e o que ele aceita. */
function optionalDate() {
  return z
    .string()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Data invalida.');
}

/**
 * Hoje em `YYYY-MM-DD` no fuso local.
 *
 * `toISOString` sozinho devolveria o dia em UTC, que em fusos negativos ainda e
 * "amanha" durante boa parte da tarde — e uma data de nascimento de hoje seria
 * recusada como futura.
 */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Datas `YYYY-MM-DD` comparam corretamente como texto: o formato e de tamanho
 * fixo e ordenado do campo mais significativo para o menos.
 */
const residentFields = z.object({
  unitId: z.string().min(1, 'Selecione a unidade do morador.'),
  name: z.string().trim().min(3, 'Informe o nome do morador.').max(150),
  document: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value === '' || value.length === 11, 'CPF deve conter 11 digitos.'),
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().email().safeParse(value).success,
      'E-mail invalido.',
    ),
  phone: optionalPhone(),
  birthDate: optionalDate(),
  type: z.enum(RESIDENT_TYPES),
  status: z.enum(RESIDENT_STATUSES),
  isPrimary: z.boolean(),
  moveInDate: optionalDate(),
  moveOutDate: optionalDate(),
  emergencyContact: optionalText(150),
  emergencyPhone: optionalPhone(),
  photoUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().url().safeParse(value).success,
      'Informe uma URL valida.',
    ),
  notes: optionalText(2000),
});

export const residentSchema = residentFields.superRefine((values, ctx) => {
  if (values.moveInDate && values.moveOutDate && values.moveOutDate < values.moveInDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['moveOutDate'],
      message: 'A data de saida nao pode ser anterior a data de entrada.',
    });
  }

  if (values.birthDate && values.birthDate > todayIso()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birthDate'],
      message: 'A data de nascimento nao pode estar no futuro.',
    });
  }

  // Mudado sem data de saida e um estado que o servidor aceita e ninguem
  // consegue interpretar depois. A objecao cai na data porque e o que falta.
  if (values.status === 'MOVED_OUT' && !values.moveOutDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['moveOutDate'],
      message: 'Informe a data de saida de um morador que consta como mudado.',
    });
  }
});

export type ResidentFormValues = z.infer<typeof residentSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const RESIDENT_FIELDS: ReadonlySet<string> = new Set(Object.keys(residentFields.shape));

export const RESIDENT_FORM_DEFAULTS: ResidentFormValues = {
  unitId: '',
  name: '',
  document: '',
  email: '',
  phone: '',
  birthDate: '',
  // Os padroes documentados no PRD: proprietario e ativo.
  type: 'OWNER',
  status: 'ACTIVE',
  isPrimary: false,
  moveInDate: '',
  moveOutDate: '',
  emergencyContact: '',
  emergencyPhone: '',
  photoUrl: '',
  notes: '',
};

/** Corpo aceito por `POST /residents`; a atualizacao e o parcial dele. */
export type ResidentPayload = {
  condominiumId: string;
  unitId: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  type: ResidentFormValues['type'];
  status: ResidentFormValues['status'];
  isPrimary: boolean;
  moveInDate: string | null;
  moveOutDate: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  photoUrl: string | null;
  notes: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toResidentPayload(
  values: ResidentFormValues,
  condominiumId: string,
): ResidentPayload {
  return {
    condominiumId,
    unitId: values.unitId,
    name: values.name,
    document: orNull(values.document),
    email: orNull(values.email),
    phone: orNull(values.phone),
    birthDate: orNull(values.birthDate),
    type: values.type,
    status: values.status,
    isPrimary: values.isPrimary,
    moveInDate: orNull(values.moveInDate),
    moveOutDate: orNull(values.moveOutDate),
    emergencyContact: orNull(values.emergencyContact),
    emergencyPhone: orNull(values.emergencyPhone),
    photoUrl: orNull(values.photoUrl),
    notes: orNull(values.notes),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toResidentFormValues(resident: Resident): ResidentFormValues {
  return {
    unitId: resident.unitId,
    name: resident.name,
    document: resident.document ?? '',
    email: resident.email ?? '',
    phone: resident.phone ?? '',
    birthDate: resident.birthDate ?? '',
    type: resident.type,
    status: resident.status,
    isPrimary: resident.isPrimary,
    moveInDate: resident.moveInDate ?? '',
    moveOutDate: resident.moveOutDate ?? '',
    emergencyContact: resident.emergencyContact ?? '',
    emergencyPhone: resident.emergencyPhone ?? '',
    photoUrl: resident.photoUrl ?? '',
    notes: resident.notes ?? '',
  };
}

/**
 * Prepara um termo de busca que aparenta ser documento ou telefone.
 *
 * CPFs e telefones sao guardados sem pontuacao, entao `123.456.789-09` nao
 * casaria com nada. Um termo composto so de digitos e separadores e reduzido
 * aos digitos; qualquer outro — um nome, um e-mail — passa intacto, porque a
 * busca cobre os quatro campos de uma vez.
 */
export function normaliseDocument(term: string): string {
  const trimmed = term.trim();
  if (!/^[\d.\-/()\s]+$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits === '' ? trimmed : digits;
}
