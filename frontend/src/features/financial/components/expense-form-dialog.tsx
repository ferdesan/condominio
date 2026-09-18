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
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { ServiceProvider } from '@/types/api';
import type { Expense, FinancialCategory } from '@/types/financial';
import { expenseHooks, EXPENSES_KEY } from '../financial-hooks';
import {
  expenseFormDefaults,
  expenseSchema,
  EXPENSE_FIELDS,
  toExpenseFormValues,
  toExpensePayload,
  type ExpenseFormValues,
} from '../financial-schema';

/** Valor sentinela do "sem vinculo": vazio nao distingue escolher de nao ter escolhido. */
const NONE = '__none__';

export interface ExpenseFormDialogProps {
  /** Ausente cadastra; presente edita. */
  expense?: Expense;
  condominiumId: string;
  categories: FinancialCategory[];
  providers: ServiceProvider[];
  onClose: () => void;
}

/**
 * Despesa do condominio.
 *
 * **O status nao e campo**, embora `createExpenseSchema` o aceite: a despesa
 * nasce a pagar e quem a liquida e `/expenses/:id/pay`, que grava a data e a
 * forma de pagamento junto. Um seletor aqui marcaria como paga uma despesa sem
 * nenhum desses dados.
 *
 * `isRecurring` e um campo de verdade, e nao um enfeite: o servidor agenda a
 * proxima ocorrencia quando a despesa recorrente e liquidada.
 */
export function ExpenseFormDialog({
  expense,
  condominiumId,
  categories,
  providers,
  onClose,
}: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const queryClient = useQueryClient();

  // "Sem conta" e "Sem prestador" são a primeira opção de cada seletor, e não um
  // estado à parte: os dois vínculos são opcionais no servidor e voltar atrás
  // precisa ser tão alcançável quanto escolher.
  const categoryOptions = useMemo(
    () => [
      { value: NONE, label: 'Sem conta' },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories],
  );

  // A razão social vai como dica: o nome fantasia é o que se reconhece, e o
  // contrato está no outro. Ela também entra na busca.
  const providerOptions = useMemo(
    () => [
      { value: NONE, label: 'Sem prestador' },
      ...providers.map((provider) => ({
        value: provider.id,
        label: provider.tradeName ?? provider.companyName,
        hint: provider.tradeName ? provider.companyName : undefined,
      })),
    ],
    [providers],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense ? toExpenseFormValues(expense) : expenseFormDefaults(),
  });

  function handleError(error: ApiError): void {
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, EXPENSE_FIELDS);
  }

  const create = expenseHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = expenseHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toExpensePayload(values, condominiumId);
    const request = expense
      ? update.mutateAsync({ id: expense.id, data })
      : create.mutateAsync(data);
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
            <DialogTitle>{isEdit ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
            <DialogDescription>
              O que o condomínio deve pagar, de que competência e a quem.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField
              id="expense-description"
              label="Descrição"
              error={errors.description?.message}
            >
              {(aria) => <Input autoFocus maxLength={180} {...aria} {...register('description')} />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="categoryId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="expense-categoryId"
                    label="Conta"
                    error={fieldState.error?.message}
                    description="Opcional. Classifica a despesa na prestação de contas."
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

              <Controller
                control={control}
                name="serviceProviderId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="expense-serviceProviderId"
                    label="Prestador"
                    error={fieldState.error?.message}
                    description="Opcional. Quem prestou o serviço ou forneceu."
                  >
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value || NONE}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                        options={providerOptions}
                        searchPlaceholder="Buscar prestador"
                        emptyMessage="Nenhum prestador corresponde à busca."
                      />
                    )}
                  </FormField>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                id="expense-competence"
                label="Competência"
                error={errors.competence?.message}
              >
                {(aria) => <Input type="month" {...aria} {...register('competence')} />}
              </FormField>

              <FormField id="expense-dueDate" label="Vencimento" error={errors.dueDate?.message}>
                {(aria) => <Input type="date" {...aria} {...register('dueDate')} />}
              </FormField>

              <FormField id="expense-amount" label="Valor (R$)" error={errors.amount?.message}>
                {(aria) => (
                  <Input type="number" min={0} step="0.01" {...aria} {...register('amount')} />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="expense-documentNumber"
                label="Nota fiscal"
                error={errors.documentNumber?.message}
                description="Opcional. O número do documento."
              >
                {(aria) => <Input maxLength={60} {...aria} {...register('documentNumber')} />}
              </FormField>

              <Controller
                control={control}
                name="isRecurring"
                render={({ field }) => (
                  <div className="flex items-start gap-2 pt-7">
                    <Checkbox
                      id="expense-isRecurring"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="expense-isRecurring" className="font-normal">
                      Recorrente — ao liquidar, o servidor agenda a próxima
                    </Label>
                  </div>
                )}
              />
            </div>

            <FormField
              id="expense-notes"
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
