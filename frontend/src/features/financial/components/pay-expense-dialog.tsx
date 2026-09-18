import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { formatCurrency } from '@/lib/format';
import type { Expense } from '@/types/financial';
import { usePayExpense } from '../financial-hooks';
import {
  payExpenseFormDefaults,
  payExpenseSchema,
  PAY_EXPENSE_FIELDS,
  toPayExpensePayload,
  type PayExpenseFormValues,
} from '../financial-schema';
import { PAYMENT_METHOD_LABELS } from '../financial-labels';

export interface PayExpenseDialogProps {
  expense: Expense;
  onClose: () => void;
}

/**
 * Liquidacao de uma despesa.
 *
 * Vira dialogo porque `payExpenseSchema` exige corpo — a data e a forma de
 * pagamento. Nao ha campo de valor: a liquidacao e sempre do valor lancado, e o
 * servidor nao aceita outro. Quando a despesa e recorrente, ele ainda agenda a
 * proxima ocorrencia a partir daqui.
 */
export function PayExpenseDialog({ expense, onClose }: PayExpenseDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PayExpenseFormValues>({
    resolver: zodResolver(payExpenseSchema),
    defaultValues: payExpenseFormDefaults(),
  });

  const pay = usePayExpense({
    onSuccess: onClose,
    onError: (error: ApiError) => applyApiError(error, setError, setFormError, PAY_EXPENSE_FIELDS),
  });

  const pending = isSubmitting || pay.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    await pay
      .mutateAsync({ id: expense.id, data: toPayExpensePayload(values) })
      .catch(() => undefined);
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent side="right" dismissible={false} className="max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liquidar despesa</DialogTitle>
          <DialogDescription>
            {expense.description} · {formatCurrency(expense.amount)}
            {expense.isRecurring ? ' · recorrente: a próxima será agendada' : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="paidAt"
              render={({ field, fieldState }) => (
                <FormField id="pay-paidAt" label="Pago em" error={fieldState.error?.message}>
                  {(aria) => (
                    <DateTimeInput
                      autoFocus
                      {...aria}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="paymentMethod"
              render={({ field, fieldState }) => (
                <FormField id="pay-method" label="Forma" error={fieldState.error?.message}>
                  {(aria) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}
            />
          </div>

          <FormField
            id="pay-notes"
            label="Observações"
            error={errors.notes?.message}
            description="Opcional."
          >
            {(aria) => <Textarea rows={3} maxLength={1000} {...aria} {...register('notes')} />}
          </FormField>

          {formError ? (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              Liquidar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
