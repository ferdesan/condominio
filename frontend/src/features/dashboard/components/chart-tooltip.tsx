import type { TooltipProps } from 'recharts';
import { formatCurrency } from '@/lib/format';

/**
 * Tooltip compartilhado pelos graficos. Os valores usam tokens de texto; a cor
 * da serie aparece so no marcador ao lado, nunca no numero.
 */
export function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-elevated">
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</p>
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums">{formatCurrency(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
