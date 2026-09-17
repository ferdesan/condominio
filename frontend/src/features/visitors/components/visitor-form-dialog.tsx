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
import type { Unit } from '@/types/api';
import type { Visitor } from '@/types/visitor';
import { visitorHooks, VISITORS_KEY } from '../visitor-hooks';
import {
  VISITOR_FIELDS,
  VISITOR_FORM_DEFAULTS,
  toVisitorFormValues,
  toVisitorPayload,
  visitorSchema,
  type VisitorFormValues,
} from '../visitor-schema';
import { STATUS_LABELS, TYPE_LABELS, unitLabel } from '../visitor-labels';

export interface VisitorFormDialogProps {
  /** Ausente cadastra; presente edita. */
  visitor?: Visitor;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  /** Unidades do condominio selecionado — a unica origem valida para o seletor. */
  units: Unit[];
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
export function VisitorFormDialog({
  visitor,
  condominiumId,
  units,
  onClose,
}: VisitorFormDialogProps) {
  const isEdit = Boolean(visitor);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<VisitorFormValues>({
    resolver: zodResolver(visitorSchema),
    defaultValues: visitor ? toVisitorFormValues(visitor) : VISITOR_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [VISITORS_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, VISITOR_FIELDS);
  }

  const create = visitorHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = visitorHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toVisitorPayload(values, condominiumId);
    const request = visitor
      ? update.mutateAsync({ id: visitor.id, data })
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
        <DialogContent side="right" dismissible={false} className="max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar visitante' : 'Novo visitante'}</DialogTitle>
            <DialogDescription>
              Quem chega, para qual unidade e o periodo previsto da visita.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Visitante">
              <FormField id="name" label="Nome" error={errors.name?.message}>
                {(aria) => <Input autoFocus {...aria} {...register('name')} />}
              </FormField>

              <FormField
                id="document"
                label="Documento"
                error={errors.document?.message}
                description="CPF, opcional."
              >
                {(aria) => <Input inputMode="numeric" {...aria} {...register('document')} />}
              </FormField>

              <FormField id="phone" label="Telefone" error={errors.phone?.message}>
                {(aria) => <Input inputMode="tel" {...aria} {...register('phone')} />}
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
                  <FormField
                    id="status"
                    label="Status"
                    error={fieldState.error?.message}
                    description="Previsto gera o codigo de acesso da portaria."
                  >
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

              <FormField id="company" label="Empresa" error={errors.company?.message}>
                {(aria) => <Input {...aria} {...register('company')} />}
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

              <Controller
                control={control}
                name="expectedAt"
                render={({ field, fieldState }) => (
                  <FormField
                    id="expectedAt"
                    label="Previsto a partir de"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <DateTimeInput {...aria} value={field.value} onChange={field.onChange} />
                    )}
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="expectedUntil"
                render={({ field, fieldState }) => (
                  <FormField
                    id="expectedUntil"
                    label="Previsto ate"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <DateTimeInput {...aria} value={field.value} onChange={field.onChange} />
                    )}
                  </FormField>
                )}
              />
            </FormSection>

            <FormSection title="Acesso">
              <FormField id="vehiclePlate" label="Placa" error={errors.vehiclePlate?.message}>
                {(aria) => <Input {...aria} {...register('vehiclePlate')} />}
              </FormField>

              <FormField id="badgeNumber" label="Cracha" error={errors.badgeNumber?.message}>
                {(aria) => <Input {...aria} {...register('badgeNumber')} />}
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
