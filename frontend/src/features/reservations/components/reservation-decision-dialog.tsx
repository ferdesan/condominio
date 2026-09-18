import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { formatDateTime } from '@/lib/format';
import type { Reservation } from '@/types/api';
import {
  useApproveReservation,
  useCancelReservation,
  useRejectReservation,
  RESERVATIONS_KEY,
} from '../reservation-hooks';
import { decisionSchema, type DecisionFormValues } from '../reservation-rules';
import type { ReservationAction } from './reservation-row-actions';

const COPY: Record<ReservationAction, { title: string; description: string; submit: string }> = {
  approve: {
    title: 'Aprovar reserva',
    description: 'A reserva passa a confirmada. O motivo e opcional e fica registrado na decisao.',
    submit: 'Aprovar',
  },
  reject: {
    title: 'Recusar reserva',
    description: 'A reserva passa a recusada e o horário volta a ficar livre. O motivo e opcional.',
    submit: 'Recusar',
  },
  cancel: {
    title: 'Cancelar reserva',
    description: 'A reserva passa a cancelada e sai do calendário. O motivo e opcional.',
    submit: 'Cancelar reserva',
  },
};

const REASON_FIELD: ReadonlySet<string> = new Set(['reason']);

export interface ReservationDecisionDialogProps {
  action: ReservationAction;
  reservation: Reservation;
  onClose: () => void;
}

/**
 * Aprovacao, recusa e cancelamento — as tres postam o mesmo corpo opcional e
 * diferem apenas na rota e na permissao exigida.
 *
 * A recusa do servidor e um desfecho normal, nao um erro de sistema: a
 * aprovacao revalida o horario e pode encontrar outra reserva confirmada no
 * meio tempo. Nesses casos a mensagem do servidor aparece no dialogo, a
 * reserva continua como estava e a lista e atualizada — o que explica o
 * desfecho em vez de parecer uma contradicao.
 *
 * O `onError` proprio substitui o toast global do React Query v5, que e o que
 * se quer aqui: a mensagem tem onde aparecer.
 */
export function ReservationDecisionDialog({
  action,
  reservation,
  onClose,
}: ReservationDecisionDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { reason: '' },
  });

  function handleError(error: ApiError): void {
    // A recusa descreve um estado que a tela ainda nao reflete — outra pessoa
    // decidiu, ou o horario foi tomado. Atualizar a lista faz parte da resposta.
    queryClient.invalidateQueries({ queryKey: [RESERVATIONS_KEY] });
    applyApiError(error, setError, setFormError, REASON_FIELD);
  }

  const callbacks = { onSuccess: onClose, onError: handleError };
  const approve = useApproveReservation(callbacks);
  const reject = useRejectReservation(callbacks);
  const cancel = useCancelReservation(callbacks);

  const mutation = action === 'approve' ? approve : action === 'reject' ? reject : cancel;
  const pending = isSubmitting || mutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // `isPending` so muda no proximo tick, entao dois cliques seguidos passariam
    // os dois. O trinco fecha na hora e garante uma unica chamada.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);

    await mutation
      .mutateAsync({ id: reservation.id, reason: values.reason === '' ? null : values.reason })
      // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
      // promessa rejeitar sem dono.
      .catch(() => undefined)
      .finally(() => {
        submittingRef.current = false;
      });
  });

  const copy = COPY[action];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent side="right" dismissible={false}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {reservation.commonArea?.name ?? 'Área indisponível'} ·{' '}
            {formatDateTime(reservation.startsAt)} · {reservation.requestedByName}
          </p>

          <FormField
            id="reason"
            label="Motivo (opcional)"
            error={errors.reason?.message}
            description="Até 255 caracteres. Fica visível na reserva."
          >
            {(aria) => <Textarea autoFocus {...aria} {...register('reason')} />}
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
              usa esse nome, e dois controles com o mesmo nome acessível no
              mesmo dialogo sao indistinguíveis para quem navega por leitor.
            */}
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
