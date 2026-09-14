import { Ban, CalendarClock, CircleCheckBig, Radio, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AssemblyStatus } from '@/types/assembly';
import { ASSEMBLY_STATUS_LABELS } from '../assembly-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<AssemblyStatus, BadgeVariant> = {
  SCHEDULED: 'warning',
  IN_PROGRESS: 'default',
  FINISHED: 'success',
  CANCELED: 'neutral',
};

const ICONS: Record<AssemblyStatus, LucideIcon> = {
  SCHEDULED: CalendarClock,
  IN_PROGRESS: Radio,
  FINISHED: CircleCheckBig,
  CANCELED: Ban,
};

export interface AssemblyStatusBadgeProps {
  status: AssemblyStatus;
}

/**
 * Cada situacao carrega rotulo e icone proprios, e nao so uma cor: e o que
 * permite distingui-las sem enxergar a diferenca entre os tons.
 */
export function AssemblyStatusBadge({ status }: AssemblyStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {ASSEMBLY_STATUS_LABELS[status]}
    </Badge>
  );
}
