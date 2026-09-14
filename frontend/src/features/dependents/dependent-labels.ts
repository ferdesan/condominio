/** Rotulos do enum de parentesco, compartilhados pela listagem, os filtros e o formulario. */

import type { DependentRelationship, Unit } from '@/types/api';

export const RELATIONSHIP_LABELS: Record<DependentRelationship, string> = {
  SPOUSE: 'Conjuge',
  CHILD: 'Filho(a)',
  PARENT: 'Pai/Mae',
  SIBLING: 'Irmao(a)',
  EMPLOYEE: 'Empregado(a) domestico(a)',
  OTHER: 'Outro',
};

/** O bloco desambigua numeros repetidos entre torres; sem ele, some. */
export function unitLabel(unit: Unit): string {
  return unit.block?.name ? `${unit.block.name} - ${unit.number}` : unit.number;
}
