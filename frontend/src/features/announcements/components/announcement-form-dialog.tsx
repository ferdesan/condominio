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
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Announcement } from '@/types/announcement';
import type { Block } from '@/types/api';
import { announcementHooks, ANNOUNCEMENTS_KEY } from '../announcement-hooks';
import {
  ANNOUNCEMENT_FIELDS,
  announcementFormDefaults,
  announcementSchema,
  CONTENT_MAX_LENGTH,
  toAnnouncementFormValues,
  toAnnouncementPayload,
  type AnnouncementFormValues,
} from '../announcement-schema';
import { AUDIENCE_LABELS, CATEGORY_LABELS } from '../announcement-labels';

export interface AnnouncementFormDialogProps {
  /** Ausente cadastra; presente edita. */
  announcement?: Announcement;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  /** Blocos do condominio selecionado — a unica origem valida para o publico-alvo. */
  blocks: Block[];
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
 * O status nao e campo: o comunicado nasce rascunho e quem o move sao as acoes
 * de linha. Um seletor aqui seria um segundo caminho para a mesma transicao, sem
 * as verificacoes que `/publish` faz.
 */
export function AnnouncementFormDialog({
  announcement,
  condominiumId,
  blocks,
  onClose,
}: AnnouncementFormDialogProps) {
  const isEdit = Boolean(announcement);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: announcement
      ? toAnnouncementFormValues(announcement)
      : announcementFormDefaults(),
  });

  const audience = watch('audience');

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, ANNOUNCEMENT_FIELDS);
  }

  const create = announcementHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = announcementHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toAnnouncementPayload(values, condominiumId);
    const request = announcement
      ? update.mutateAsync({ id: announcement.id, data })
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
            <DialogTitle>{isEdit ? 'Editar comunicado' : 'Novo comunicado'}</DialogTitle>
            <DialogDescription>
              O que sera comunicado, para quem, e se fica em destaque no mural.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField id="title" label="Titulo" error={errors.title?.message}>
              {(aria) => <Input autoFocus maxLength={180} {...aria} {...register('title')} />}
            </FormField>

            {/*
              Texto longo, e nao uma linha: o servidor guarda o conteudo numa
              coluna `text` com teto de 20000 caracteres. O `Textarea` chega com
              2000 por padrao, entao o limite precisa ser dito aqui — senao o
              proprio controle cortaria o comunicado antes do envio.
            */}
            <FormField
              id="content"
              label="Conteudo"
              error={errors.content?.message}
              description={`Texto completo do comunicado. Ate ${CONTENT_MAX_LENGTH.toLocaleString('pt-BR')} caracteres.`}
            >
              {(aria) => (
                <Textarea
                  rows={10}
                  maxLength={CONTENT_MAX_LENGTH}
                  {...aria}
                  {...register('content')}
                />
              )}
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
                name="audience"
                render={({ field, fieldState }) => (
                  <FormField id="audience" label="Publico" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
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
              So aparece quando o publico-alvo os exige — e e exatamente quando o
              servidor os exige (`assertAudience`). Fora disso a lista e enviada
              como nula, para que trocar de publico apague a selecao antiga.
            */}
            {audience === 'BLOCKS' ? (
              <Controller
                control={control}
                name="targetBlockIds"
                render={({ field, fieldState }) => (
                  <FormField
                    id="targetBlockIds"
                    label="Blocos alvo"
                    error={fieldState.error?.message}
                    description="Apenas blocos do condominio selecionado."
                  >
                    {blocks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum bloco cadastrado neste condominio.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {blocks.map((block) => {
                          const checked = field.value.includes(block.id);
                          return (
                            <div key={block.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`announcement-block-${block.id}`}
                                checked={checked}
                                onCheckedChange={(next) =>
                                  field.onChange(
                                    next === true
                                      ? [...field.value, block.id]
                                      : field.value.filter((id: string) => id !== block.id),
                                  )
                                }
                              />
                              <Label
                                htmlFor={`announcement-block-${block.id}`}
                                className="font-normal"
                              >
                                {block.name}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </FormField>
                )}
              />
            ) : null}

            <Controller
              control={control}
              name="pinned"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="announcement-pinned"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <Label htmlFor="announcement-pinned" className="font-normal">
                    Fixar no topo do mural
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
