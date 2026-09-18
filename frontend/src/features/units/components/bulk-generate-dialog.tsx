import { useRef, useState } from 'react';
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
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { applyApiError } from '@/lib/form-errors';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import type { Block } from '@/types/api';
import { unitHooks, useBulkCreateUnits } from '../unit-hooks';
import { defaultBlockId } from '@/features/blocks/block-schema';
import { UNIT_TYPE_LABELS } from '../unit-schema';
import {
  BULK_GENERATE_FIELDS,
  BULK_GENERATE_FORM_DEFAULTS,
  BULK_LARGE_GRID,
  bulkGenerateSchema,
  composeUnitNumber,
  projectedUnitCount,
  toBulkGeneratePayload,
  type BulkGenerateFormValues,
} from '../bulk-generate-schema';
import { BlockSelectField } from './block-select-field';

/** Codigo do 409 que o servidor usa quando todos os numeros ja existem. */
const BUSINESS_RULE = 'BUSINESS_RULE_VIOLATION';

export interface BulkGenerateDialogProps {
  condominiumId: string;
  blocks: Block[];
  blocksLoading: boolean;
  onClose: () => void;
}

/**
 * Geracao em lote: o caminho de onboarding de um predio inteiro (ADR-005).
 *
 * Duas coisas a tela precisa deixar claras. Antes de confirmar, quantas unidades
 * serao pedidas — e, se o bloco ja tiver unidades, que a sobreposicao sera
 * pulada. Depois, quantas o servidor realmente criou, que pode ser menos. Uma
 * geracao em que todos os numeros ja existem e recusada com 409, e isso e um
 * desfecho, nao uma falha de sistema: ela e apresentada como tal.
 */
export function BulkGenerateDialog({
  condominiumId,
  blocks,
  blocksLoading,
  onClose,
}: BulkGenerateDialogProps) {
  const { can } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  /** Recusa de regra de negocio: desfecho, nao erro. Fica em uma regiao propria. */
  const [outcome, setOutcome] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const submittingRef = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BulkGenerateFormValues>({
    resolver: zodResolver(bulkGenerateSchema),
    defaultValues: { ...BULK_GENERATE_FORM_DEFAULTS, blockId: defaultBlockId(blocks) },
  });

  const values = useWatch({ control });
  const floors = Number(values.floors);
  const unitsPerFloor = Number(values.unitsPerFloor);
  const startFloor = Number(values.startFloor);
  const projected = projectedUnitCount(floors, unitsPerFloor);
  const pattern = values.numberPattern ?? '';
  const blockId = values.blockId ?? '';

  const firstNumber = Number.isFinite(startFloor) ? composeUnitNumber(pattern, startFloor, 1) : '';
  const lastNumber =
    Number.isFinite(startFloor) && Number.isFinite(floors) && Number.isFinite(unitsPerFloor)
      ? composeUnitNumber(pattern, startFloor + floors - 1, unitsPerFloor)
      : '';

  // Quantas unidades o bloco escolhido ja tem. Serve para avisar da sobreposicao
  // antes de confirmar — a geracao pula numeros existentes, entao gerar sobre um
  // bloco povoado nao e destrutivo, mas tambem nao cria o que ja esta la.
  const existing = unitHooks.useCount({ condominiumId, blockId }, { enabled: blockId !== '' });
  const existingCount = existing.data ?? 0;

  const generate = useBulkCreateUnits({
    onSuccess: (result) => setCreated(result.created),
    onError: (error) => {
      if (error.code === BUSINESS_RULE) {
        setOutcome(error.message);
        return;
      }
      applyApiError(error, setError, setFormError, BULK_GENERATE_FIELDS);
    },
  });

  const pending = isSubmitting || generate.isPending;

  const onSubmit = handleSubmit(async (submitted) => {
    // O `isPending` da mutacao so muda no proximo tick; o trinco fecha na hora.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    setOutcome(null);
    await generate
      .mutateAsync(toBulkGeneratePayload(submitted, condominiumId))
      .catch(() => undefined);
    submittingRef.current = false;
  });

  // Depois de gerar, o formulario deu lugar ao resultado: o numero criado e a
  // unica coisa que importa, e gerar de novo com os mesmos valores nao criaria nada.
  if (created !== null) {
    return (
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent side="right" dismissible={false}>
          <DialogHeader>
            <DialogTitle>Geração concluida</DialogTitle>
          </DialogHeader>

          <p role="status" className="text-sm">
            {created === 0
              ? 'Nenhuma unidade nova foi criada.'
              : `${formatNumber(created)} ${created === 1 ? 'unidade criada' : 'unidades criadas'}.`}
            {created < projected
              ? ` De ${formatNumber(projected)} números pedidos, os que já existiam no bloco foram mantidos como estavam.`
              : ''}
          </p>

          <DialogFooter>
            <Button onClick={onClose}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent side="right" dismissible={false} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar unidades</DialogTitle>
          <DialogDescription>
            Cria as unidades de um bloco inteiro em uma operação. Números que já existem no bloco
            sao mantidos como estao.
          </DialogDescription>
        </DialogHeader>

        <CondominiumScopeNotice condominiumId={condominiumId} />

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Controller
            control={control}
            name="blockId"
            render={({ field, fieldState }) => (
              <BlockSelectField
                id="bulk-block"
                condominiumId={condominiumId}
                blocks={blocks}
                loading={blocksLoading}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                canCreate={can('block:create')}
              />
            )}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="bulk-floors"
              label="Andares"
              error={errors.floors?.message}
              description="Entre 1 e 100."
            >
              {(aria) => <Input inputMode="numeric" {...aria} {...register('floors')} />}
            </FormField>

            <FormField
              id="bulk-units-per-floor"
              label="Unidades por andar"
              error={errors.unitsPerFloor?.message}
              description="Entre 1 e 50."
            >
              {(aria) => <Input inputMode="numeric" {...aria} {...register('unitsPerFloor')} />}
            </FormField>

            <FormField
              id="bulk-start-floor"
              label="Andar inicial"
              error={errors.startFloor?.message}
              description="Entre 0 e 100."
            >
              {(aria) => <Input inputMode="numeric" {...aria} {...register('startFloor')} />}
            </FormField>
          </div>

          <FormField
            id="bulk-number-pattern"
            label="Padrão de numeração"
            error={errors.numberPattern?.message}
            description="Use {floor} para o andar e {index} para a posicao, que sai com dois digitos."
          >
            {(aria) => <Input {...aria} {...register('numberPattern')} />}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <Controller
              control={control}
              name="type"
              render={({ field, fieldState }) => (
                <FormField id="bulk-type" label="Tipo" error={fieldState.error?.message}>
                  {(aria) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
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

            <FormField id="bulk-monthly-fee" label="Taxa mensal" error={errors.monthlyFee?.message}>
              {(aria) => <Input inputMode="decimal" {...aria} {...register('monthlyFee')} />}
            </FormField>

            <FormField
              id="bulk-area"
              label="Área (m2)"
              error={errors.area?.message}
              description="Opcional."
            >
              {(aria) => <Input inputMode="decimal" {...aria} {...register('area')} />}
            </FormField>
          </div>

          {/* A projecao antes de confirmar: quantas unidades e com quais numeros. */}
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <p>
              Serão geradas <strong>{formatNumber(projected)}</strong>{' '}
              {projected === 1 ? 'unidade' : 'unidades'}
              {firstNumber && lastNumber ? (
                <>
                  , de <strong>{firstNumber}</strong> a <strong>{lastNumber}</strong>
                </>
              ) : null}
              .
            </p>
            {blockId && existingCount > 0 ? (
              <p className="mt-1 text-muted-foreground">
                Este bloco já possui {formatNumber(existingCount)}{' '}
                {existingCount === 1 ? 'unidade' : 'unidades'}. Números que já existem serão pulados
                e nada do que esta cadastrado será alterado.
              </p>
            ) : null}
            {projected >= BULK_LARGE_GRID ? (
              <p className="mt-1 text-muted-foreground">
                Um lote deste tamanho leva alguns instantes para ser criado.
              </p>
            ) : null}
          </div>

          {/*
            Recusa de regra de negocio. Nao usa `role="alert"` nem a cor de erro:
            "todos os números já existem" e o relato de um desfecho, e apresenta-lo
            como falha de sistema faria o operador procurar um problema que não ha.
          */}
          {outcome ? (
            <div role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
              <p>{outcome}</p>
              <p className="mt-1 text-muted-foreground">
                Nada foi alterado. As unidades do bloco continuam como estavam.
              </p>
            </div>
          ) : null}

          {formError ? (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}

          {pending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Gerando {formatNumber(projected)} {projected === 1 ? 'unidade' : 'unidades'}...
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Gerar {formatNumber(projected)} {projected === 1 ? 'unidade' : 'unidades'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
