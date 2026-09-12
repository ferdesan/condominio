import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: Date | string;
  onChange?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, value, onChange, minDate, maxDate, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [dateValue, setDateValue] = React.useState<Date | undefined>(
      value instanceof Date ? value : value ? new Date(value) : undefined,
    );

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
          value={
            dateValue
              ? format(dateValue, 'yyyy-MM-dd')
              : ''
          }
          onChange={handleInputChange}
          min={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
          max={maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-1/2 -translate-y-1/2"
          onClick={() => setOpen(!open)}
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Abrir calendário</span>
        </Button>
      </div>
    );
  },
);
DatePicker.displayName = 'DatePicker';
