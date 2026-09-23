import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
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
import { DateTimeInput } from '@/components/ui/date-time-input';
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
import type { Poll } from '@/types/assembly';
import { pollHooks } from '../assembly-hooks';
import {
  pollFormDefaults,
  pollSchema,
  POLL_FIELDS,
  toPollFormValues,
  toPollPayload,
  type PollFormValues,
} from '../assembly-schema';
import { POLL_VOTER_LABELS } from '../assembly-labels';

/** Minimo exigido pelo servidor; abaixo disso a votacao nao decide nada. */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;

export interface PollFormDialogProps {
  /** Ausente cadastra; presente edita. */
  poll?: Poll;
  condominiumId: string;
  /** Assembleia a que a votacao pertence; `null` cria uma consulta avulsa. */
  assemblyId: string | null;
  onClose: () => void;
}

/**
 * Cadastro e edicao de uma deliberacao.
 *
 * **As alternativas so existem no cadastro.** `updatePollSchema` as omite de
 * proposito no servidor: mudar as opcoes de uma votacao que ja recebeu votos
 * invalidaria a apuracao, porque os contadores vivem em cada opcao. A edicao
 * alcanca o enunciado e as regras, e a interface diz isso em vez de oferecer
 * campos que o PATCH descartaria em silencio.
 */
export function PollFormDialog({ poll, condominiumId, assemblyId, onClose }: PollFormDialogProps) {
  const isEdit = Boolean(poll);
  // Apos o rascunho o servidor recusa trocar publico/segredo (prepareUpdate);
  // o form espelha a regra em vez de mandar um PATCH que volta 409.
  const rulesLocked = isEdit && poll?.status !== 'DRAFT';
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PollFormValues>({
    resolver: zodResolver(pollSchema),
    defaultValues: poll ? toPollFormValues(poll) : pollFormDefaults(),
  });

  const options = useFieldArray({ control, name: 'options' });

  function handleError(error: ApiError): void {
    applyApiError(error, setError, setFormError, POLL_FIELDS);
  }

  const create = pollHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = pollHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = toPollPayload(values, condominiumId, assemblyId);

    if (poll) {
      // As alternativas ficam de fora: o servidor as descartaria, e manda-las
      // sugeriria que foram salvas.
      const { options: _options, ...data } = payload;
      await update.mutateAsync({ id: poll.id, data }).catch(() => undefined);
      return;
    }

    await create.mutateAsync(payload).catch(() => undefined);
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
            <DialogTitle>{isEdit ? 'Editar deliberação' : 'Nova deliberação'}</DialogTitle>
            <DialogDescription>
              A pergunta que será votada, quem pode votar e até quando.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField id="poll-title" label="Pergunta" error={errors.title?.message}>
              {(aria) => <Input autoFocus maxLength={180} {...aria} {...register('title')} />}
            </FormField>

            <FormField
              id="poll-description"
              label="Detalhamento"
              error={errors.description?.message}
              description="Opcional. O contexto que o votante precisa para decidir."
            >
              {(aria) => (
                <Textarea rows={4} maxLength={5000} {...aria} {...register('description')} />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="startsAt"
                render={({ field, fieldState }) => (
                  <FormField id="poll-startsAt" label="Abre em" error={fieldState.error?.message}>
                    {(aria) => (
                      <DateTimeInput
                        {...aria}
                        value={field.value}
                        onChange={field.onChange}
                        disabled={rulesLocked}
                      />
                    )}
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="endsAt"
                render={({ field, fieldState }) => (
                  <FormField id="poll-endsAt" label="Encerra em" error={fieldState.error?.message}>
                    {(aria) => (
                      <DateTimeInput
                        {...aria}
                        value={field.value}
                        onChange={field.onChange}
                        disabled={rulesLocked}
                      />
                    )}
                  </FormField>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="voterType"
                render={({ field, fieldState }) => (
                  <FormField
                    id="poll-voterType"
                    label="Quem vota"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={rulesLocked}
                      >
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(POLL_VOTER_LABELS).map(([value, label]) => (
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
                id="poll-quorumPercent"
                label="Quorum mínimo (%)"
                error={errors.quorumPercent?.message}
                description="Participação exigida para a apuração valer."
              >
                {(aria) => (
                  <Input type="number" min={0} max={100} {...aria} {...register('quorumPercent')} />
                )}
              </FormField>
            </div>

            <div className="space-y-2">
              <Controller
                control={control}
                name="weightedByFraction"
                render={({ field }) => (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="poll-weighted"
                      checked={field.value}
                      disabled={rulesLocked}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="poll-weighted" className="font-normal">
                      Ponderar o voto pela fração ideal da unidade
                    </Label>
                  </div>
                )}
              />

              <Controller
                control={control}
                name="isSecret"
                render={({ field }) => (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="poll-secret"
                      checked={field.value}
                      disabled={rulesLocked}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="poll-secret" className="font-normal">
                      Votação secreta — os votos individuais não poderao ser consultados
                    </Label>
                  </div>
                )}
              />
            </div>

            {isEdit ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                As alternativas não podem ser alteradas depois de criadas: os votos já registrados
                pertencem a cada uma delas.
              </p>
            ) : (
              /*
                A secao se chama "Alternativas", e nao "Opções": o `legend` nao
                pode repetir o texto de um rotulo de campo dentro do mesmo
                dialogo, sob pena de deixar duas coisas com o mesmo nome.
              */
              <fieldset className="space-y-3 rounded-md border border-border p-4">
                <legend className="px-1 text-sm font-medium">Alternativas</legend>

                {options.fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-2">
                    <FormField
                      id={`poll-option-${index}`}
                      label={`Alternativa ${index + 1}`}
                      error={errors.options?.[index]?.label?.message}
                      className="flex-1"
                    >
                      {(aria) => (
                        <Input
                          maxLength={180}
                          {...aria}
                          {...register(`options.${index}.label` as const)}
                        />
                      )}
                    </FormField>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      // O minimo do servidor e dois: remover abaixo disso criaria
                      // uma votacao que o proprio backend recusaria.
                      disabled={options.fields.length <= MIN_OPTIONS}
                      aria-label={`Remover alternativa ${index + 1}`}
                      onClick={() => options.remove(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}

                {errors.options?.root || errors.options?.message ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.options.root?.message ?? errors.options.message}
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={options.fields.length >= MAX_OPTIONS}
                  onClick={() => options.append({ label: '' })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Adicionar alternativa
                </Button>
              </fieldset>
            )}

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
                {isEdit ? 'Salvar' : 'Criar deliberação'}
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
