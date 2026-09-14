import { Button } from '@/components/ui/button';
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
}: ReservationRowActionsProps) {
  // Concluidas e canceladas sao imutaveis: nenhuma acao se aplica.
  const isImmutable = reservation.status === 'COMPLETED' || reservation.status === 'CANCELED';
  if (isImmutable) return null;

  const isPending = reservation.status === 'PENDING';
  const label = `${formatDateTime(reservation.startsAt)}`;

  return (
    <div className="flex items-center gap-2">
      {isPending && canManage ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Aprovar reserva de ${label}`}
            onClick={() => onAct('approve', reservation)}
          >
            Aprovar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Recusar reserva de ${label}`}
            onClick={() => onAct('reject', reservation)}
          >
            Recusar
          </Button>
        </>
      ) : null}

      {canUpdate ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Cancelar reserva de ${label}`}
          onClick={() => onAct('cancel', reservation)}
        >
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}
