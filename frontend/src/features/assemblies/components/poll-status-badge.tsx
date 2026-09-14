import { Ban, FileEdit, ListChecks, Vote, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PollStatus } from '@/types/assembly';
import { POLL_STATUS_LABELS } from '../assembly-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<PollStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  OPEN: 'default',
  CLOSED: 'success',
  CANCELED: 'destructive',
};

const ICONS: Record<PollStatus, LucideIcon> = {
  DRAFT: FileEdit,
  OPEN: Vote,
  CLOSED: ListChecks,
  CANCELED: Ban,
};

export interface PollStatusBadgeProps {
  status: PollStatus;
}

/**
 * Mesma regra das demais tarjas: rotulo e icone proprios, e nao so uma cor.
 */
export function PollStatusBadge({ status }: PollStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {POLL_STATUS_LABELS[status]}
    </Badge>
  );
}
