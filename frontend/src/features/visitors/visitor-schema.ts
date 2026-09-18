/**
 * Espelho cliente de `backend/src/modules/visitors/visitor.schema.ts`.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toVisitorPayload`, que e onde os
 * campos vazios viram `null` e as datas locais voltam a ser ISO.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell. O codigo
 * de acesso tambem nao: o servidor o gera sozinho quando a visita e cadastrada
 * como prevista, e apresenta-lo como editavel seria mentira.
 *
 * Uma regra existe dos dois lados porque o servidor a recusa sem apontar campo:
 * o fim do periodo previsto tem de ser depois do inicio. Dita no campo, ela tem
 * conserto obvio; vinda como 409, seria so uma frase no rodape.
 */

import { z } from 'zod';
import { VISITOR_STATUSES, VISITOR_TYPES, type Visitor } from '@/types/visitor';

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
}

/** CPF opcional. A pontuacao e descartada, como o backend faz. */
function optionalDocument() {
  return z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value === '' || value.length === 11, 'CPF deve conter 11 digitos.');
}

/** Telefone opcional, tambem sem pontuacao. */
function optionalPhone() {
  return z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine(
      (value) => value === '' || (value.length >= 8 && value.length <= 11),
      'Telefone inválido.',
    );
}

/** Valor do input nativo `datetime-local`: `yyyy-MM-ddTHH:mm`. */
function optionalDateTime() {
  return z
    .string()
    .refine(
      (value) => value === '' || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value),
      'Data e hora invalidas.',
    );
}

/** URL opcional da foto capturada na portaria. */
function optionalUrl() {
  return z
    .string()
    .trim()
    .max(255, 'Use no máximo 255 caracteres.')
    .refine(
      (value) => value === '' || z.string().url().safeParse(value).success,
      'Informe uma URL válida.',
    );
}

const visitorFields = z.object({
  unitId: z.string().min(1, 'Selecione a unidade de destino.'),
  name: z.string().trim().min(3, 'Informe o nome do visitante.').max(150),
  document: optionalDocument(),
  phone: optionalPhone(),
  type: z.enum(VISITOR_TYPES),
  status: z.enum(VISITOR_STATUSES),
  company: optionalText(120),
  vehiclePlate: optionalText(10),
  expectedAt: optionalDateTime(),
  expectedUntil: optionalDateTime(),
  badgeNumber: optionalText(30),
  photoUrl: optionalUrl(),
  notes: optionalText(1000),
});

/**
 * Datas locais `yyyy-MM-ddTHH:mm` comparam corretamente como texto: o formato e
 * de tamanho fixo e ordenado do campo mais significativo para o menos.
 */
export const visitorSchema = visitorFields.refine(
  (values) =>
    values.expectedAt === '' ||
    values.expectedUntil === '' ||
    values.expectedUntil > values.expectedAt,
  { path: ['expectedUntil'], message: 'O fim do período deve ser depois do início.' },
);

export type VisitorFormValues = z.infer<typeof visitorSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const VISITOR_FIELDS: ReadonlySet<string> = new Set(Object.keys(visitorFields.shape));

export const VISITOR_FORM_DEFAULTS: VisitorFormValues = {
  unitId: '',
  name: '',
  document: '',
  phone: '',
  // Os padroes do servidor.
  type: 'VISITOR',
  status: 'EXPECTED',
  company: '',
  vehiclePlate: '',
  expectedAt: '',
  expectedUntil: '',
  badgeNumber: '',
  photoUrl: '',
  notes: '',
};

/** Corpo aceito por `POST /visitors`; a atualizacao e o parcial dele. */
export type VisitorPayload = {
  condominiumId: string;
  unitId: string;
  name: string;
  document: string | null;
  phone: string | null;
  type: VisitorFormValues['type'];
  status: VisitorFormValues['status'];
  company: string | null;
  vehiclePlate: string | null;
  expectedAt: string | null;
  expectedUntil: string | null;
  badgeNumber: string | null;
  photoUrl: string | null;
  notes: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

/**
 * O input nativo entrega hora local sem fuso; `new Date` a interpreta no fuso
 * da maquina, que e o que quem digitou quis dizer. O servidor recebe ISO.
 */
function toIso(value: string): string | null {
  if (value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toVisitorPayload(values: VisitorFormValues, condominiumId: string): VisitorPayload {
  return {
    condominiumId,
    unitId: values.unitId,
    name: values.name,
    document: orNull(values.document),
    phone: orNull(values.phone),
    type: values.type,
    status: values.status,
    company: orNull(values.company),
    vehiclePlate: orNull(values.vehiclePlate),
    expectedAt: toIso(values.expectedAt),
    expectedUntil: toIso(values.expectedUntil),
    badgeNumber: orNull(values.badgeNumber),
    photoUrl: orNull(values.photoUrl),
    notes: orNull(values.notes),
  };
}

/** ISO do servidor -> valor que o input `datetime-local` aceita, no fuso local. */
function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toVisitorFormValues(visitor: Visitor): VisitorFormValues {
  return {
    unitId: visitor.unitId,
    name: visitor.name,
    document: visitor.document ?? '',
    phone: visitor.phone ?? '',
    type: visitor.type,
    status: visitor.status,
    company: visitor.company ?? '',
    vehiclePlate: visitor.vehiclePlate ?? '',
    expectedAt: toLocalDateTime(visitor.expectedAt),
    expectedUntil: toLocalDateTime(visitor.expectedUntil),
    badgeNumber: visitor.badgeNumber ?? '',
    photoUrl: visitor.photoUrl ?? '',
    notes: visitor.notes ?? '',
  };
}
