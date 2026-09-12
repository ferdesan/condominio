import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Reservation } from './reservation.entity';

export class ReservationRepository extends BaseRepository<Reservation> {
  constructor() {
    super(Reservation, {
      alias: 'reservation',
      searchableFields: ['requestedByName', 'notes'],
      filterableFields: ['condominiumId', 'commonAreaId', 'unitId', 'status', 'requestedById'],
      relations: ['commonArea', 'unit'],
      defaultSort: { field: 'startsAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  /** Reservas ativas que colidem com o intervalo informado. */
  async findOverlapping(
    scope: TenantScope,
    commonAreaId: string,
    startsAt: Date,
    endsAt: Date,
    exceptId?: string,
  ): Promise<Reservation[]> {
    const qb = this.query(scope)
      .andWhere('reservation.commonAreaId = :commonAreaId', { commonAreaId })
      .andWhere('reservation.status IN (:...statuses)', { statuses: ['PENDING', 'CONFIRMED'] })
      .andWhere('reservation.startsAt < :endsAt', { endsAt })
      .andWhere('reservation.endsAt > :startsAt', { startsAt });

    if (exceptId) qb.andWhere('reservation.id != :exceptId', { exceptId });
    return qb.getMany();
  }

  /** Ultima reserva da unidade na area, para aplicar o intervalo minimo. */
  async findRecentByUnit(
    scope: TenantScope,
    commonAreaId: string,
    unitId: string,
    since: Date,
    exceptId?: string,
  ): Promise<Reservation[]> {
    const qb = this.query(scope)
      .andWhere('reservation.commonAreaId = :commonAreaId', { commonAreaId })
      .andWhere('reservation.unitId = :unitId', { unitId })
      .andWhere('reservation.status IN (:...statuses)', { statuses: ['PENDING', 'CONFIRMED'] })
      .andWhere('reservation.startsAt >= :since', { since });

    if (exceptId) qb.andWhere('reservation.id != :exceptId', { exceptId });
    return qb.getMany();
  }

  async listBetween(
    scope: TenantScope,
    condominiumId: string,
    from: Date,
    to: Date,
    commonAreaId?: string,
  ): Promise<Reservation[]> {
    const qb = this.query(scope)
      .andWhere('reservation.condominiumId = :condominiumId', { condominiumId })
      .andWhere('reservation.startsAt < :to', { to })
      .andWhere('reservation.endsAt > :from', { from })
      .andWhere('reservation.status IN (:...statuses)', { statuses: ['PENDING', 'CONFIRMED'] })
      .orderBy('reservation.startsAt', 'ASC');

    if (commonAreaId) qb.andWhere('reservation.commonAreaId = :commonAreaId', { commonAreaId });
    return qb.getMany();
  }
}

export const reservationRepository = new ReservationRepository();
