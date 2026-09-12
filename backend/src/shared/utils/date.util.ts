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

export function addByRecurrence(
  date: string | Date,
  recurrence: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL',
): string | null {
  const map: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
  const months = map[recurrence];
  if (!months) return null;
  return dayjs(date).add(months, 'month').format(ISO_DATE);
}
