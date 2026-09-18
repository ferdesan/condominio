import { useState } from 'react';
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

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
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
        <DialogContent side="right" dismissible={false} className="max-w-2xl overflow-y-auto">
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
                      <Select value={field.value || NONE} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.number}
                              {unit.block?.name ? ` · ${unit.block.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Select
                        value={field.value || NONE}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                      >
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem conta</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
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
                Dinheiro entra como número decimal, e não pelo controle de moeda:
                ele guarda `number` e formata no proprio estado, o que quebraria a
                convenção de valores em texto deste projeto.
              */}
              <FormField id="charge-amount" label="Valor (R$)" error={errors.amount?.message}>
                {(aria) => (
                  <Input type="number" min={0} step="0.01" {...aria} {...register('amount')} />
                )}
              </FormField>
            </div>

            <fieldset className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
              <legend className="px-1 text-sm font-medium">Ajustes do valor</legend>

              <FormField
                id="charge-discount"
                label="Desconto (R$)"
                error={errors.discount?.message}
              >
                {(aria) => (
                  <Input type="number" min={0} step="0.01" {...aria} {...register('discount')} />
                )}
              </FormField>

              <FormField id="charge-interest" label="Juros (R$)" error={errors.interest?.message}>
                {(aria) => (
                  <Input type="number" min={0} step="0.01" {...aria} {...register('interest')} />
                )}
              </FormField>

              <FormField id="charge-penalty" label="Multa (R$)" error={errors.penalty?.message}>
                {(aria) => (
                  <Input type="number" min={0} step="0.01" {...aria} {...register('penalty')} />
                )}
              </FormField>
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
