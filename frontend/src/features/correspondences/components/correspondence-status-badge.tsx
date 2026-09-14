import { PackageCheck, PackageX, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CorrespondenceStatus } from '@/types/correspondence';
import { STATUS_LABELS } from '../correspondence-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<CorrespondenceStatus, BadgeVariant> = {
  PENDING: 'warning',
  DELIVERED: 'success',
  RETURNED: 'neutral',
};

const ICONS: Record<CorrespondenceStatus, LucideIcon> = {
  PENDING: Clock,
  DELIVERED: PackageCheck,
  RETURNED: PackageX,
};

export interface CorrespondenceStatusBadgeProps {
  status: CorrespondenceStatus;
}

/**
 * Cada status carrega rotulo e icone proprios, e nao so uma cor: e o que
 * permite distingui-los sem enxergar a diferenca entre os tons.
 */
export function CorrespondenceStatusBadge({ status }: CorrespondenceStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
