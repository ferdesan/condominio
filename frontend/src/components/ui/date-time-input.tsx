import * as React from 'react';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from './input';

/** Formato aceito e emitido pelo input nativo `datetime-local`. */
const LOCAL_DATE_TIME = "yyyy-MM-dd'T'HH:mm";

export interface DateTimeInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  value?: Date | string;
  /** Recebe o valor local (`yyyy-MM-ddTHH:mm`), ou `''` quando o campo e limpo. */
  onChange?: (value: string) => void;
  minDate?: Date;
  maxDate?: Date;
}

function toLocalDateTime(value?: Date | string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? format(date, LOCAL_DATE_TIME) : '';
}

/**
 * Data e hora em um unico campo, sobre o input nativo — o `DatePicker` cobre
 * apenas a data, e reservas precisam das duas.
 *
 * E totalmente controlado: o que aparece vem sempre de `value`, entao um reset
 * do formulario chega ao campo sem precisar de sincronizacao.
 */
export const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  ({ className, value, onChange, minDate, maxDate, ...props }, ref) => (
    <Input
      ref={ref}
      type="datetime-local"
      className={cn(className)}
      value={toLocalDateTime(value)}
      onChange={(event) => onChange?.(event.target.value)}
      min={minDate ? format(minDate, LOCAL_DATE_TIME) : undefined}
      max={maxDate ? format(maxDate, LOCAL_DATE_TIME) : undefined}
      {...props}
    />
  ),
);
DateTimeInput.displayName = 'DateTimeInput';
