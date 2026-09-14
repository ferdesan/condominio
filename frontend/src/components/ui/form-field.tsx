import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

/** Props de acessibilidade que o controle precisa receber. */
export interface FormFieldControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

export interface FormFieldProps {
  /** Id explicito do controle; a mensagem de erro usa `{id}-error`. */
  id: string;
  label: string;
  error?: string;
  description?: string;
  className?: string;
  children: ReactNode | ((control: FormFieldControlProps) => ReactNode);
}

/**
 * Junta rotulo, controle e mensagem de erro com a ligacao aria que o formulario
 * de login estabeleceu: id explicito, campo marcado como invalido, erro
 * referenciado por `aria-describedby` e anunciado com `role="alert"`.
 *
 * Passe uma funcao como filho para receber as props do controle. E assim que os
 * controles Radix — select, checkbox, moeda, data e hora — entram no formulario:
 * eles expoem valor e callback, e nao a API de registro nao controlada.
 *
 * ```tsx
 * // Campo registrado: o register cuida de name, onChange, onBlur e ref.
 * <FormField id="name" label="Nome" error={errors.name?.message}>
 *   {(control) => <Input {...control} {...register('name')} />}
 * </FormField>
 *
 * // Campo controlado: o Controller liga o valor e o callback do Radix.
 * <Controller
 *   control={control}
 *   name="status"
 *   render={({ field, fieldState }) => (
 *     <FormField id="status" label="Status" error={fieldState.error?.message}>
 *       {(aria) => (
 *         <Select value={field.value} onValueChange={field.onChange}>
 *           <SelectTrigger {...aria}>
 *             <SelectValue placeholder="Selecione" />
 *           </SelectTrigger>
 *           <SelectContent>
 *             <SelectItem value="ACTIVE">Ativo</SelectItem>
 *           </SelectContent>
 *         </Select>
 *       )}
 *     </FormField>
 *   )}
 * />
 * ```
 */
export function FormField({ id, label, error, description, className, children }: FormFieldProps) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  const control: FormFieldControlProps = {
    id,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy || undefined,
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {typeof children === 'function' ? children(control) : children}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
