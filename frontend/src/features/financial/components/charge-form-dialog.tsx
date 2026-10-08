import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Unit } from '@/types/api';
import type { Charge, FinancialCategory } from '@/types/financial';
import { chargeHooks, CHARGES_KEY } from '../financial-hooks';
import {
  chargeFormDefaults,
  chargeSchema,
  CHARGE_FIELDS,
  toChargeFormValues,
  toChargePayload,
  type ChargeFormValues,
} from '../financial-schema';

/** Valor sentinela do "sem conta": vazio nao distingue escolher de nao ter escolhido. */
const NONE = '__none__';

export interface ChargeFormDialogProps {
  /** Ausente cadastra; presente edita. */
  charge?: Charge;
  condominiumId: string;
  units: Unit[];
  categories: FinancialCategory[];
  onClose: () => void;
}

/**
 * Lancamento avulso de cobranca.
 *
 * **O status nao e campo.** A cobranca nasce em aberto e quem a move sao as
 * rotas de baixa e de cancelamento — `updateChargeSchema` ate aceita `status`,
 * mas manda-lo daqui criaria um segundo caminho para a mesma transicao, sem o
 * registro do pagamento nem o motivo do cancelamento. Os valores ja recebidos
 * tambem ficam de fora pelo mesmo motivo.
 *
 * Juros, multa e desconto sao editaveis porque o servidor os aceita no corpo e
 * eles integram o valor cobrado — a conta que a listagem mostra e
 * `amount + juros + multa - desconto - pago`.
 */
export function ChargeFormDialog({
  charge,
  condominiumId,
  units,
  categories,
  onClose,
}: ChargeFormDialogProps) {
  const isEdit = Boolean(charge);
  const queryClient = useQueryClient();

  // A lista inteira do condomínio cabe no seletor, mas não cabe no olho: sem
  // busca, escolher uma unidade vira rolagem.
  const unitOptions = useMemo(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: `${unit.number}${unit.block?.name ? ` · ${unit.block.name}` : ''}`,
      })),
    [units],
  );

  // "Sem conta" é a primeira opção, e não um estado à parte: a classificação é
  // opcional e voltar atrás precisa ser tão alcançável quanto escolher.
  const categoryOptions = useMemo(
    () => [
      { value: NONE, label: 'Sem conta' },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ChargeFormValues>({
    resolver: zodResolver(chargeSchema),
    defaultValues: charge ? toChargeFormValues(charge) : chargeFormDefaults(),
  });

  function handleError(error: ApiError): void {
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [CHARGES_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, CHARGE_FIELDS);
  }

  const create = chargeHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = chargeHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toChargePayload(values, condominiumId);
    const request = charge ? update.mutateAsync({ id: charge.id, data }) : create.mutateAsync(data);
    await request.catch(() => undefined);
  });

  function requestClose(): void {
    if (isDirty && !pending) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent side="right" dismissible={false} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar cobrança' : 'Nova cobrança'}</DialogTitle>
            <DialogDescription>
              O lancamento de uma unidade: o que se cobra, de que competência e quando vence.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="unitId"
                render={({ field, fieldState }) => (
                  <FormField id="charge-unitId" label="Unidade" error={fieldState.error?.message}>
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value}
                        onValueChange={field.onChange}
                        options={unitOptions}
                        placeholder="Selecione"
                        searchPlaceholder="Buscar unidade"
                        emptyMessage="Nenhuma unidade corresponde à busca."
                      />
                    )}
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="categoryId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="charge-categoryId"
                    label="Conta"
                    error={fieldState.error?.message}
                    description="Opcional. Classifica a cobrança na prestação de contas."
                  >
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value || NONE}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                        options={categoryOptions}
                        searchPlaceholder="Buscar conta"
                        emptyMessage="Nenhuma conta corresponde à busca."
                      />
                    )}
                  </FormField>
                )}
              />
            </div>

            <FormField
              id="charge-description"
              label="Descrição"
              error={errors.description?.message}
            >
              {(aria) => <Input maxLength={180} {...aria} {...register('description')} />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              {/*
                Competencia e mes, e nao data: o servidor guarda `AAAA-MM` e o
                input nativo de mês fala exatamente esse formato.
              */}
              <FormField
                id="charge-referenceMonth"
                label="Competência"
                error={errors.referenceMonth?.message}
              >
                {(aria) => <Input type="month" {...aria} {...register('referenceMonth')} />}
              </FormField>

              <FormField id="charge-dueDate" label="Vencimento" error={errors.dueDate?.message}>
                {(aria) => <Input type="date" {...aria} {...register('dueDate')} />}
              </FormField>

              {/*
                Dinheiro entra pela mascara de centavos implicitos: sem virgula
                o que se digita sao centavos (`4999` = `R$ 49,99`), e o que sai
                e um decimal canonico que o payload converte com `Number()`.
              */}
              <Controller
                control={control}
                name="amount"
                render={({ field, fieldState }) => (
                  <FormField
                    id="charge-amount"
                    label="Valor (R$)"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <MoneyInput
                        {...aria}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  </FormField>
                )}
              />
            </div>

            <fieldset className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
              <legend className="px-1 text-sm font-medium">Ajustes do valor</legend>

              <Controller
                control={control}
                name="discount"
                render={({ field, fieldState }) => (
                  <FormField
                    id="charge-discount"
                    label="Desconto (R$)"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <MoneyInput
                        {...aria}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="interest"
                render={({ field, fieldState }) => (
                  <FormField
                    id="charge-interest"
                    label="Juros (R$)"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <MoneyInput
                        {...aria}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="penalty"
                render={({ field, fieldState }) => (
                  <FormField
                    id="charge-penalty"
                    label="Multa (R$)"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <MoneyInput
                        {...aria}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  </FormField>
                )}
              />
            </fieldset>

            <FormField
              id="charge-notes"
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
              <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>
                Voltar
              </Button>
              <Button type="submit" loading={pending}>
                {isEdit ? 'Salvar' : 'Lancar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        title="Descartar alterações?"
        description="As informações preenchidas serão perdidas."
        actionLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="warning"
        onConfirm={onClose}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}
