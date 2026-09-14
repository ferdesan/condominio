import { Ban, CalendarClock, CheckCircle2, TriangleAlert, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MaintenanceStatus } from '@/types/maintenance';
import { STATUS_LABELS } from '../maintenance-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<MaintenanceStatus, BadgeVariant> = {
  SCHEDULED: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  OVERDUE: 'destructive',
  CANCELED: 'neutral',
};

const ICONS: Record<MaintenanceStatus, LucideIcon> = {
  SCHEDULED: CalendarClock,
  IN_PROGRESS: Wrench,
  COMPLETED: CheckCircle2,
  OVERDUE: TriangleAlert,
  CANCELED: Ban,
};

export interface MaintenanceStatusBadgeProps {
  status: MaintenanceStatus;
}

/**
 * Cada etapa da ordem carrega rotulo e icone proprios, e nao so uma cor: um
 * daltonico precisa distinguir "Atrasada" de "Agendada" sem depender do tom.
 */
export function MaintenanceStatusBadge({ status }: MaintenanceStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
