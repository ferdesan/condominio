import { addMonths, format, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { AvailabilityEntry, CommonArea } from '@/types/api';
import { buildMonthGrid, type CalendarDay } from '../calendar-grid';
import { RESERVATION_STATUS_LABELS } from './reservation-status-labels';

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

export interface ReservationCalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  entries: AvailabilityEntry[];
  loading: boolean;
  areas: CommonArea[];
  areaId: string | undefined;
  onAreaChange: (areaId: string | undefined) => void;
  /** Ausente quando nenhum condominio esta selecionado. */
  hasCondominium: boolean;
}

/**
 * Calendario mensal montado a partir do `date-fns` que ja existe no projeto —
 * ADR-003 proibe uma dependencia de calendario.
 *
 * Mostra apenas pendentes e confirmadas, que e o que o endpoint de
 * disponibilidade devolve; recusadas, canceladas e concluidas continuam
 * visiveis na listagem, que e a visao exaustiva.
 */
export function ReservationCalendar({
  month,
  onMonthChange,
  entries,
  loading,
  areas,
  areaId,
  onAreaChange,
  hasCondominium,
}: ReservationCalendarProps) {
  if (!hasCondominium) {
    return (
      <div className="p-4">
        <EmptyState
          icon={CalendarOff}
          title="Selecione um condominio"
          description="O calendario mostra as reservas de um condominio por vez. Escolha um no seletor do topo para ver a agenda do mes."
        />
      </div>
    );
  }

  const grid = buildMonthGrid(month, entries);
  const monthLabel = format(month, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Mes anterior"
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          {/* `aria-live` porque a troca de mes nao move o foco. */}
          <h3 className="min-w-48 text-center text-sm font-semibold capitalize" aria-live="polite">
            {monthLabel}
          </h3>
          <Button
            variant="outline"
            size="sm"
            aria-label="Proximo mes"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="calendar-area">Area comum</Label>
          <Select
            value={areaId ?? ANY}
            onValueChange={(value) => onAreaChange(value === ANY ? undefined : value)}
          >
            <SelectTrigger id="calendar-area" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O calendario mostra apenas reservas pendentes e confirmadas. Use a lista para ver recusadas,
        canceladas e concluidas.
      </p>

      {loading ? (
        <div className="grid grid-cols-7 gap-1" aria-hidden="true">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Reservas de {monthLabel}</caption>
          <thead>
            <tr>
              {WEEKDAY_HEADERS.map((weekday) => (
                <th
                  key={weekday}
                  scope="col"
                  className="border border-border p-1 text-xs font-medium text-muted-foreground"
                >
                  {weekday}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.weeks.map((week) => (
              <tr key={week[0].date.toISOString()}>
                {week.map((day) => (
                  <DayCell key={day.date.toISOString()} day={day} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DayCell({ day }: { day: CalendarDay }) {
  const label = format(day.date, "d 'de' MMMM", { locale: ptBR });

  return (
    <td
      className={cn(
        'h-24 border border-border p-1 align-top',
        // Os dias de preenchimento ficam esmaecidos e rotulados, e nao
        // invisiveis: a semana precisa continuar legivel nas bordas do mes.
        !day.inMonth && 'bg-muted/40 text-muted-foreground',
        isToday(day.date) && 'ring-1 ring-inset ring-primary',
      )}
      aria-label={day.inMonth ? label : `${label} (fora do mes)`}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-medium', !day.inMonth && 'opacity-60')}>
          {day.date.getDate()}
        </span>
        {day.total > 0 ? (
          <span className="sr-only">
            {day.total} {day.total === 1 ? 'reserva' : 'reservas'}
          </span>
        ) : null}
      </div>

      <ul className="mt-1 space-y-0.5">
        {day.entries.map((entry) => (
          <li key={`${entry.id}-${isSameDay(entry.startsAt, day.date) ? 'start' : 'cont'}`}>
            <span
              className={cn(
                'block truncate rounded px-1 py-0.5 text-[11px] leading-tight',
                // Pendente e confirmada diferem por cor, borda e pelo rotulo
                // textual que acompanha cada entrada.
                entry.status === 'PENDING'
                  ? 'border border-dashed border-warning bg-warning/15 text-foreground'
                  : 'border border-success bg-success/15 text-foreground',
              )}
              title={`${entry.areaLabel} · Unidade ${entry.unitLabel} · ${entry.timeLabel}`}
            >
              <span className="sr-only">{RESERVATION_STATUS_LABELS[entry.status]}: </span>
              {entry.timeLabel} {entry.areaLabel} · {entry.unitLabel}
            </span>
          </li>
        ))}
      </ul>

      {day.hiddenCount > 0 ? (
        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
          +{day.hiddenCount} {day.hiddenCount === 1 ? 'reserva' : 'reservas'}
        </p>
      ) : null}
    </td>
  );
}
