/**
 * Espelho cliente de `backend/src/modules/units/unit.schema.ts`.
 *
 * Como no cadastro de condominios, todo campo do formulario e string e a
 * conversao para o corpo da requisicao acontece em `toUnitPayload`. O servidor
 * continua sendo a autoridade; o que este schema evita e a viagem de ida e volta
 * para descobrir o que ja da para responder na hora.
 *
 * `status` merece uma nota: o modulo de moradores recalcula ocupada/vaga a cada
 * mudanca de morador e sobrescreve o que foi digitado, mas nao toca em reforma
 * nem bloqueada. Os quatro valores continuam sendo oferecidos porque os dois
 * primeiros sao enviaveis — o que a tela nao pode fazer e prometer que o valor
 * enviado e o que ficara guardado. Quem manda no que aparece depois de salvar e
 * a resposta do servidor.
 */

import { z } from 'zod';
import { UNIT_STATUSES, UNIT_TYPES, type Unit, type UnitStatus, type UnitType } from '@/types/api';

export const UNIT_MIN_FLOOR = -10;
export const UNIT_MAX_FLOOR = 200;
export const UNIT_MAX_NUMBER_LENGTH = 20;

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  APARTMENT: 'Apartamento',
  HOUSE: 'Casa',
  COMMERCIAL: 'Comercial',
  PARKING: 'Vaga',
  STORAGE: 'Deposito',
};

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  OCCUPIED: 'Ocupada',
  VACANT: 'Vaga',
  RENOVATION: 'Em reforma',
  BLOCKED: 'Bloqueada',
};

/** Inteiro obrigatorio dentro de uma faixa, digitado como texto. */
function intInRange(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => /^-?\d+$/.test(value) && Number(value) >= min && Number(value) <= max,
      message,
    );
}

/** Decimal opcional: vazio e ausencia, nao erro. Aceita virgula como separador. */
function optionalDecimalInRange(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .transform((value) => value.replace(',', '.'))
    .refine((value) => {
      if (value === '') return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= min && parsed <= max;
    }, message);
}

export const unitSchema = z.object({
  blockId: z.string().min(1, 'Selecione o bloco da unidade.'),
  number: z
    .string()
    .trim()
    .min(1, 'Informe o numero da unidade.')
    .max(UNIT_MAX_NUMBER_LENGTH, `Use no maximo ${UNIT_MAX_NUMBER_LENGTH} caracteres.`),
  floor: intInRange(
    UNIT_MIN_FLOOR,
    UNIT_MAX_FLOOR,
    `O andar deve estar entre ${UNIT_MIN_FLOOR} e ${UNIT_MAX_FLOOR}.`,
  ),
  type: z.enum(UNIT_TYPES),
  status: z.enum(UNIT_STATUSES),
  area: optionalDecimalInRange(0, 100000, 'A area deve estar entre 0 e 100000.'),
  idealFraction: optionalDecimalInRange(0, 1, 'A fracao ideal deve estar entre 0 e 1.'),
  monthlyFee: optionalDecimalInRange(0, 999999.99, 'A taxa deve estar entre 0 e 999999,99.'),
  bedrooms: intInRange(0, 20, 'Os dormitorios devem estar entre 0 e 20.'),
  parkingSpots: intInRange(0, 20, 'As vagas devem estar entre 0 e 20.'),
  petsAllowed: z.boolean(),
  notes: z.string().trim().max(2000, 'Use no maximo 2000 caracteres.'),
});

export type UnitFormValues = z.infer<typeof unitSchema>;

/** Campos que o formulario possui — `applyApiError` decide por aqui o destino da mensagem. */
export const UNIT_FIELDS: ReadonlySet<string> = new Set(Object.keys(unitSchema.shape));

export const UNIT_FORM_DEFAULTS: UnitFormValues = {
  blockId: '',
  number: '',
  floor: '0',
  type: 'APARTMENT',
  status: 'VACANT',
  area: '',
  idealFraction: '',
  monthlyFee: '0',
  bedrooms: '0',
  parkingSpots: '0',
  petsAllowed: true,
  notes: '',
};

/** Corpo aceito por `POST /units`; a atualizacao e o parcial dele. */
export type UnitPayload = {
  condominiumId: string;
  blockId: string;
  number: string;
  floor: number;
  type: UnitType;
  status: UnitStatus;
  area: number | null;
  idealFraction: number | null;
  monthlyFee: number;
  bedrooms: number;
  parkingSpots: number;
  petsAllowed: boolean;
  notes: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function numberOrNull(value: string): number | null {
  return value === '' ? null : Number(value);
}

export function toUnitPayload(values: UnitFormValues, condominiumId: string): UnitPayload {
  return {
    condominiumId,
    blockId: values.blockId,
    number: values.number,
    floor: Number(values.floor),
    type: values.type,
    status: values.status,
    area: numberOrNull(values.area),
    idealFraction: numberOrNull(values.idealFraction),
    monthlyFee: values.monthlyFee === '' ? 0 : Number(values.monthlyFee),
    bedrooms: Number(values.bedrooms),
    parkingSpots: Number(values.parkingSpots),
    petsAllowed: values.petsAllowed,
    notes: values.notes === '' ? null : values.notes,
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toUnitFormValues(unit: Unit): UnitFormValues {
  return {
    blockId: unit.blockId,
    number: unit.number,
    floor: String(unit.floor),
    type: unit.type,
    status: unit.status,
    area: unit.area === null ? '' : String(unit.area),
    idealFraction: unit.idealFraction === null ? '' : String(unit.idealFraction),
    monthlyFee: String(unit.monthlyFee),
    bedrooms: String(unit.bedrooms),
    parkingSpots: String(unit.parkingSpots),
    petsAllowed: unit.petsAllowed,
    notes: unit.notes ?? '',
  };
}
