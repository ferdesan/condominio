import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value?: number | string;
  onChange?: (value: number) => void;
  currency?: string;
  locale?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      value,
      onChange,
      currency = 'BRL',
      locale = 'pt-BR',
      placeholder = '0,00',
      ...props
    },
    ref,
  ) => {
    const [displayValue, setDisplayValue] = React.useState('');

    React.useEffect(() => {
      if (value !== undefined) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        const formatted = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numValue);
        setDisplayValue(formatted);
      }
    }, [value, currency, locale]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;

      // Remove all non-digit characters except comma and dot
      inputValue = inputValue.replace(/[^\d.,]/g, '');

      // Replace comma with dot for decimal parsing
      inputValue = inputValue.replace(',', '.');

      setDisplayValue(inputValue);

      // Parse the numeric value
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        onChange?.(numValue);
      }
    };

    const handleBlur = () => {
      if (displayValue) {
        const numValue = parseFloat(displayValue);
        if (!isNaN(numValue)) {
          const formatted = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(numValue);
          setDisplayValue(formatted);
        }
      }
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors',
          'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive',
          className,
        )}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = 'CurrencyInput';
