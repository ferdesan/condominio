import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const compactFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCurrency(value?: number | string | null): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '—';
  return currencyFormatter.format(numeric);
}

/** Versao compacta para cartoes e eixos de grafico (R$ 12,4 mil). */
export function formatCompactCurrency(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `R$ ${compactFormatter.format(value)}`;
}

export function formatNumber(value?: number | null, fractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value?: number | null, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, fractionDigits)}%`;
}

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(value?: string | Date | null, pattern = 'dd/MM/yyyy'): string {
  const date = toDate(value);
  return date ? format(date, pattern, { locale: ptBR }) : '—';
}

export function formatDateTime(value?: string | Date | null): string {
  return formatDate(value, "dd/MM/yyyy 'as' HH:mm");
}

export function formatTime(value?: string | Date | null): string {
  return formatDate(value, 'HH:mm');
}

export function formatRelative(value?: string | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

/** Competencia AAAA-MM -> "set/2026". */
export function formatReferenceMonth(value?: string | null): string {
  if (!value) return '—';
  const date = parseISO(`${value}-01`);
  return isValid(date) ? format(date, 'MMM/yyyy', { locale: ptBR }) : value;
}

export function formatDocument(value?: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value;
}

export function formatPhone(value?: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return value;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
