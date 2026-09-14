import { AlertOctagon, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { IncidentPriority } from '@/types/incident';
import { PRIORITY_LABELS } from '../incident-labels';

type BadgeVariant = 'default' | 'neutral' | 'success' | 'warning' | 'destructive' | 'outline';

const VARIANTS: Record<IncidentPriority, BadgeVariant> = {
  LOW: 'neutral',
  MEDIUM: 'outline',
  HIGH: 'warning',
  CRITICAL: 'destructive',
};

/**
 * A escala e dita pela forma antes da cor: setas que apontam para baixo e para
 * cima nas pontas, um traco no meio, e um octogono de alerta no topo — a unica
 * forma que nao pertence a serie, porque o caso que mais importa nao deve se
 * parecer com uma gradacao a mais.
 */
const ICONS: Record<IncidentPriority, LucideIcon> = {
  LOW: ArrowDown,
  MEDIUM: Minus,
  HIGH: ArrowUp,
  CRITICAL: AlertOctagon,
};

export interface IncidentPriorityBadgeProps {
  priority: IncidentPriority;
}

/**
 * Prioridade com tres canais alem da cor: o rotulo por extenso, um icone com
 * forma propria e — so na critica — o peso e a caixa do texto.
 *
 * Numa lista impressa em preto e branco, ou para quem nao separa o vermelho do
 * ambar, "Critica" continua sendo a linha que salta. O rotulo acessivel diz o
 * mesmo por extenso, para que a distincao tambem chegue a quem nao ve a lista.
 */
export function IncidentPriorityBadge({ priority }: IncidentPriorityBadgeProps) {
  const Icon = ICONS[priority];
  const isCritical = priority === 'CRITICAL';

  return (
    <Badge
      variant={VARIANTS[priority]}
      aria-label={`Prioridade ${PRIORITY_LABELS[priority].toLowerCase()}`}
      className={cn('gap-1', isCritical && 'border-destructive font-bold uppercase tracking-wide')}
    >
      <Icon className={cn('size-3', isCritical && 'size-3.5')} aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
