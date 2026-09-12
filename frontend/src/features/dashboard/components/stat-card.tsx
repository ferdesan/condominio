import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'success' | 'warning' | 'destructive';

const TONE_CLASS: Record<StatTone, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-foreground',
  destructive: 'bg-destructive/10 text-destructive',
};

/**
 * Um numero e seu rotulo. Valores unicos nao viram grafico: o texto ja e a
 * leitura mais direta possivel.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: StatTone;
  loading?: boolean;
}) {
  return (
    <div className="app-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            TONE_CLASS[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      )}

      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
