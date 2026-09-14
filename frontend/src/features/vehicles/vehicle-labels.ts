/** Rotulos de veiculo, compartilhados pela listagem, os filtros e o formulario. */

import type { Unit, VehicleStatus, VehicleType } from '@/types/api';

export const TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'Carro',
  MOTORCYCLE: 'Moto',
  TRUCK: 'Caminhao',
  BICYCLE: 'Bicicleta',
  OTHER: 'Outro',
};

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

/** Dito na coluna do vinculo quando o veiculo nao tem dono cadastrado. */
export const NO_LINK = 'Sem vinculo';

/** Dito quando havia vinculo e a unidade referida foi removida. */
export const UNIT_REMOVED = 'Unidade removida';

/** O bloco desambigua numeros repetidos entre torres; sem ele, some. */
export function unitLabel(unit: Pick<Unit, 'number' | 'block'>): string {
  return unit.block?.name ? `${unit.block.name} - ${unit.number}` : unit.number;
}
