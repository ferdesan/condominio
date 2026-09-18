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
import type { Assembly } from '@/types/assembly';
import { assemblyHooks, ASSEMBLIES_KEY } from '../assembly-hooks';
import {
  assemblyFormDefaults,
  assemblySchema,
  ASSEMBLY_FIELDS,
  toAssemblyFormValues,
  toAssemblyPayload,
  type AssemblyFormValues,
} from '../assembly-schema';
import { ASSEMBLY_MODE_LABELS, ASSEMBLY_TYPE_LABELS } from '../assembly-labels';

/** Teto do campo de pauta no servidor. Bem acima do padrao do `Textarea`, que e 2000. */
const DESCRIPTION_MAX_LENGTH = 5_000;

export interface AssemblyFormDialogProps {
  /** Ausente cadastra; presente edita. */
  assembly?: Assembly;
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
 * A situacao nao e campo: a assembleia nasce agendada e quem a move sao as
 * acoes de linha, que tem rota propria. Um seletor aqui seria um segundo caminho
 * para a mesma transicao, sem as verificacoes que `/start`, `/finish` e
 * `/cancel` fazem. A ata e o numero de presentes tambem ficam de fora: eles sao
 * o corpo do encerramento.
 */
export function AssemblyFormDialog({ assembly, condominiumId, onClose }: AssemblyFormDialogProps) {
  const isEdit = Boolean(assembly);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AssemblyFormValues>({
    resolver: zodResolver(assemblySchema),
    defaultValues: assembly ? toAssemblyFormValues(assembly) : assemblyFormDefaults(),
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [ASSEMBLIES_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, ASSEMBLY_FIELDS);
  }

  const create = assemblyHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = assemblyHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toAssemblyPayload(values, condominiumId);
    const request = assembly
      ? update.mutateAsync({ id: assembly.id, data })
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
        <DialogContent side="right" dismissible={false} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar assembleia' : 'Nova assembleia'}</DialogTitle>
            <DialogDescription>
              A convocação: o que será deliberado, quando, onde e com que quorum.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField id="title" label="Título" error={errors.title?.message}>
              {(aria) => <Input autoFocus maxLength={180} {...aria} {...register('title')} />}
            </FormField>

            {/*
              Texto longo, e nao uma linha: a pauta e uma coluna `text` com teto
              de 5000 caracteres no servidor. O `Textarea` chega com 2000 por
              padrão, entao o limite precisa ser dito aqui — senao o próprio
              controle cortaria a pauta antes do envio.
            */}
            <FormField
              id="description"
              label="Pauta"
              error={errors.description?.message}
              description={`Os itens que serão deliberados. Até ${DESCRIPTION_MAX_LENGTH.toLocaleString('pt-BR')} caracteres.`}
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

            <div className="grid gap-4 sm:grid-cols-2">
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
                          {Object.entries(ASSEMBLY_TYPE_LABELS).map(([value, label]) => (
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
                name="mode"
                render={({ field, fieldState }) => (
                  <FormField id="mode" label="Formato" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ASSEMBLY_MODE_LABELS).map(([value, label]) => (
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

            {/*
              A secao se chama "Convocação", e nao "Horário": um `legend` com o
              texto de um rotulo de campo deixaria duas coisas com o mesmo nome
              dentro do mesmo dialogo.
            */}
            <fieldset className="space-y-4 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">Convocação</legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="scheduledAt"
                  render={({ field, fieldState }) => (
                    <FormField
                      id="scheduledAt"
                      label="Primeira chamada"
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
                  name="secondCallAt"
                  render={({ field, fieldState }) => (
                    <FormField
                      id="secondCallAt"
                      label="Segunda chamada"
                      error={fieldState.error?.message}
                      description="Opcional. Vale quando a primeira não atinge o quorum."
                    >
                      {(aria) => (
                        <DateTimeInput {...aria} value={field.value} onChange={field.onChange} />
                      )}
                    </FormField>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="location"
                  label="Local"
                  error={errors.location?.message}
                  description="Opcional em assembleia online."
                >
                  {(aria) => <Input maxLength={180} {...aria} {...register('location')} />}
                </FormField>

                <FormField
                  id="quorumPercent"
                  label="Quorum mínimo (%)"
                  error={errors.quorumPercent?.message}
                  description="Percentual de unidades presentes exigido para deliberar."
                >
                  {(aria) => (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...aria}
                      {...register('quorumPercent')}
                    />
                  )}
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="onlineUrl"
                  label="Link da transmissao"
                  error={errors.onlineUrl?.message}
                  description="Opcional. Exigido pelo servidor como endereço completo."
                >
                  {(aria) => (
                    <Input
                      inputMode="url"
                      placeholder="https://"
                      maxLength={255}
                      {...aria}
                      {...register('onlineUrl')}
                    />
                  )}
                </FormField>

                <FormField
                  id="agendaUrl"
                  label="Edital"
                  error={errors.agendaUrl?.message}
                  description="Opcional. Endereço do documento de convocação."
                >
                  {(aria) => (
                    <Input
                      inputMode="url"
                      placeholder="https://"
                      maxLength={255}
                      {...aria}
                      {...register('agendaUrl')}
                    />
                  )}
                </FormField>
              </div>
            </fieldset>

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
