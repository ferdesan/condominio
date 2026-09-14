import { Archive, FileText, Megaphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AnnouncementStatus } from '@/types/announcement';
import { STATUS_LABELS } from '../announcement-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<AnnouncementStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  ARCHIVED: 'outline',
};

const ICONS: Record<AnnouncementStatus, LucideIcon> = {
  DRAFT: FileText,
  PUBLISHED: Megaphone,
  ARCHIVED: Archive,
};

export interface AnnouncementStatusBadgeProps {
  status: AnnouncementStatus;
}

/**
 * Cada etapa do ciclo carrega rotulo e icone proprios, e nao so uma cor: e o
 * que permite distingui-las sem enxergar a diferenca entre os tons.
 */
export function AnnouncementStatusBadge({ status }: AnnouncementStatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
