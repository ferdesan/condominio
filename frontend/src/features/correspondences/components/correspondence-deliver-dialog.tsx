import { useRef, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { formatDateTime } from '@/lib/format';
import type { Correspondence } from '@/types/correspondence';
import { CORRESPONDENCES_KEY, useDeliverCorrespondence } from '../correspondence-hooks';
import {
  DELIVER_FIELDS,
  deliverSchema,
  toDeliverPayload,
  type DeliverFormValues,
} from '../correspondence-schema';
import { unitLabel } from '../correspondence-labels';

export interface CorrespondenceDeliverDialogProps {
  correspondence: Correspondence;
  onClose: () => void;
}

/**
 * Baixa de entrega.
 *
 * E acao de linha, mas nao e um clique so: o servidor exige saber quem retirou,
 * com no minimo tres caracteres. Uma baixa anonima nao serve ao proposito do
 * registro, entao a pergunta e o dialogo.
 *
 * A recusa do servidor e um desfecho normal, e nao um erro de sistema: outra
 * pessoa pode ter dado a baixa enquanto este dialogo estava aberto. Nesses casos
 * a mensagem aparece aqui, o registro continua como estava e a lista e
 * atualizada — o que explica o desfecho em vez de parecer uma contradicao.
 *
 * O `onError` proprio substitui o toast global do React Query v5, que e o que se
 * quer aqui: a mensagem tem onde aparecer e nao deve aparecer duas vezes.
 */
export function CorrespondenceDeliverDialog({
  correspondence,
  onClose,
}: CorrespondenceDeliverDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeliverFormValues>({
    resolver: zodResolver(deliverSchema),
    defaultValues: { deliveredTo: '', deliveredAt: '', notes: '' },
  });

  function handleError(error: ApiError): void {
    queryClient.invalidateQueries({ queryKey: [CORRESPONDENCES_KEY] });
    applyApiError(error, setError, setFormError, DELIVER_FIELDS);
  }

  const deliver = useDeliverCorrespondence({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || deliver.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // `isPending` so muda no proximo tick, entao dois cliques seguidos passariam
    // os dois. O trinco fecha na hora e garante uma unica chamada.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);

    await deliver
      .mutateAsync({ id: correspondence.id, data: toDeliverPayload(values) })
      // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
      // promessa rejeitar sem dono.
      .catch(() => undefined)
      .finally(() => {
        submittingRef.current = false;
      });
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa na entrega</DialogTitle>
          <DialogDescription>
            A correspondencia passa a entregue e sai da fila de retirada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {correspondence.description ?? 'Sem descricao'} ·{' '}
            {correspondence.unit ? unitLabel(correspondence.unit) : 'Unidade removida'} · recebida em{' '}
            {formatDateTime(correspondence.receivedAt)}
          </p>

          <FormField
            id="deliveredTo"
            label="Quem retirou"
            error={errors.deliveredTo?.message}
            description="Nome de quem recebeu na portaria."
          >
            {(aria) => <Input autoFocus {...aria} {...register('deliveredTo')} />}
          </FormField>

          <Controller
            control={control}
            name="deliveredAt"
            render={({ field, fieldState }) => (
              <FormField
                id="deliveredAt"
                label="Retirada em"
                error={fieldState.error?.message}
                description="Opcional. Em branco, o servidor grava o momento da baixa."
              >
                {(aria) => (
                  <DateTimeInput {...aria} value={field.value} onChange={field.onChange} />
                )}
              </FormField>
            )}
          />

          <FormField id="deliver-notes" label="Observacoes" error={errors.notes?.message}>
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
            {/*
              "Voltar" e nao "Fechar": o botao de fechar do proprio dialogo ja
              usa esse nome, e dois controles com o mesmo nome acessivel no mesmo
              dialogo sao indistinguiveis para quem navega por leitor.
            */}
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              Dar baixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
