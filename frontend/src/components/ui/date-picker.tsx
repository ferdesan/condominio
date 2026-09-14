import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: Date | string;
  onChange?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

function toDate(value?: Date | string): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, value, onChange, minDate, maxDate, ...props }, ref) => {
    const [dateValue, setDateValue] = React.useState<Date | undefined>(() => toDate(value));

    // Sem isto o valor so vale no mount, e um reset do formulario nao chega ate aqui.
    React.useEffect(() => {
      setDateValue(toDate(value));
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const date = new Date(e.target.value);
      if (!isNaN(date.getTime())) {
        setDateValue(date);
        onChange?.(date);
      }
    };

    return (
      <div className={cn('relative', className)}>
        <Input
          ref={ref}
          type="date"
          value={dateValue ? format(dateValue, 'yyyy-MM-dd') : ''}
          onChange={handleInputChange}
          min={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
          max={maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined}
          className="pr-10"
          {...props}
        />
        {/* Decorativo: quem abre o calendario e o proprio input nativo. */}
        <CalendarIcon
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  },
);
DatePicker.displayName = 'DatePicker';
