import {
  Ban,
  CircleHelp,
  CircleSlash,
  Download,
  FileDown,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Undo2,
  Upload,
  UserMinus,
  UserX,
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
  LGPD_DELETE_REQUEST: 'warning',
  LGPD_DELETE: 'destructive',
  LGPD_DELETE_CANCEL: 'neutral',
  LGPD_EXPORT: 'outline',
  LGPD_CONSENT_GRANTED: 'success',
  LGPD_CONSENT_REVOKED: 'warning',
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
  LGPD_DELETE_REQUEST: UserMinus,
  LGPD_DELETE: UserX,
  LGPD_DELETE_CANCEL: CircleSlash,
  LGPD_EXPORT: FileDown,
  LGPD_CONSENT_GRANTED: ShieldCheck,
  LGPD_CONSENT_REVOKED: ShieldOff,
};

export interface AuditActionBadgeProps {
  action: AuditAction;
}

/**
 * Cada acao carrega rotulo e icone proprios, e nao so uma cor: e o que permite
 * distingui-las sem enxergar a diferenca entre os tons.
 *
 * **Os tres mapas toleram uma acao desconhecida.** `action` e `varchar(60)`
 * livre no servidor, exatamente como `resource` — e `resourceLabel` ja cai para
 * o identificador cru pela mesma razao. Sem o mesmo cuidado aqui, `ICONS[acao]`
 * devolve `undefined`, `<Icon />` vira um elemento de tipo invalido e o React
 * derruba a arvore inteira: uma unica linha da trilha apagava a aplicacao
 * toda. Foi o que aconteceu quando o modulo LGPD passou a gravar seis acoes
 * novas que esta tela ainda nao conhecia.
 */
export function AuditActionBadge({ action }: AuditActionBadgeProps) {
  const Icon = ICONS[action] ?? CircleHelp;

  return (
    <Badge variant={VARIANTS[action] ?? 'neutral'} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {/* O identificador cru diz mais do que um espaco em branco. */}
      {ACTION_LABELS[action] ?? action}
    </Badge>
  );
}
