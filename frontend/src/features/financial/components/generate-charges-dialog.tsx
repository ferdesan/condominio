import { useMemo, useState } from 'react';
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
import { Combobox } from '@/components/ui/combobox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { formatNumber } from '@/lib/format';
import type { FinancialCategory, GenerateChargesResult } from '@/types/financial';
import { useGenerateCharges } from '../financial-hooks';
import {
  generateChargesSchema,
  generateFormDefaults,
  GENERATE_FIELDS,
  toGeneratePayload,
  type GenerateFormValues,
} from '../financial-schema';

/** Valor sentinela do "sem conta": vazio nao distingue escolher de nao ter escolhido. */
const NONE = '__none__';

export interface GenerateChargesDialogProps {
  condominiumId: string;
  categories: FinancialCategory[];
  onClose: () => void;
}

/**
 * Geracao em lote das taxas do mes.
 *
 * O servidor decide o valor de cada cobranca em tres niveis: o valor fixo
 * informado aqui, ou o rateio do total pelas fracoes ideais, ou — quando nenhum
 * dos dois vem — a taxa cadastrada em cada unidade. Os dois campos sao
 * mutuamente exclusivos, e o formulario diz isso em vez de deixar o servidor
 * escolher em silencio.
 *
 * O resultado fica na tela depois do envio: "gerou" sem quantidade nao diz se a
 * competencia ja tinha cobrancas — e o servidor pula as unidades que ja tem.
 */
export function GenerateChargesDialog({
  condominiumId,
  categories,
  onClose,
}: GenerateChargesDialogProps) {
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
  const [result, setResult] = useState<GenerateChargesResult | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GenerateFormValues>({
    resolver: zodResolver(generateChargesSchema),
    defaultValues: generateFormDefaults(),
  });

  const generate = useGenerateCharges({
    onSuccess: setResult,
    onError: (error: ApiError) => applyApiError(error, setError, setFormError, GENERATE_FIELDS),
  });

  const pending = isSubmitting || generate.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setResult(null);
    await generate.mutateAsync(toGeneratePayload(values, condominiumId)).catch(() => undefined);
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent side="right" dismissible={false} className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar cobranças do mês</DialogTitle>
          <DialogDescription>
            Uma cobrança por unidade na competência escolhida. Unidades que já tiverem cobrança
            nessa competência sao puladas.
          </DialogDescription>
        </DialogHeader>

        <CondominiumScopeNotice condominiumId={condominiumId} />

        {result ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm"
            >
              <p className="font-medium">
                {formatNumber(result.created)} cobranças geradas de {formatNumber(result.total)}{' '}
                unidades.
              </p>
              {result.skipped > 0 ? (
                <p className="text-muted-foreground">
                  {formatNumber(result.skipped)} já tinham cobrança nesta competência e foram
                  puladas.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="generate-referenceMonth"
                label="Competência"
                error={errors.referenceMonth?.message}
              >
                {(aria) => (
                  <Input autoFocus type="month" {...aria} {...register('referenceMonth')} />
                )}
              </FormField>

              <FormField id="generate-dueDate" label="Vencimento" error={errors.dueDate?.message}>
                {(aria) => <Input type="date" {...aria} {...register('dueDate')} />}
              </FormField>
            </div>

            <FormField
              id="generate-description"
              label="Descrição"
              error={errors.description?.message}
              description="Aparece em todas as cobranças geradas."
            >
              {(aria) => <Input maxLength={180} {...aria} {...register('description')} />}
            </FormField>

            <Controller
              control={control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <FormField
                  id="generate-categoryId"
                  label="Conta"
                  error={fieldState.error?.message}
                  description="Opcional."
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

            {/*
              A secao se chama "Como calcular", e nao "Valor": o `legend` nao pode
              repetir o texto de um rotulo de campo dentro do mesmo dialogo.
            */}
            <fieldset className="space-y-4 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">Como calcular</legend>
              <p className="text-sm text-muted-foreground">
                Deixe os dois em branco para usar a taxa cadastrada em cada unidade.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="generate-fixedAmount"
                  label="Valor fixo por unidade (R$)"
                  error={errors.fixedAmount?.message}
                >
                  {(aria) => (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...aria}
                      {...register('fixedAmount')}
                    />
                  )}
                </FormField>

                <FormField
                  id="generate-totalToApportion"
                  label="Total a ratear (R$)"
                  error={errors.totalToApportion?.message}
                  description="Dividido pelas frações ideais das unidades."
                >
                  {(aria) => (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...aria}
                      {...register('totalToApportion')}
                    />
                  )}
                </FormField>
              </div>
            </fieldset>

            <Controller
              control={control}
              name="onlyOccupied"
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="generate-onlyOccupied"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <Label htmlFor="generate-onlyOccupied" className="font-normal">
                    Somente unidades ocupadas
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
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                Voltar
              </Button>
              <Button type="submit" loading={pending}>
                Gerar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
