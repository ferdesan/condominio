import { useState, type ReactNode } from 'react';
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
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Resident, Unit } from '@/types/api';
import type { Correspondence } from '@/types/correspondence';
import { correspondenceHooks, CORRESPONDENCES_KEY } from '../correspondence-hooks';
import {
  CORRESPONDENCE_FIELDS,
  correspondenceFormDefaults,
  correspondenceSchema,
  toCorrespondenceFormValues,
  toCorrespondencePayload,
  type CorrespondenceFormValues,
} from '../correspondence-schema';
import { NO_RESIDENT, STATUS_LABELS, TYPE_LABELS, unitLabel } from '../correspondence-labels';

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const NONE = '__none__';

export interface CorrespondenceFormDialogProps {
  /** Ausente cadastra; presente edita. */
  correspondence?: Correspondence;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  /** Unidades do condominio selecionado — a unica origem valida para o seletor. */
  units: Unit[];
  /** Moradores do condominio selecionado, pelo mesmo motivo. */
  residents: Resident[];
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
export function CorrespondenceFormDialog({
  correspondence,
  condominiumId,
  units,
  residents,
  onClose,
}: CorrespondenceFormDialogProps) {
  const isEdit = Boolean(correspondence);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CorrespondenceFormValues>({
    resolver: zodResolver(correspondenceSchema),
    defaultValues: correspondence
      ? toCorrespondenceFormValues(correspondence)
      : correspondenceFormDefaults(),
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [CORRESPONDENCES_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, CORRESPONDENCE_FIELDS);
  }

  const create = correspondenceHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = correspondenceHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toCorrespondencePayload(values, condominiumId);
    const request = correspondence
      ? update.mutateAsync({ id: correspondence.id, data })
      : create.mutateAsync(data);
    // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
    // promessa rejeitar sem dono.
    await request.catch(() => undefined);
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
            <DialogTitle>{isEdit ? 'Editar correspondencia' : 'Nova correspondencia'}</DialogTitle>
            <DialogDescription>
              O que chegou, para qual unidade e quando a portaria recebeu.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Correspondencia">
              <FormField id="description" label="Descricao" error={errors.description?.message}>
                {(aria) => <Input autoFocus {...aria} {...register('description')} />}
              </FormField>

              <Controller
                control={control}
                name="type"
                render={({ field, fieldState }) => (
                  <FormField id="type" label="Tipo" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([value, label]) => (
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
                  <FormField id="status" label="Status" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
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

              <FormField id="carrier" label="Transportadora" error={errors.carrier?.message}>
                {(aria) => <Input {...aria} {...register('carrier')} />}
              </FormField>

              <FormField
                id="trackingCode"
                label="Codigo de rastreio"
                error={errors.trackingCode?.message}
              >
                {(aria) => <Input {...aria} {...register('trackingCode')} />}
              </FormField>

              <FormField
                id="photoUrl"
                label="Foto"
                error={errors.photoUrl?.message}
                description="URL da foto registrada na portaria."
              >
                {(aria) => <Input {...aria} {...register('photoUrl')} />}
              </FormField>
            </FormSection>

            <FormSection title="Destino">
              <Controller
                control={control}
                name="unitId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="unitId"
                    label="Unidade"
                    error={fieldState.error?.message}
                    description="Apenas unidades do condominio selecionado."
                  >
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unitLabel(unit)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />

              {/*
                O destinatario nominal e opcional no servidor: a portaria nem
                sempre identifica para quem da unidade a encomenda veio.
              */}
              <Controller
                control={control}
                name="residentId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="residentId"
                    label="Destinatario"
                    error={fieldState.error?.message}
                    description="Opcional. Apenas moradores do condominio selecionado."
                  >
                    {(aria) => (
                      <Select
                        value={field.value === '' ? NONE : field.value}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                      >
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{NO_RESIDENT}</SelectItem>
                          {residents.map((resident) => (
                            <SelectItem key={resident.id} value={resident.id}>
                              {resident.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />
            </FormSection>

            <FormSection title="Recebimento">
              <Controller
                control={control}
                name="receivedAt"
                render={({ field, fieldState }) => (
                  <FormField id="receivedAt" label="Recebida em" error={fieldState.error?.message}>
                    {(aria) => (
                      <DateTimeInput {...aria} value={field.value} onChange={field.onChange} />
                    )}
                  </FormField>
                )}
              />

              <FormField
                id="receivedBy"
                label="Recebida por"
                error={errors.receivedBy?.message}
                description="Em branco, o servidor registra quem esta cadastrando."
              >
                {(aria) => <Input {...aria} {...register('receivedBy')} />}
              </FormField>
            </FormSection>

            <FormField id="notes" label="Observacoes" error={errors.notes?.message}>
              {(aria) => <Textarea {...aria} {...register('notes')} />}
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
