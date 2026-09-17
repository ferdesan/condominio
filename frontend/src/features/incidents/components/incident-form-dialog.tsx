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
import type { Incident } from '@/types/incident';
import { incidentHooks, INCIDENTS_KEY } from '../incident-hooks';
import {
  DESCRIPTION_MAX_LENGTH,
  INCIDENT_FIELDS,
  incidentFormDefaults,
  incidentSchema,
  toIncidentFormValues,
  toIncidentPayload,
  type IncidentFormValues,
} from '../incident-schema';
import { CATEGORY_LABELS, PRIORITY_LABELS } from '../incident-labels';

export interface IncidentFormDialogProps {
  /** Ausente cadastra; presente edita. */
  incident?: Incident;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  onClose: () => void;
}

/**
 * Cadastro e edicao acontecem sobre a lista para que filtros, busca e pagina
 * sobrevivam a acao (ADR-004).
 *
 * Monte este componente apenas enquanto o dialogo deve estar aberto, com `key`
 * no id do registro: os valores iniciais entram uma vez e nenhum refetch da
 * lista sobrescreve o que o usuario ja digitou.
 *
 * Status e responsavel nao sao campos: quem os move sao as acoes de linha, que
 * verificam a transicao e — no caso da atribuicao — exigem outra permissao.
 */
export function IncidentFormDialog({ incident, condominiumId, onClose }: IncidentFormDialogProps) {
  const isEdit = Boolean(incident);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: incident ? toIncidentFormValues(incident) : incidentFormDefaults(),
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, INCIDENT_FIELDS);
  }

  const create = incidentHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = incidentHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toIncidentPayload(values, condominiumId);
    const request = incident
      ? update.mutateAsync({ id: incident.id, data })
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
            <DialogTitle>{isEdit ? 'Editar ocorrencia' : 'Nova ocorrencia'}</DialogTitle>
            <DialogDescription>
              O que aconteceu, onde, de que tipo e com que urgencia.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {/*
              O protocolo identifica a ocorrencia em toda comunicacao com o
              morador, entao aparece — mas quem o gera e o servidor, em
              `nextProtocol`, e `createIncidentSchema` sequer o aceita no corpo.
              Editavel, o campo prometeria um controle que nao existe.
            */}
            <FormField
              id="protocol"
              label="Protocolo"
              description={
                isEdit
                  ? 'Gerado pelo servidor quando a ocorrencia foi aberta.'
                  : 'Sera gerado pelo servidor ao registrar a ocorrencia.'
              }
            >
              {(aria) => (
                <Input
                  {...aria}
                  readOnly
                  value={incident?.protocol ?? ''}
                  placeholder="OC-0000-000000"
                  className="bg-muted font-mono"
                />
              )}
            </FormField>

            <FormField id="title" label="Titulo" error={errors.title?.message}>
              {(aria) => <Input autoFocus maxLength={180} {...aria} {...register('title')} />}
            </FormField>

            <FormField
              id="description"
              label="Descricao"
              error={errors.description?.message}
              description="O relato completo do que aconteceu."
            >
              {(aria) => (
                <Textarea
                  rows={6}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  {...aria}
                  {...register('description')}
                />
              )}
            </FormField>

            <FormField
              id="location"
              label="Local"
              error={errors.location?.message}
              description="Opcional. Onde no condominio, quando o lugar importa."
            >
              {(aria) => <Input maxLength={180} {...aria} {...register('location')} />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="category"
                render={({ field, fieldState }) => (
                  <FormField id="category" label="Categoria" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
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
                name="priority"
                render={({ field, fieldState }) => (
                  <FormField id="priority" label="Prioridade" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
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
            </div>

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
