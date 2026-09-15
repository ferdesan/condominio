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
import { formatFileSize } from '@/lib/format';
import type { DocumentFile } from '@/types/document';
import { DOCUMENTS_KEY, useUpdateDocument, useUploadDocument } from '../document-hooks';
import {
  documentFormDefaults,
  documentSchema,
  DOCUMENT_FIELDS,
  toDocumentFormData,
  toDocumentFormValues,
  toDocumentMetadataPayload,
  type DocumentFormValues,
} from '../document-schema';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPT_ATTRIBUTE,
  CATEGORY_LABELS,
  MAX_FILE_SIZE_MB,
  VISIBILITY_LABELS,
} from '../document-labels';

export interface DocumentFormDialogProps {
  /** Ausente envia um arquivo novo; presente edita os metadados do existente. */
  document?: DocumentFile;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  onClose: () => void;
}

/**
 * Envio e edicao acontecem sobre a lista para que filtros, busca e pagina
 * sobrevivam a acao (ADR-004).
 *
 * Monte este componente apenas enquanto o dialogo deve estar aberto, com `key`
 * no id do registro: os valores iniciais entram uma vez e nenhum refetch da
 * lista sobrescreve o que o usuario ja digitou.
 *
 * **O arquivo so existe no cadastro.** O servidor nao tem rota para substituir o
 * arquivo de um documento — `PATCH /documents/:id` toca somente os metadados —,
 * entao a edicao nem mostra o campo. Trocar o arquivo e enviar um documento novo
 * e excluir o antigo, e a interface nao finge o contrario.
 */
export function DocumentFormDialog({ document, condominiumId, onClose }: DocumentFormDialogProps) {
  const isEdit = Boolean(document);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema(!isEdit)),
    defaultValues: document ? toDocumentFormValues(document) : documentFormDefaults(),
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, DOCUMENT_FIELDS);
  }

  const upload = useUploadDocument({ onSuccess: onClose, onError: handleError });
  const update = useUpdateDocument({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || upload.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const request = document
      ? update.mutateAsync({ id: document.id, data: toDocumentMetadataPayload(values) })
      : upload.mutateAsync(toDocumentFormData(values, condominiumId));
    // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
    // promessa rejeitar sem dono.
    await request.catch(() => undefined);
  });

  /** Descartar o que foi preenchido precisa ser uma escolha, nao um clique fora. */
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar documento' : 'Enviar documento'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'O arquivo enviado nao muda; aqui se corrigem o titulo, a classificacao e quem pode ve-lo.'
                : 'O arquivo e as informacoes que permitem encontra-lo depois.'}
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {isEdit ? (
              // O arquivo nao e editavel, mas dizer qual e evita que alguem
              // corrija o titulo do documento errado.
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{document?.fileName}</p>
                <p className="text-muted-foreground">
                  {formatFileSize(document?.sizeBytes)} · enviado uma unica vez, sem substituicao
                </p>
              </div>
            ) : (
              <Controller
                control={control}
                name="file"
                render={({ field, fieldState }) => (
                  <FormField
                    id="file"
                    label="Arquivo"
                    error={fieldState.error?.message}
                    description={`${ACCEPTED_EXTENSIONS}. Ate ${MAX_FILE_SIZE_MB} MB.`}
                  >
                    {(aria) => (
                      <Input
                        type="file"
                        accept={ACCEPT_ATTRIBUTE}
                        // Um input de arquivo e sempre nao controlado: o valor
                        // dele nao pode ser definido por codigo. O que entra no
                        // formulario e o `File` escolhido, e nao o valor do campo.
                        onChange={(event) => field.onChange(event.target.files?.[0] ?? null)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        {...aria}
                      />
                    )}
                  </FormField>
                )}
              />
            )}

            <FormField id="title" label="Titulo" error={errors.title?.message}>
              {(aria) => <Input autoFocus maxLength={180} {...aria} {...register('title')} />}
            </FormField>

            <FormField
              id="description"
              label="Descricao"
              error={errors.description?.message}
              description="Opcional. Uma linha sobre o que o documento contem."
            >
              {(aria) => (
                <Textarea rows={3} maxLength={255} {...aria} {...register('description')} />
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
                name="visibility"
                render={({ field, fieldState }) => (
                  <FormField
                    id="visibility"
                    label="Quem ve"
                    error={fieldState.error?.message}
                    description="Vale no download; a lista continua visivel a quem administra."
                  >
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
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

            <div className="grid gap-4 sm:grid-cols-2">
              {/*
                O servidor guarda e devolve `AAAA-MM-DD`, e o input nativo fala
                exatamente esse formato; passar pelo `DatePicker` obrigaria a
                converter para `Date` e voltar, o que so adiciona fuso horario a
                um campo que nao tem hora.
              */}
              <FormField
                id="expiresAt"
                label="Validade"
                error={errors.expiresAt?.message}
                description="Opcional. Deixe em branco para documento sem prazo."
              >
                {(aria) => <Input type="date" {...aria} {...register('expiresAt')} />}
              </FormField>

              <FormField
                id="tags"
                label="Marcadores"
                error={errors.tags?.message}
                description="Opcional, separados por virgula."
              >
                {(aria) => (
                  <Input
                    placeholder="assembleia, 2026"
                    maxLength={400}
                    {...aria}
                    {...register('tags')}
                  />
                )}
              </FormField>
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
                {isEdit ? 'Salvar' : 'Enviar'}
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
