/**
 * Espelho cliente de `bulkCreateUnitsSchema`
 * (`backend/src/modules/units/unit.schema.ts`).
 *
 * A geracao e o caminho de onboarding (ADR-005): sem ela, registrar um predio de
 * 120 unidades significa 120 envios de dialogo. O que a tela precisa antecipar,
 * e por isso mora aqui, e a contagem projetada — o operador confirma sabendo
 * quantas unidades serao pedidas — e o comprimento dos numeros gerados, que o
 * servidor limita a 20 caracteres por unidade e recusaria so no meio do lote.
 */

import { z } from 'zod';
import { UNIT_TYPES, type UnitType } from '@/types/api';

export const BULK_MIN_FLOORS = 1;
export const BULK_MAX_FLOORS = 100;
export const BULK_MIN_UNITS_PER_FLOOR = 1;
export const BULK_MAX_UNITS_PER_FLOOR = 50;
export const BULK_MIN_START_FLOOR = 0;
export const BULK_MAX_START_FLOOR = 100;
export const BULK_MAX_NUMBER_LENGTH = 20;
export const DEFAULT_NUMBER_PATTERN = '{floor}{index}';

/**
 * A partir de qual tamanho a operacao deixa de ser instantanea. Acima disso a
 * tela precisa mostrar progresso em vez de parecer travada.
 */
export const BULK_LARGE_GRID = 500;

function intInRange(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => /^-?\d+$/.test(value) && Number(value) >= min && Number(value) <= max,
      message,
    );
}

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

/**
 * Compoe um numero do lote. O indice vai com zero a esquerda em duas casas, que
 * e o que `unit.service.ts` faz ao montar a mesma string.
 */
export function composeUnitNumber(pattern: string, floor: number, index: number): string {
  return pattern
    .replace('{floor}', String(floor))
    .replace('{index}', String(index).padStart(2, '0'));
}

/** Quantas unidades o lote pede. Quantas serao criadas so o servidor sabe. */
export function projectedUnitCount(floors: number, unitsPerFloor: number): number {
  if (!Number.isFinite(floors) || !Number.isFinite(unitsPerFloor)) return 0;
  if (floors < 1 || unitsPerFloor < 1) return 0;
  return floors * unitsPerFloor;
}

/**
 * O numero mais longo que o padrao produzira. Andar e indice crescem para a
 * direita, entao o ultimo de cada um da o pior caso.
 */
export function longestGeneratedNumber(values: {
  pattern: string;
  floors: number;
  unitsPerFloor: number;
  startFloor: number;
}): string {
  const lastFloor = values.startFloor + values.floors - 1;
  return composeUnitNumber(values.pattern, lastFloor, values.unitsPerFloor);
}

const baseBulkGenerateSchema = z.object({
  blockId: z.string().min(1, 'Selecione o bloco que recebera as unidades.'),
  floors: intInRange(
    BULK_MIN_FLOORS,
    BULK_MAX_FLOORS,
    `O numero de andares deve estar entre ${BULK_MIN_FLOORS} e ${BULK_MAX_FLOORS}.`,
  ),
  unitsPerFloor: intInRange(
    BULK_MIN_UNITS_PER_FLOOR,
    BULK_MAX_UNITS_PER_FLOOR,
    `As unidades por andar devem estar entre ${BULK_MIN_UNITS_PER_FLOOR} e ${BULK_MAX_UNITS_PER_FLOOR}.`,
  ),
  startFloor: intInRange(
    BULK_MIN_START_FLOOR,
    BULK_MAX_START_FLOOR,
    `O andar inicial deve estar entre ${BULK_MIN_START_FLOOR} e ${BULK_MAX_START_FLOOR}.`,
  ),
  numberPattern: z
    .string()
    .trim()
    .min(1, 'Informe o padrao de numeracao.')
    .max(30, 'Use no maximo 30 caracteres.'),
  type: z.enum(UNIT_TYPES),
  monthlyFee: optionalDecimalInRange(0, 999999.99, 'A taxa deve estar entre 0 e 999999,99.'),
  area: optionalDecimalInRange(0, 100000, 'A area deve estar entre 0 e 100000.'),
});

export const bulkGenerateSchema = baseBulkGenerateSchema.superRefine((values, ctx) => {
  const floors = Number(values.floors);
  const unitsPerFloor = Number(values.unitsPerFloor);
  const startFloor = Number(values.startFloor);
  // Sem faixas validas nao ha numero a conferir: as mensagens acima ja respondem.
  if (!Number.isFinite(floors) || !Number.isFinite(unitsPerFloor) || !Number.isFinite(startFloor)) {
    return;
  }

  const longest = longestGeneratedNumber({
    pattern: values.numberPattern,
    floors,
    unitsPerFloor,
    startFloor,
  });

  if (longest.length > BULK_MAX_NUMBER_LENGTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['numberPattern'],
      message: `O padrao produz o numero "${longest}", com ${longest.length} caracteres. O limite e ${BULK_MAX_NUMBER_LENGTH}.`,
    });
  }
});

export type BulkGenerateFormValues = z.infer<typeof baseBulkGenerateSchema>;

export const BULK_GENERATE_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(baseBulkGenerateSchema.shape),
);

export const BULK_GENERATE_FORM_DEFAULTS: BulkGenerateFormValues = {
  blockId: '',
  floors: '1',
  unitsPerFloor: '1',
  startFloor: '1',
  numberPattern: DEFAULT_NUMBER_PATTERN,
  type: 'APARTMENT',
  monthlyFee: '0',
  area: '',
};

/** Corpo aceito por `POST /units/bulk`. */
export type BulkGeneratePayload = {
  condominiumId: string;
  blockId: string;
  floors: number;
  unitsPerFloor: number;
  startFloor: number;
  numberPattern: string;
  type: UnitType;
  monthlyFee: number;
  area: number | null;
};

export function toBulkGeneratePayload(
  values: BulkGenerateFormValues,
  condominiumId: string,
): BulkGeneratePayload {
  return {
    condominiumId,
    blockId: values.blockId,
    floors: Number(values.floors),
    unitsPerFloor: Number(values.unitsPerFloor),
    startFloor: Number(values.startFloor),
    numberPattern: values.numberPattern,
    type: values.type,
    monthlyFee: values.monthlyFee === '' ? 0 : Number(values.monthlyFee),
    area: values.area === '' ? null : Number(values.area),
  };
}
