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
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { FinancialCategory } from '@/types/financial';
import { categoryHooks } from '../financial-hooks';
import {
  categoryFormDefaults,
  categorySchema,
  CATEGORY_FIELDS,
  toCategoryFormValues,
  toCategoryPayload,
  type CategoryFormValues,
} from '../financial-schema';
import { CATEGORY_KIND_LABELS } from '../financial-labels';

export interface CategoryFormDialogProps {
  /** Ausente cadastra; presente edita. */
  category?: FinancialCategory;
  condominiumId: string;
  onClose: () => void;
}

/**
 * Conta do plano de contas.
 *
 * O nome e unico por condominio no banco (`@Index(..., { unique: true })`), e o
 * servidor devolve 409 sem caminho de campo quando ele repete — `applyApiError`
 * leva isso para a mensagem geral do formulario, que e onde um conflito sem
 * campo apontado consegue ser lido.
 */
export function CategoryFormDialog({ category, condominiumId, onClose }: CategoryFormDialogProps) {
  const isEdit = Boolean(category);
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category ? toCategoryFormValues(category) : categoryFormDefaults(),
  });

  function handleError(error: ApiError): void {
    applyApiError(error, setError, setFormError, CATEGORY_FIELDS);
  }

  const create = categoryHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = categoryHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toCategoryPayload(values, condominiumId);
    const request = category
      ? update.mutateAsync({ id: category.id, data })
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
        <DialogContent side="right" dismissible={false} className="max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar conta' : 'Nova conta'}</DialogTitle>
            <DialogDescription>
              As contas classificam cobranças e despesas na prestação de contas.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField id="category-name" label="Nome" error={errors.name?.message}>
              {(aria) => <Input autoFocus maxLength={120} {...aria} {...register('name')} />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="kind"
                render={({ field, fieldState }) => (
                  <FormField id="category-kind" label="Natureza" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_KIND_LABELS).map(([value, label]) => (
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
                id="category-code"
                label="Código"
                error={errors.code?.message}
                description="Opcional. O número da conta no plano."
              >
                {(aria) => <Input maxLength={20} {...aria} {...register('code')} />}
              </FormField>
            </div>

            <FormField
              id="category-description"
              label="Descrição"
              error={errors.description?.message}
              description="Opcional. O que entra nesta conta."
            >
              {(aria) => <Input maxLength={255} {...aria} {...register('description')} />}
            </FormField>

            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="category-active"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <Label htmlFor="category-active" className="font-normal">
                    Conta em uso — contas inativas seguem no histórico, mas saem dos seletores
                  </Label>
                </div>
              )}
            />

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
                {isEdit ? 'Salvar' : 'Cadastrar'}
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
