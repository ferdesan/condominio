import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isBetween from 'dayjs/plugin/isBetween';
import utc from 'dayjs/plugin/utc';

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(utc);

export { dayjs };

export const ISO_DATE = 'YYYY-MM-DD';
export const REFERENCE_MONTH = 'YYYY-MM';

export function toDate(value: string | Date): Date {
  return dayjs(value).toDate();
}

export function toIsoDate(value: string | Date): string {
  return dayjs(value).format(ISO_DATE);
}

export function currentReferenceMonth(): string {
  return dayjs().format(REFERENCE_MONTH);
}

export function isOverdue(dueDate: string | Date, reference: Date = new Date()): boolean {
  return dayjs(dueDate).endOf('day').isBefore(dayjs(reference));
}

export function daysBetween(start: string | Date, end: string | Date): number {
  return dayjs(end).startOf('day').diff(dayjs(start).startOf('day'), 'day');
}

/** Fuso usado quando o tenant nao declara um (ou declara um invalido). */
export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

/** Devolve o fuso informado se o runtime o reconhece; senao, o padrao. */
export function resolveTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

type WallClock = { year: number; month: number; day: number; minutes: number; weekday: number };

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Data, hora e dia da semana que um relogio de parede no fuso mostraria. */
function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  };
}

/**
 * Um intervalo lido no relogio de parede de um fuso: o dia da semana do
 * inicio e os minutos desde a meia-noite desse dia para inicio e termino.
 * `endMinutes` passa de 1440 quando o termino cai no dia seguinte.
 *
 * Existe porque horarios de funcionamento (`08:00`, `22:00`) sao hora local do
 * condominio. Calcula-los no fuso do processo faz um servidor em UTC recusar
 * 10:00-20:20 de Brasilia como se fosse 13:00-23:20.
 */
export function wallClockSlot(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
): { weekday: number; startMinutes: number; endMinutes: number } {
  const start = wallClock(startsAt, timeZone);
  const end = wallClock(endsAt, timeZone);
  const dayOffset = Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) /
      86_400_000,
  );

  return {
    weekday: start.weekday,
    startMinutes: start.minutes,
    endMinutes: end.minutes + dayOffset * 1440,
  };
}

/** Intervalos [startA, endA) e [startB, endB) se sobrepoem? */
export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

/**
 * Fronteira de uma competencia `YYYY-MM`, como intervalo semiaberto
 * `[start, endExclusive)`.
 *
 * Existe para ser a **unica** fonte de fronteira de mes do projeto: o balancete
 * soma `payment.paid_at` e `expense.paid_at` dentro deste intervalo, e a guarda
 * de mes fechado decide a partir do mesmo calculo. Se os dois derivassem o mes
 * por conta propria, um pagamento poderia ser recusado por cair num mes fechado
 * e depois ser somado em outro mes — a pior forma de o numero divergir, porque
 * cada metade estaria certa sozinha.
 *
 * Semiaberto, e nao `endOf('month')`: o fim do mes tem precisao de milissegundo
 * e `paid_at` e `datetime`, entao `< endExclusive` nao tem borda a errar.
 *
 * Recusa mes impossivel em vez de normalizar: `dayjs('2026-13-01')` vira janeiro
 * de 2027 sem avisar, e um balancete emitido para o mes errado e pior do que um
 * balancete que nao sai.
 */
/**
 * A competencia a que um instante pertence — o inverso de `monthRange`, e mora
 * ao lado dele de proposito.
 *
 * `monthRange(referenceMonthOf(t))` contem `t` por construcao. As duas juntas
 * sao a unica aritmetica de mes do projeto: a guarda de mes fechado decide por
 * esta, as agregacoes filtram por aquela, e por isso um pagamento nao pode ser
 * recusado por cair num mes e depois somado em outro.
 */
export function referenceMonthOf(when: string | Date): string {
  return dayjs(when).format(REFERENCE_MONTH);
}

export function monthRange(referenceMonth: string): { start: Date; endExclusive: Date } {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
    throw new RangeError(`Competencia invalida: "${referenceMonth}". Use o formato AAAA-MM.`);
  }

  const start = dayjs(`${referenceMonth}-01`, ISO_DATE, true).startOf('day');

  return { start: start.toDate(), endExclusive: start.add(1, 'month').toDate() };
}

export function addByRecurrence(
  date: string | Date,
  recurrence: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL',
): string | null {
  const map: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
  const months = map[recurrence];
  if (!months) return null;
  return dayjs(date).add(months, 'month').format(ISO_DATE);
}
