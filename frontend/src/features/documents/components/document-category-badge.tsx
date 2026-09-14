import {
  BookText,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Gavel,
  ScrollText,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DocumentCategory } from '@/types/document';
import { CATEGORY_LABELS } from '../document-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<DocumentCategory, BadgeVariant> = {
  CONVENTION: 'default',
  REGULATION: 'default',
  MINUTES: 'outline',
  CONTRACT: 'neutral',
  FINANCIAL: 'success',
  REPORT: 'warning',
  INSURANCE: 'neutral',
  OTHER: 'neutral',
};

const ICONS: Record<DocumentCategory, LucideIcon> = {
  CONVENTION: Gavel,
  REGULATION: BookText,
  MINUTES: ScrollText,
  CONTRACT: FileCheck2,
  FINANCIAL: Wallet,
  REPORT: FileSpreadsheet,
  INSURANCE: ShieldCheck,
  OTHER: FileText,
};

export interface DocumentCategoryBadgeProps {
  category: DocumentCategory;
}

/**
 * Cada categoria carrega rotulo e icone proprios, e nao so uma cor: e o que
 * permite distingui-las sem enxergar a diferenca entre os tons.
 */
export function DocumentCategoryBadge({ category }: DocumentCategoryBadgeProps) {
  const Icon = ICONS[category];
  return (
    <Badge variant={VARIANTS[category]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}
