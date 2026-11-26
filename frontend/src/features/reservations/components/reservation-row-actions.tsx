import { RowAction, RowActions } from '@/components/ui/row-actions';
import { Ban, CalendarCheck, CalendarX, Pencil } from 'lucide-react';

import { formatDateTime } from '@/lib/format';
import type { Reservation } from '@/types/api';

export type ReservationAction = 'approve' | 'reject' | 'cancel';

export interface ReservationRowActionsProps {
  reservation: Reservation;
  /** Aprovar e recusar exigem `reservation:manage`. */
  canManage: boolean;
  /** Cancelar exige apenas `reservation:update`. */
  canUpdate: boolean;
  onAct: (action: ReservationAction, reservation: Reservation) => void;
  /** Editar exige `reservation:update`; so pendentes e confirmadas se editam. */
  onEdit?: (reservation: Reservation) => void;
}

/**
 * Acoes de decisao da linha (ADR-003): a aprovacao vive onde a reserva esta,
 * para que uma fila de dez pendentes seja resolvida sem sair da lista.
 *
 * Um operador ve cancelar e nao ve aprovar nem recusar — a mesma divisao que o
 * servidor faz entre `reservation:update` e `reservation:manage`.
 *
 * Cancelar continua oferecido para uma reserva ja iniciada: quem decide se a
 * restricao de administracao se aplica e o servidor, e a mensagem dele e a
 * resposta certa. Duplicar a regra aqui so criaria uma segunda versao dela.
 */
export function ReservationRowActions({
  reservation,
  canManage,
  canUpdate,
  onAct,
  onEdit,
}: ReservationRowActionsProps) {
  // Concluidas e canceladas sao imutaveis: nenhuma acao se aplica.
  const isImmutable = reservation.status === 'COMPLETED' || reservation.status === 'CANCELED';
  if (isImmutable) return null;

  const isPending = reservation.status === 'PENDING';
  // Recusada ainda pode ser cancelada, mas nao editada: o servidor so altera
  // pendentes e confirmadas.
  const isEditable = isPending || reservation.status === 'CONFIRMED';
  const label = `${formatDateTime(reservation.startsAt)}`;

  return (
    <RowActions>
      {isEditable && canUpdate && onEdit ? (
        <RowAction
          icon={Pencil}
          label={`Editar reserva de ${label}`}
          onClick={() => onEdit(reservation)}
        />
      ) : null}

      {isPending && canManage ? (
        <>
          <RowAction
            icon={CalendarCheck}
            label={`Aprovar reserva de ${label}`}
            onClick={() => onAct('approve', reservation)}
          />
          <RowAction
            icon={CalendarX}
            tone="destructive"
            label={`Recusar reserva de ${label}`}
            onClick={() => onAct('reject', reservation)}
          />
        </>
      ) : null}

      {canUpdate ? (
        <RowAction
          icon={Ban}
          tone="destructive"
          label={`Cancelar reserva de ${label}`}
          onClick={() => onAct('cancel', reservation)}
        />
      ) : null}
    </RowActions>
  );
}
