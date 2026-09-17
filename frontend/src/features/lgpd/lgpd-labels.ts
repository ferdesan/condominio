import type { BadgeProps } from '@/components/ui/badge';
import type { LgpdRequestStatus } from '@/types/lgpd';

/** Rotulos fixados no TechSpec, secoes de labels da tela LGPD. */
export const REQUEST_STATUS_LABELS: Record<LgpdRequestStatus, string> = {
  PENDING: 'Aguardando execucao',
  EXECUTED: 'Executado',
  CANCELLED: 'Cancelado',
};

export const REQUEST_STATUS_VARIANTS: Record<
  LgpdRequestStatus,
  NonNullable<BadgeProps['variant']>
> = {
  PENDING: 'warning',
  EXECUTED: 'success',
  CANCELLED: 'neutral',
};