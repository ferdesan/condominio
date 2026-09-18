/**
 * Composicao do calendario mensal. Modulo puro, sem React: e a unica parte da
 * tela com conteudo algoritmico proprio, e por isso vive separada dos
 * componentes que a desenham.
 *
 * A grade e montada a partir do `date-fns` que ja existe no projeto — ADR-003
 * proibe uma dependencia de calendario.
 */

import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { AvailabilityEntry, ReservationStatus } from '@/types/api';

/** Domingo, como manda o calendario civil brasileiro. */
const WEEK_STARTS_ON = 0;

/** Quantas reservas cabem numa celula antes de virar "+N". */
export const DEFAULT_MAX_ENTRIES_PER_DAY = 3;

/** A area pode ter sido removida depois que a reserva foi criada (US-019 EC-3). */
export const MISSING_AREA_LABEL = 'Área indisponível';
/** Idem para a unidade (US-019 EC-4): a reserva guarda o nome do solicitante. */
export const MISSING_UNIT_LABEL = 'Unidade indisponível';

export type CalendarEntry = {
  id: string;
  commonAreaId: string;
  areaLabel: string;
  unitLabel: string;
  requestedByName: string | null;
  status: ReservationStatus;
  startsAt: Date;
  endsAt: Date;
  /** `HH:mm - HH:mm`, ja formatado para a celula. */
  timeLabel: string;
};

export type CalendarDay = {
  date: Date;
  /** Falso nos dias de preenchimento que vem do mes anterior ou do seguinte. */
  inMonth: boolean;
  /** Ja recortadas pelo teto; `hiddenCount` conta o que sobrou. */
  entries: CalendarEntry[];
  hiddenCount: number;
  total: number;
};

export type MonthGrid = {
  month: Date;
  weeks: CalendarDay[][];
};

export type BuildMonthGridOptions = {
  maxEntriesPerDay?: number;
};

/**
 * Intervalo pedido a `/reservations/availability` para um mes: do primeiro
 * instante do dia 1 ao ultimo instante do ultimo dia.
 */
export function monthRange(month: Date): { from: Date; to: Date } {
  return { from: startOfMonth(month), to: endOfMonth(month) };
}

/**
 * Projecao da disponibilidade -> entrada da grade.
 *
 * Area e unidade chegam anulaveis: o endpoint resolve os nomes por join, e um
 * registro removido devolve `null`. Trocar por um rotulo aqui evita que a
 * palavra "null" apareca numa celula.
 */
export function toCalendarEntry(entry: AvailabilityEntry): CalendarEntry {
  const startsAt = new Date(entry.startsAt);
  const endsAt = new Date(entry.endsAt);
  return {
    id: entry.id,
    commonAreaId: entry.commonAreaId,
    areaLabel: entry.commonAreaName ?? MISSING_AREA_LABEL,
    unitLabel: entry.unitNumber ?? MISSING_UNIT_LABEL,
    requestedByName: entry.requestedByName,
    status: entry.status,
    startsAt,
    endsAt,
    timeLabel: `${format(startsAt, 'HH:mm')} - ${format(endsAt, 'HH:mm')}`,
  };
}

/**
 * Dias que uma reserva cobre, do dia do inicio ao dia do termino.
 *
 * Uma reserva que termina exatamente a meia-noite nao ocupa o dia seguinte: o
 * instante final e o primeiro do proximo dia, e nao um minuto dele.
 */
function daysCovered(entry: CalendarEntry): Date[] {
  const first = startOfDay(entry.startsAt);
  const lastInstant = entry.endsAt;
  const last =
    lastInstant.getTime() === startOfDay(lastInstant).getTime()
      ? startOfDay(addDays(lastInstant, -1))
      : startOfDay(lastInstant);

  const span = Math.max(0, differenceInCalendarDays(last, first));
  return Array.from({ length: span + 1 }, (_, index) => addDays(first, index));
}

/**
 * Monta a grade do mes.
 *
 * A grade tem o numero minimo de semanas que cobre o mes — cinco quando ele
 * cabe, seis quando nao cabe — e nao um numero fixo: uma sexta semana vazia so
 * ocuparia espaco. Os dias de preenchimento ficam marcados com `inMonth: false`.
 *
 * So os dias do proprio mes recebem reservas. Isso mantem a grade de marco
 * imune a uma entrada de abril que tenha vindo junto na resposta — o mesmo
 * isolamento que a query key por mes ja da, agora tambem na composicao.
 */
export function buildMonthGrid(
  month: Date,
  entries: readonly AvailabilityEntry[] = [],
  options: BuildMonthGridOptions = {},
): MonthGrid {
  const { maxEntriesPerDay = DEFAULT_MAX_ENTRIES_PER_DAY } = options;

  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const gridStart = startOfWeek(first, { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(last, { weekStartsOn: WEEK_STARTS_ON });
  const dayCount = differenceInCalendarDays(gridEnd, gridStart) + 1;

  const calendarEntries = entries.map(toCalendarEntry);

  const days: CalendarDay[] = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(gridStart, index);
    const inMonth = date >= first && date <= last;

    const matching = inMonth
      ? calendarEntries
          .filter((entry) => daysCovered(entry).some((day) => isSameDay(day, date)))
          .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
      : [];

    const visible = maxEntriesPerDay >= 0 ? matching.slice(0, maxEntriesPerDay) : matching;
    return {
      date,
      inMonth,
      entries: visible,
      hiddenCount: matching.length - visible.length,
      total: matching.length,
    };
  });

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return { month: first, weeks };
}
