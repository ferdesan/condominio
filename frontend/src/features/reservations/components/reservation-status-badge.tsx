import { Ban, CalendarCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ReservationStatus } from '@/types/api';
import { RESERVATION_STATUS_LABELS } from './reservation-status-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<ReservationStatus, BadgeVariant> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'destructive',
  CANCELED: 'neutral',
  COMPLETED: 'default',
};

const ICONS: Record<ReservationStatus, LucideIcon> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  REJECTED: XCircle,
  CANCELED: Ban,
  COMPLETED: CalendarCheck,
};

export interface ReservationStatusBadgeProps {
  status: ReservationStatus;
}

/**
 * Cada status carrega rotulo e icone proprios, e nao so uma cor: e o que
 * permite distingui-los sem enxergar a diferenca entre os tons.
 */
export function ReservationStatusBadge({ status }: ReservationStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {RESERVATION_STATUS_LABELS[status]}
    </Badge>
  );
}
