import { Ban, CheckCircle2, CircleDot, PauseCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { UserStatus } from '@/types/user';
import { STATUS_LABELS } from '../user-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<UserStatus, BadgeVariant> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  BLOCKED: 'destructive',
  PENDING: 'warning',
};

const ICONS: Record<UserStatus, LucideIcon> = {
  ACTIVE: CheckCircle2,
  INACTIVE: PauseCircle,
  BLOCKED: Ban,
  PENDING: CircleDot,
};

export interface UserStatusBadgeProps {
  status: UserStatus;
}

/**
 * Cada estado da conta carrega rotulo e icone proprios, e nao so uma cor:
 * "Inativo" e "Bloqueado" tem consequencias diferentes e precisam ser
 * distinguiveis sem depender do tom.
 */
export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
