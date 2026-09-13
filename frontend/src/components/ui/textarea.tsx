import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Limite dos campos de observacao no servidor. */
export const TEXTAREA_MAX_LENGTH = 2000;

/**
 * Campo de texto multilinha para observacoes. Segue o visual do `Input` e ja
 * chega com o limite de 2000 caracteres que o servidor impoe nesses campos.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, maxLength = TEXTAREA_MAX_LENGTH, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      maxLength={maxLength}
      className={cn(
        'flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
