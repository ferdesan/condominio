import { Ban, CircleCheckBig, CircleDollarSign, Clock, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ChargeStatus } from '@/types/financial';
import { CHARGE_STATUS_LABELS } from '../financial-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<ChargeStatus, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  PARTIAL: 'default',
  OVERDUE: 'destructive',
  CANCELED: 'neutral',
};

const ICONS: Record<ChargeStatus, LucideIcon> = {
  PENDING: Clock,
  PAID: CircleCheckBig,
  PARTIAL: CircleDollarSign,
  OVERDUE: TriangleAlert,
  CANCELED: Ban,
};

export interface ChargeStatusBadgeProps {
  status: ChargeStatus;
}

/**
 * Cada situacao carrega rotulo e icone proprios, e nao so uma cor: e o que
 * permite distingui-las sem enxergar a diferenca entre os tons.
 */
export function ChargeStatusBadge({ status }: ChargeStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {CHARGE_STATUS_LABELS[status]}
    </Badge>
  );
}
