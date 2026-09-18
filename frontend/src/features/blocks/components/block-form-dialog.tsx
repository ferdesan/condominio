import { useRef, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Block } from '@/types/api';
import { blockHooks } from '../block-hooks';
import {
  BLOCK_FIELDS,
  BLOCK_FORM_DEFAULTS,
  BLOCK_TYPE_LABELS,
  blockSchema,
  toBlockFormValues,
  toBlockPayload,
  type BlockFormValues,
} from '../block-schema';

export interface BlockFormDialogProps {
  condominiumId: string;
  /** Ausente cadastra; presente edita. */
  block?: Block;
  /** Recebe o bloco salvo — e assim que a criacao em linha o seleciona para a unidade. */
  onSaved: (block: Block) => void;
  onCancel: () => void;
  /** Texto extra no cabecalho, usado quando o dialogo sobe de dentro do formulario de unidade. */
  description?: string;
}

/**
 * Cadastro e edicao de bloco. O mesmo dialogo serve a criacao em linha, feita de
 * dentro do formulario de unidade, e a gestao de blocos da tela — sao o mesmo
 * conjunto de campos, e duplica-lo faria as duas divergirem (ADR-007).
 *
 * Monte-o apenas enquanto deve estar aberto, com `key` no id do bloco.
 */
export function BlockFormDialog({
  condominiumId,
  block,
  onSaved,
  onCancel,
  description,
}: BlockFormDialogProps) {
  const isEdit = Boolean(block);
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BlockFormValues>({
    resolver: zodResolver(blockSchema),
    defaultValues: block ? toBlockFormValues(block) : BLOCK_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    applyApiError(error, setError, setFormError, BLOCK_FIELDS);
  }

  const create = blockHooks.useCreate({ onSuccess: onSaved, onError: handleError });
  const update = blockHooks.useUpdate({ onSuccess: onSaved, onError: handleError });
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // O `isPending` da mutacao so muda no proximo tick; o trinco fecha na hora.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    const data = toBlockPayload(values, condominiumId);
    const request = block ? update.mutateAsync({ id: block.id, data }) : create.mutateAsync(data);
    // A falha ja foi apresentada por `handleError`.
    await request.catch(() => undefined);
    submittingRef.current = false;
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent side="right" dismissible={false} className="max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar bloco' : 'Novo bloco'}</DialogTitle>
          <DialogDescription>
            {description ??
              'Nome, tipo e a geometria do predio: andares, unidades por andar e elevador.'}
          </DialogDescription>
        </DialogHeader>

        <CondominiumScopeNotice condominiumId={condominiumId} />

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="block-name" label="Nome" error={errors.name?.message}>
              {(aria) => <Input autoFocus {...aria} {...register('name')} />}
            </FormField>

            <Controller
              control={control}
              name="type"
              render={({ field, fieldState }) => (
                <FormField id="block-type" label="Tipo" error={fieldState.error?.message}>
                  {(aria) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(BLOCK_TYPE_LABELS).map(([value, label]) => (
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

            {/*
              Andares e unidades por andar descrevem a mesma geometria que a
              geração em lote usa, e e de la que ela tira seus padrões (ADR-007).
            */}
            <FormField
              id="block-floors"
              label="Andares"
              error={errors.floors?.message}
              description="Entre 1 e 200."
            >
              {(aria) => <Input inputMode="numeric" {...aria} {...register('floors')} />}
            </FormField>

            <FormField
              id="block-units-per-floor"
              label="Unidades por andar"
              error={errors.unitsPerFloor?.message}
              description="Entre 0 e 100."
            >
              {(aria) => <Input inputMode="numeric" {...aria} {...register('unitsPerFloor')} />}
            </FormField>
          </div>

          <FormField id="block-description" label="Descrição" error={errors.description?.message}>
            {(aria) => <Textarea maxLength={255} rows={2} {...aria} {...register('description')} />}
          </FormField>

          <Controller
            control={control}
            name="hasElevator"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="block-has-elevator"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <Label htmlFor="block-has-elevator" className="font-normal">
                  Possui elevador
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
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? 'Salvar bloco' : 'Criar bloco'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
