/**
 * Espelho cliente de `backend/src/modules/correspondences/correspondence.schema.ts`.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toCorrespondencePayload`.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 * `deliveredTo` e `deliveredAt` tambem nao: quem os grava e a baixa de entrega,
 * que tem formulario proprio e rota propria.
 */

import { z } from 'zod';
import {
  CORRESPONDENCE_STATUSES,
  CORRESPONDENCE_TYPES,
  type Correspondence,
} from '@/types/correspondence';

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
}

/** Valor do input nativo `datetime-local`: `yyyy-MM-ddTHH:mm`. */
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

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

const correspondenceFields = z.object({
  unitId: z.string().min(1, 'Selecione a unidade destinataria.'),
  // Vinculo opcional: string vazia e a ausencia de destinatario nominal.
  residentId: z.string(),
  type: z.enum(CORRESPONDENCE_TYPES),
  status: z.enum(CORRESPONDENCE_STATUSES),
  carrier: optionalText(120),
  trackingCode: optionalText(60),
  description: optionalText(255),
  // Obrigatorio: a coluna do servidor nao aceita nulo, e o momento do
  // recebimento e a informacao que a portaria de fato registra.
  receivedAt: z
    .string()
    .min(1, 'Informe quando a correspondência chegou.')
    .refine((value) => LOCAL_DATE_TIME.test(value), 'Data e hora invalidas.'),
  receivedBy: optionalText(150),
  photoUrl: optionalUrl(),
  notes: optionalText(1000),
});

export const correspondenceSchema = correspondenceFields;

export type CorrespondenceFormValues = z.infer<typeof correspondenceSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const CORRESPONDENCE_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(correspondenceFields.shape),
);

/** Agora, no formato que o input nativo aceita e no fuso de quem esta digitando. */
export function localNow(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Os padroes sao calculados a cada abertura, e nao guardados num modulo: o
 * recebimento abre no instante em que a portaria abriu o formulario.
 */
export function correspondenceFormDefaults(): CorrespondenceFormValues {
  return {
    unitId: '',
    residentId: '',
    // Os padroes do servidor.
    type: 'PACKAGE',
    status: 'PENDING',
    carrier: '',
    trackingCode: '',
    description: '',
    receivedAt: localNow(),
    receivedBy: '',
    photoUrl: '',
    notes: '',
  };
}

/** Corpo aceito por `POST /correspondences`; a atualizacao e o parcial dele. */
export type CorrespondencePayload = {
  condominiumId: string;
  unitId: string;
  residentId: string | null;
  type: CorrespondenceFormValues['type'];
  status: CorrespondenceFormValues['status'];
  carrier: string | null;
  trackingCode: string | null;
  description: string | null;
  receivedAt: string;
  receivedBy: string | null;
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
export function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** ISO do servidor -> valor que o input `datetime-local` aceita, no fuso local. */
export function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function toCorrespondencePayload(
  values: CorrespondenceFormValues,
  condominiumId: string,
): CorrespondencePayload {
  return {
    condominiumId,
    unitId: values.unitId,
    // Desfazer o vinculo e enviar `null`, nao omitir a chave.
    residentId: orNull(values.residentId),
    type: values.type,
    status: values.status,
    carrier: orNull(values.carrier),
    trackingCode: orNull(values.trackingCode),
    description: orNull(values.description),
    receivedAt: toIso(values.receivedAt),
    receivedBy: orNull(values.receivedBy),
    photoUrl: orNull(values.photoUrl),
    notes: orNull(values.notes),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toCorrespondenceFormValues(
  correspondence: Correspondence,
): CorrespondenceFormValues {
  return {
    unitId: correspondence.unitId,
    residentId: correspondence.residentId ?? '',
    type: correspondence.type,
    status: correspondence.status,
    carrier: correspondence.carrier ?? '',
    trackingCode: correspondence.trackingCode ?? '',
    description: correspondence.description ?? '',
    receivedAt: toLocalDateTime(correspondence.receivedAt),
    receivedBy: correspondence.receivedBy ?? '',
    photoUrl: correspondence.photoUrl ?? '',
    notes: correspondence.notes ?? '',
  };
}

// ---------------------------------------------------------------------------
// Baixa de entrega
// ---------------------------------------------------------------------------

/**
 * Espelho de `deliverCorrespondenceSchema`.
 *
 * `deliveredTo` e obrigatorio no servidor, com minimo de tres caracteres: dar
 * baixa sem dizer quem retirou nao e uma baixa. E por isso que a acao de linha
 * abre um dialogo em vez de postar direto.
 */
export const deliverSchema = z.object({
  deliveredTo: z
    .string()
    .trim()
    .min(3, 'Informe quem retirou a correspondência.')
    .max(150, 'Use no máximo 150 caracteres.'),
  deliveredAt: z
    .string()
    .refine((value) => value === '' || LOCAL_DATE_TIME.test(value), 'Data e hora invalidas.'),
  notes: optionalText(1000),
});

export type DeliverFormValues = z.infer<typeof deliverSchema>;

export const DELIVER_FIELDS: ReadonlySet<string> = new Set(Object.keys(deliverSchema.shape));

/** Corpo aceito por `POST /correspondences/:id/deliver`. */
export type DeliverPayload = {
  deliveredTo: string;
  /** Omitido — e nao nulo — deixa o servidor gravar o instante da baixa. */
  deliveredAt?: string;
  notes: string | null;
};

export function toDeliverPayload(values: DeliverFormValues): DeliverPayload {
  return {
    deliveredTo: values.deliveredTo,
    ...(values.deliveredAt === '' ? {} : { deliveredAt: toIso(values.deliveredAt) }),
    notes: orNull(values.notes),
  };
}
