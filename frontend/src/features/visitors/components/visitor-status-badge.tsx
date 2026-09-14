import { Ban, Clock, LogIn, LogOut, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VisitorStatus } from '@/types/visitor';
import { STATUS_LABELS } from '../visitor-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<VisitorStatus, BadgeVariant> = {
  EXPECTED: 'warning',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'outline',
  DENIED: 'destructive',
  CANCELED: 'neutral',
};

const ICONS: Record<VisitorStatus, LucideIcon> = {
  EXPECTED: Clock,
  CHECKED_IN: LogIn,
  CHECKED_OUT: LogOut,
  DENIED: XCircle,
  CANCELED: Ban,
};

export interface VisitorStatusBadgeProps {
  status: VisitorStatus;
}

/**
 * Cada status carrega rotulo e icone proprios, e nao so uma cor: e o que
 * permite distingui-los sem enxergar a diferenca entre os tons.
 */
export function VisitorStatusBadge({ status }: VisitorStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
