/**
 * Espelho cliente de `backend/src/modules/blocks/block.schema.ts`.
 *
 * Blocos nao tem modulo proprio: eles vivem aqui porque cadastrar unidade exige
 * um bloco e nao ha outra tela que os crie (ADR-007). O conjunto de campos e o
 * que o cadastro de unidades precisa — nome, tipo, andares, unidades por andar e
 * elevador — e nada alem disso.
 *
 * Mesma convencao do schema de condominios: todo campo entra e sai como string,
 * e a conversao para o corpo da requisicao mora em `toBlockPayload`.
 */

import { z } from 'zod';
import { BLOCK_TYPES, type Block } from '@/types/api';

/** Faixa de andares do bloco. Nao confundir com a da geracao em lote, que vai ate 100. */
export const BLOCK_MIN_FLOORS = 1;
export const BLOCK_MAX_FLOORS = 200;
export const BLOCK_MAX_UNITS_PER_FLOOR = 100;

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

export const blockSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome do bloco.')
    .max(80, 'Use no maximo 80 caracteres.'),
  type: z.enum(BLOCK_TYPES),
  description: z.string().trim().max(255, 'Use no maximo 255 caracteres.'),
  floors: intInRange(
    BLOCK_MIN_FLOORS,
    BLOCK_MAX_FLOORS,
    `O numero de andares deve estar entre ${BLOCK_MIN_FLOORS} e ${BLOCK_MAX_FLOORS}.`,
  ),
  unitsPerFloor: intInRange(
    0,
    BLOCK_MAX_UNITS_PER_FLOOR,
    `As unidades por andar devem estar entre 0 e ${BLOCK_MAX_UNITS_PER_FLOOR}.`,
  ),
  hasElevator: z.boolean(),
});

export type BlockFormValues = z.infer<typeof blockSchema>;

/** Campos que o formulario possui — `applyApiError` decide por aqui o destino da mensagem. */
export const BLOCK_FIELDS: ReadonlySet<string> = new Set(Object.keys(blockSchema.shape));

export const BLOCK_FORM_DEFAULTS: BlockFormValues = {
  name: '',
  type: 'BLOCK',
  description: '',
  floors: '1',
  unitsPerFloor: '0',
  hasElevator: false,
};

export const BLOCK_TYPE_LABELS: Record<BlockFormValues['type'], string> = {
  BLOCK: 'Bloco',
  TOWER: 'Torre',
  WING: 'Ala',
  STREET: 'Rua',
};

/** Corpo aceito por `POST /blocks`; a atualizacao e o parcial dele. */
export type BlockPayload = {
  condominiumId: string;
  name: string;
  type: BlockFormValues['type'];
  description: string | null;
  floors: number;
  unitsPerFloor: number;
  hasElevator: boolean;
};

export function toBlockPayload(values: BlockFormValues, condominiumId: string): BlockPayload {
  return {
    condominiumId,
    name: values.name,
    type: values.type,
    description: values.description === '' ? null : values.description,
    floors: Number(values.floors),
    unitsPerFloor: Number(values.unitsPerFloor),
    hasElevator: values.hasElevator,
  };
}

export function toBlockFormValues(block: Block): BlockFormValues {
  return {
    name: block.name,
    type: block.type,
    description: block.description ?? '',
    floors: String(block.floors),
    unitsPerFloor: String(block.unitsPerFloor),
    hasElevator: block.hasElevator,
  };
}

/**
 * Bloco inicial de um formulario de unidade ou de geracao. Com um unico bloco
 * cadastrado nao ha escolha a fazer — deixar o campo vazio so obrigaria a
 * preencher o unico valor possivel. Com nenhum ou com varios, quem escolhe e o
 * operador.
 */
export function defaultBlockId(blocks: Block[]): string {
  return blocks.length === 1 ? blocks[0].id : '';
}
