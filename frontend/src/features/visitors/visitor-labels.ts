/** Rotulos de visitante, compartilhados pela listagem, os filtros e o formulario. */

import type { Unit } from '@/types/api';
import type { VisitorStatus, VisitorType } from '@/types/visitor';

export const TYPE_LABELS: Record<VisitorType, string> = {
  VISITOR: 'Visitante',
  DELIVERY: 'Entrega',
  SERVICE: 'Servico',
  BROKER: 'Corretor',
  OTHER: 'Outro',
};

export const STATUS_LABELS: Record<VisitorStatus, string> = {
  EXPECTED: 'Previsto',
  CHECKED_IN: 'No condominio',
  CHECKED_OUT: 'Saiu',
  DENIED: 'Negado',
  CANCELED: 'Cancelado',
};

/** Dito quando a unidade de destino foi removida depois do registro da visita. */
export const UNIT_REMOVED = 'Unidade removida';

/** O bloco desambigua numeros repetidos entre torres; sem ele, some. */
export function unitLabel(unit: Pick<Unit, 'number' | 'block'>): string {
  return unit.block?.name ? `${unit.block.name} - ${unit.number}` : unit.number;
}
