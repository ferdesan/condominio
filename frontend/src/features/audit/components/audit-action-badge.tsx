import {
  Ban,
  Download,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Undo2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AuditAction } from '@/types/audit';
import { ACTION_LABELS } from '../audit-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<AuditAction, BadgeVariant> = {
  CREATE: 'success',
  UPDATE: 'default',
  DELETE: 'destructive',
  RESTORE: 'outline',
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  LOGIN_FAILED: 'warning',
  PASSWORD_CHANGED: 'warning',
  PERMISSION_DENIED: 'destructive',
  EXPORT: 'outline',
  IMPORT: 'outline',
};

const ICONS: Record<AuditAction, LucideIcon> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  RESTORE: Undo2,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  LOGIN_FAILED: ShieldAlert,
  PASSWORD_CHANGED: KeyRound,
  PERMISSION_DENIED: Ban,
  EXPORT: Download,
  IMPORT: Upload,
};

export interface AuditActionBadgeProps {
  action: AuditAction;
}

/**
 * Cada acao carrega rotulo e icone proprios, e nao so uma cor: e o que permite
 * distingui-las sem enxergar a diferenca entre os tons.
 */
export function AuditActionBadge({ action }: AuditActionBadgeProps) {
  const Icon = ICONS[action];
  return (
    <Badge variant={VARIANTS[action]} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {ACTION_LABELS[action]}
    </Badge>
  );
}
