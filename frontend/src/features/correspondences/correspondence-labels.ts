/** Rotulos de correspondencia, compartilhados pela listagem, os filtros e o formulario. */

import type { Unit } from '@/types/api';
import type {
  Correspondence,
  CorrespondenceStatus,
  CorrespondenceType,
} from '@/types/correspondence';

export const TYPE_LABELS: Record<CorrespondenceType, string> = {
  LETTER: 'Carta',
  PACKAGE: 'Encomenda',
  REGISTERED: 'Registrada',
  FOOD_DELIVERY: 'Delivery',
  OTHER: 'Outro',
};

export const STATUS_LABELS: Record<CorrespondenceStatus, string> = {
  PENDING: 'Aguardando retirada',
  DELIVERED: 'Entregue',
  RETURNED: 'Devolvida',
};

/** Dito quando a unidade destinataria foi removida depois do recebimento. */
export const UNIT_REMOVED = 'Unidade removida';

/** Dito quando a portaria nao identificou o morador destinatario. */
export const NO_RESIDENT = 'Sem destinatario';

/** O bloco desambigua numeros repetidos entre torres; sem ele, some. */
export function unitLabel(unit: Pick<Unit, 'number' | 'block'>): string {
  return unit.block?.name ? `${unit.block.name} - ${unit.number}` : unit.number;
}

/**
 * Como uma correspondencia e nomeada nos rotulos acessiveis e nas confirmacoes.
 *
 * A descricao e opcional no servidor e o codigo de rastreio tambem, entao o
 * ultimo recurso e a unidade destinataria — que sempre existe, ainda que o
 * registro dela possa ter sido removido.
 */
export function correspondenceLabel(correspondence: Correspondence): string {
  if (correspondence.description) return correspondence.description;
  if (correspondence.trackingCode) return correspondence.trackingCode;
  return correspondence.unit
    ? `correspondencia da unidade ${correspondence.unit.number}`
    : 'correspondencia';
}
