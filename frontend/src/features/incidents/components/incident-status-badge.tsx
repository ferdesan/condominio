import { Ban, CheckCircle2, CircleDot, Lock, Search, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { IncidentStatus } from '@/types/incident';
import { STATUS_LABELS } from '../incident-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<IncidentStatus, BadgeVariant> = {
  OPEN: 'warning',
  IN_ANALYSIS: 'default',
  IN_PROGRESS: 'default',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REJECTED: 'destructive',
};

const ICONS: Record<IncidentStatus, LucideIcon> = {
  OPEN: CircleDot,
  IN_ANALYSIS: Search,
  IN_PROGRESS: Wrench,
  RESOLVED: CheckCircle2,
  CLOSED: Lock,
  REJECTED: Ban,
};

export interface IncidentStatusBadgeProps {
  status: IncidentStatus;
}

/**
 * Cada etapa do atendimento carrega rotulo e icone proprios, e nao so uma cor:
 * `IN_ANALYSIS` e `IN_PROGRESS` partilham o mesmo tom e continuam distinguiveis.
 */
export function IncidentStatusBadge({ status }: IncidentStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
