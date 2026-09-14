import { Ban, CircleCheckBig, Clock, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ExpenseStatus } from '@/types/financial';
import { EXPENSE_STATUS_LABELS } from '../financial-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<ExpenseStatus, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  OVERDUE: 'destructive',
  CANCELED: 'neutral',
};

const ICONS: Record<ExpenseStatus, LucideIcon> = {
  PENDING: Clock,
  PAID: CircleCheckBig,
  OVERDUE: TriangleAlert,
  CANCELED: Ban,
};

export interface ExpenseStatusBadgeProps {
  status: ExpenseStatus;
}

/** Mesma regra das demais tarjas: rotulo e icone proprios, e nao so uma cor. */
export function ExpenseStatusBadge({ status }: ExpenseStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {EXPENSE_STATUS_LABELS[status]}
    </Badge>
  );
}
