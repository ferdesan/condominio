import {
  Car,
  CircleDollarSign,
  DoorOpen,
  Home,
  TriangleAlert,
  Users,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/format';
import type { CondominiumStats } from '@/types/api';

/** Os sete contadores de `/condominiums/:id/stats`, na ordem em que o servidor os monta. */
const INDICATORS: { key: keyof CondominiumStats; label: string; icon: LucideIcon }[] = [
  { key: 'units', label: 'Unidades', icon: DoorOpen },
  { key: 'occupiedUnits', label: 'Unidades ocupadas', icon: Home },
  { key: 'residents', label: 'Moradores', icon: Users },
  { key: 'vehicles', label: 'Veiculos', icon: Car },
  { key: 'openIncidents', label: 'Ocorrencias abertas', icon: TriangleAlert },
  { key: 'pendingCharges', label: 'Cobrancas pendentes', icon: CircleDollarSign },
  { key: 'pendingReservations', label: 'Reservas pendentes', icon: CalendarClock },
];

export interface CondominiumStatsPanelProps {
  stats?: CondominiumStats;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

/**
 * Os indicadores falham por conta propria: o cadastro vem de outra consulta e
 * continua legivel sem eles. Enquanto carregam, os cartoes ja ocupam o lugar
 * definitivo, para que a pagina nao pule quando os numeros chegam.
 */
export function CondominiumStatsPanel({
  stats,
  loading,
  failed,
  onRetry,
}: CondominiumStatsPanelProps) {
  if (failed) {
    return (
      <section aria-label="Indicadores" className="app-surface p-5">
        <p role="alert" className="text-sm text-destructive">
          Nao foi possivel carregar os indicadores.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {INDICATORS.map(({ key, label, icon: Icon }) => (
        <div key={key} className="app-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          {loading || !stats ? (
            <Skeleton className="mt-3 h-8 w-20" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              {formatNumber(stats[key])}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
