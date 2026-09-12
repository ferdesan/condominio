import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  format?: 'BR' | 'US';
}

/**
 * Format: (XX) XXXXX-XXXX for BR or (XXX) XXX-XXXX for US
 */
function formatPhoneNumber(value: string, format: 'BR' | 'US' = 'BR'): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  if (format === 'BR') {
    // (XX) XXXXX-XXXX
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  // US format: (XXX) XXX-XXXX
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      value = '',
      onChange,
      format = 'BR',
      placeholder = format === 'BR' ? '(00) 00000-0000' : '(000) 000-0000',
      ...props
    },
    ref,
  ) => {
    const [displayValue, setDisplayValue] = React.useState(
      typeof value === 'string' ? formatPhoneNumber(value, format) : '',
    );

    React.useEffect(() => {
      if (value) {
        setDisplayValue(formatPhoneNumber(value, format));
      }
    }, [value, format]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const formatted = formatPhoneNumber(input, format);
      setDisplayValue(formatted);

      // Extract only digits for onChange
      const digitsOnly = formatted.replace(/\D/g, '');
      onChange?.(digitsOnly);
    };

    return (
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
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
PhoneInput.displayName = 'PhoneInput';
