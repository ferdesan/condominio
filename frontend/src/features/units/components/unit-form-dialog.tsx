import { useRef, useState, type ReactNode } from 'react';
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
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { useAuth } from '@/hooks/use-auth';
import type { Block, Unit } from '@/types/api';
import { UNITS_KEY, unitHooks } from '../unit-hooks';
import { defaultBlockId } from '../block-schema';
import {
  UNIT_FIELDS,
  UNIT_FORM_DEFAULTS,
  UNIT_STATUS_LABELS,
  UNIT_TYPE_LABELS,
  toUnitFormValues,
  toUnitPayload,
  unitSchema,
  type UnitFormValues,
} from '../unit-schema';
import { BlockSelectField } from './block-select-field';

/**
 * Ocupada e vaga sao recalculadas pelo modulo de moradores e sobrescrevem o que
 * for escolhido aqui; reforma e bloqueada persistem. Os quatro continuam sendo
 * oferecidos — o enum do servidor aceita os quatro —, mas a tela diz o que
 * acontece, e o que aparece depois de salvar e sempre o que o servidor devolveu.
 */
const STATUS_NOTE =
  'Ocupada e Vaga sao recalculadas a partir dos moradores da unidade e substituem o valor escolhido aqui. Em reforma e Bloqueada permanecem ate serem alteradas.';

export interface UnitFormDialogProps {
  condominiumId: string;
  /** Ausente cadastra; presente edita. */
  unit?: Unit;
  blocks: Block[];
  blocksLoading: boolean;
  onClose: () => void;
}

/**
 * Cadastro e edicao acontecem sobre a lista para que filtros, busca e pagina
 * sobrevivam a acao (ADR-004).
 *
 * Monte este componente apenas enquanto o dialogo deve estar aberto, com `key`
 * no id do registro: os valores iniciais entram uma vez e nenhum refetch da
 * lista sobrescreve o que o usuario ja digitou.
 */
export function UnitFormDialog({
  condominiumId,
  unit,
  blocks,
  blocksLoading,
  onClose,
}: UnitFormDialogProps) {
  const isEdit = Boolean(unit);
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  /** Bloco criado em linha nesta sessao do dialogo, para poder dizer que ele ficou. */
  const [createdBlock, setCreatedBlock] = useState<Block | null>(null);
  const submittingRef = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    // O bloco entra pelos valores iniciais, nao por um efeito: preenche-lo depois
    // marcaria o formulario como alterado e faria o fechamento pedir confirmacao
    // de algo que o usuario nao digitou.
    defaultValues: unit
      ? toUnitFormValues(unit)
      : { ...UNIT_FORM_DEFAULTS, blockId: defaultBlockId(blocks) },
  });

  function handleError(error: ApiError): void {
    // Na edicao, 404 e a unidade que sumiu enquanto o dialogo estava aberto:
    // insistir no formulario nao leva a lugar nenhum, entao fechamos e deixamos a
    // lista contar o que ha. No cadastro nao ha unidade ainda — um 404 so pode
    // ser o bloco escolhido, que foi removido enquanto o formulario estava
    // aberto. Fechar ali descartaria o preenchido sem explicar nada.
    if (error.status === 404 && unit) {
      queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, UNIT_FIELDS);
  }

  const create = unitHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = unitHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo passariam os dois. O trinco fecha na hora.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    const data = toUnitPayload(values, condominiumId);
    const request = unit
      ? update.mutateAsync({ id: unit.id, data })
      : create.mutateAsync(data);
    // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
    // promessa rejeitar sem dono.
    await request.catch(() => undefined);
    submittingRef.current = false;
  });

  /** Descartar o que foi digitado precisa ser uma escolha, nao um clique fora. */
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar unidade' : 'Nova unidade'}</DialogTitle>
            <DialogDescription>
              A unidade pertence ao condominio selecionado no topo da aplicacao.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Identificacao">
              <Controller
                control={control}
                name="blockId"
                render={({ field, fieldState }) => (
                  <BlockSelectField
                    id="unit-block"
                    condominiumId={condominiumId}
                    blocks={blocks}
                    loading={blocksLoading}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    canCreate={can('block:create')}
                    onBlockCreated={setCreatedBlock}
                  />
                )}
              />

              <FormField id="unit-number" label="Numero" error={errors.number?.message}>
                {(aria) => <Input autoFocus {...aria} {...register('number')} />}
              </FormField>

              <FormField
                id="unit-floor"
                label="Andar"
                error={errors.floor?.message}
                description="Entre -10 e 200."
              >
                {(aria) => <Input inputMode="numeric" {...aria} {...register('floor')} />}
              </FormField>

              <Controller
                control={control}
                name="type"
                render={({ field, fieldState }) => (
                  <FormField id="unit-type" label="Tipo" error={fieldState.error?.message}>
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

              <Controller
                control={control}
                name="status"
                render={({ field, fieldState }) => (
                  <FormField
                    id="unit-status"
                    label="Status"
                    error={fieldState.error?.message}
                    description={STATUS_NOTE}
                    className="sm:col-span-2"
                  >
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(UNIT_STATUS_LABELS).map(([value, label]) => (
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
            </FormSection>

            <FormSection title="Caracteristicas">
              <FormField
                id="unit-area"
                label="Area (m2)"
                error={errors.area?.message}
                description="Opcional."
              >
                {(aria) => <Input inputMode="decimal" {...aria} {...register('area')} />}
              </FormField>

              <FormField
                id="unit-ideal-fraction"
                label="Fracao ideal"
                error={errors.idealFraction?.message}
                description="Entre 0 e 1. Opcional."
              >
                {(aria) => <Input inputMode="decimal" {...aria} {...register('idealFraction')} />}
              </FormField>

              <FormField id="unit-monthly-fee" label="Taxa mensal" error={errors.monthlyFee?.message}>
                {(aria) => <Input inputMode="decimal" {...aria} {...register('monthlyFee')} />}
              </FormField>

              <FormField id="unit-bedrooms" label="Dormitorios" error={errors.bedrooms?.message}>
                {(aria) => <Input inputMode="numeric" {...aria} {...register('bedrooms')} />}
              </FormField>

              <FormField id="unit-parking-spots" label="Vagas" error={errors.parkingSpots?.message}>
                {(aria) => <Input inputMode="numeric" {...aria} {...register('parkingSpots')} />}
              </FormField>

              <Controller
                control={control}
                name="petsAllowed"
                render={({ field }) => (
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox
                      id="unit-pets-allowed"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="unit-pets-allowed" className="font-normal">
                      Permite animais
                    </Label>
                  </div>
                )}
              />
            </FormSection>

            <FormSection title="Observacoes" columns={1}>
              <FormField id="unit-notes" label="Observacoes" error={errors.notes?.message}>
                {(aria) => <Textarea {...aria} {...register('notes')} />}
              </FormField>
            </FormSection>

            {formError ? (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <p>{formError}</p>
                {/*
                  O bloco foi criado antes de a unidade falhar, e continua criado.
                  Sem dizer isso, o usuario nao sabe o que ficou salvo.
                */}
                {createdBlock ? (
                  <p className="mt-1 text-xs">
                    O bloco &quot;{createdBlock.name}&quot; foi criado e continua cadastrado; apenas
                    a unidade nao foi salva.
                  </p>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>
                Cancelar
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
        title="Descartar alteracoes?"
        description="As informacoes preenchidas serao perdidas."
        actionLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="warning"
        onConfirm={onClose}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}

function FormSection({
  title,
  columns = 3,
  children,
}: {
  title: string;
  columns?: 1 | 3;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-foreground">{title}</legend>
      <div className={columns === 1 ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-3'}>{children}</div>
    </fieldset>
  );
}
