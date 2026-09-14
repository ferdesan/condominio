import type { ReservationStatus } from '@/types/api';

/**
 * Rotulos dos cinco estados. Ficam fora do componente porque a listagem, os
 * filtros e o calendario leem os mesmos nomes.
 */
export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Recusada',
  CANCELED: 'Cancelada',
  COMPLETED: 'Concluida',
};
