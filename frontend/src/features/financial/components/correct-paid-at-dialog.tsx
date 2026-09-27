import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useCorrectPaidAt, type PaidAtCorrectionKind } from '../financial-hooks';
import {
  correctPaidAtFormDefaults,
  correctPaidAtSchema,
  CORRECT_PAID_AT_FIELDS,
  competenceOf,
  competenceOfLocalInput,
  toCorrectPaidAtPayload,
  type CorrectPaidAtFormValues,
} from '../financial-schema';

export type PaidAtCorrectionTarget = {
  kind: PaidAtCorrectionKind;
  id: string;
  paidAt: string;
  amount: number;
  description: string;
};

export interface CorrectPaidAtDialogProps {
  target: PaidAtCorrectionTarget;
  onClose: () => void;
}

const COPY: Record<PaidAtCorrectionKind, { title: string; label: string }> = {
  payment: { title: 'Corrigir data do recebimento', label: 'Recebido em' },
  expense: { title: 'Corrigir data do pagamento', label: 'Pago em' },
};

/**
 * Correcao da data de uma baixa ja feita, de recebimento ou de liquidacao.
 *
 * So a data muda. O motivo e obrigatorio porque a correcao move dinheiro entre
 * competencias e fica na auditoria. Quando a competencia muda, o aviso diz de
 * onde o valor sai e para onde vai, antes de enviar.
 *
 * Nao tenta adivinhar se algum mes esta fechado: quem decide e o servidor, que
 * confere todo mes entre as duas datas, e a recusa dele aparece aqui.
 */
export function CorrectPaidAtDialog({ target, onClose }: CorrectPaidAtDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const copy = COPY[target.kind];

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CorrectPaidAtFormValues>({
    resolver: zodResolver(correctPaidAtSchema),
    defaultValues: correctPaidAtFormDefaults(target.paidAt),
  });

  const correct = useCorrectPaidAt(target.kind, {
    onSuccess: onClose,
    onError: (error: ApiError) =>
      applyApiError(error, setError, setFormError, CORRECT_PAID_AT_FIELDS),
  });

  const pending = isSubmitting || correct.isPending;

  const nextPaidAt = useWatch({ control, name: 'paidAt' });
  const fromMonth = competenceOf(target.paidAt);
  const toMonth = nextPaidAt ? competenceOfLocalInput(nextPaidAt) : fromMonth;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    await correct
      .mutateAsync({ id: target.id, data: toCorrectPaidAtPayload(values) })
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
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {target.description} · {formatCurrency(target.amount)} · data atual:{' '}
            {formatDateTime(target.paidAt)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Controller
            control={control}
            name="paidAt"
            render={({ field, fieldState }) => (
              <FormField
                id="correct-paidAt"
                label={`${copy.label} (data correta)`}
                error={fieldState.error?.message}
              >
                {(aria) => (
                  <DateTimeInput
                    autoFocus
                    {...aria}
                    value={field.value}
                    onChange={field.onChange}
                    maxDate={new Date()}
                  />
                )}
              </FormField>
            )}
          />

          {toMonth !== fromMonth ? (
            <p
              role="status"
              className="rounded-md bg-warning/10 px-3 py-2 text-sm"
            >
              O valor sai do balancete de {fromMonth} e entra no de {toMonth}. As duas
              competências, e qualquer uma entre elas, precisam estar abertas.
            </p>
          ) : null}

          <FormField
            id="correct-reason"
            label="Motivo da correção"
            error={errors.reason?.message}
            description="Fica registrado na auditoria."
          >
            {(aria) => <Textarea rows={3} maxLength={200} {...aria} {...register('reason')} />}
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
              Corrigir data
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
