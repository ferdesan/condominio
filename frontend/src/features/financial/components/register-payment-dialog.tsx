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
import { Input } from '@/components/ui/input';
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
import type { Charge } from '@/types/financial';
import { useRegisterPayment } from '../financial-hooks';
import {
  paymentFormDefaults,
  registerPaymentSchema,
  PAYMENT_FIELDS,
  toPaymentPayload,
  type PaymentFormValues,
} from '../financial-schema';
import { outstandingAmount, PAYMENT_METHOD_LABELS } from '../financial-labels';

export interface RegisterPaymentDialogProps {
  charge: Charge;
  onClose: () => void;
}

/**
 * Baixa de pagamento de uma cobranca.
 *
 * Vira dialogo porque `registerPaymentSchema` exige corpo — valor, data e forma
 * —, e nao porque a acao seja rara. O valor ja chega preenchido com o saldo: a
 * baixa total e o caso comum, e a parcial e digitar por cima.
 *
 * O servidor decide o novo status a partir do quanto foi pago (quitada ou
 * parcial); a tela nao o envia nem o adivinha.
 */
export function RegisterPaymentDialog({ charge, onClose }: RegisterPaymentDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const outstanding = outstandingAmount(charge);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(registerPaymentSchema),
    defaultValues: paymentFormDefaults(outstanding),
  });

  const registerPayment = useRegisterPayment({
    onSuccess: onClose,
    onError: (error: ApiError) => applyApiError(error, setError, setFormError, PAYMENT_FIELDS),
  });

  const pending = isSubmitting || registerPayment.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    await registerPayment
      .mutateAsync({ id: charge.id, data: toPaymentPayload(values) })
      .catch(() => undefined);
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent side="right" dismissible={false} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {charge.description}
            {charge.unit?.number ? ` · unidade ${charge.unit.number}` : ''} · saldo de{' '}
            {formatCurrency(outstanding)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="payment-amount"
              label="Valor recebido (R$)"
              error={errors.amount?.message}
              description="Menos que o saldo registra baixa parcial."
            >
              {(aria) => (
                <Input
                  autoFocus
                  type="number"
                  min={0}
                  step="0.01"
                  {...aria}
                  {...register('amount')}
                />
              )}
            </FormField>

            <Controller
              control={control}
              name="paidAt"
              render={({ field, fieldState }) => (
                <FormField
                  id="payment-paidAt"
                  label="Recebido em"
                  error={fieldState.error?.message}
                >
                  {(aria) => (
                    <DateTimeInput {...aria} value={field.value} onChange={field.onChange} />
                  )}
                </FormField>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="method"
              render={({ field, fieldState }) => (
                <FormField id="payment-method" label="Forma" error={fieldState.error?.message}>
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

            <FormField
              id="payment-transactionId"
              label="Identificador da transação"
              error={errors.transactionId?.message}
              description="Opcional. O código do comprovante."
            >
              {(aria) => <Input maxLength={80} {...aria} {...register('transactionId')} />}
            </FormField>
          </div>

          <FormField
            id="payment-notes"
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
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
