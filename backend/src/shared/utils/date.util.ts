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
