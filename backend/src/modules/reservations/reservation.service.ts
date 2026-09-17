import type { DeepPartial } from 'typeorm';
import {
  commonAreaRepository,
  type CommonAreaRepository,
} from '@/modules/common-areas/common-area.repository';
import type { CommonArea } from '@/modules/common-areas/common-area.entity';
import {
  notificationService,
  type NotificationService,
} from '@/modules/notifications/notification.service';
import { realtimeService, type RealtimeService } from '@/realtime/realtime.service';
import { ROLE_ADMIN, ROLE_SINDICO } from '@/shared/constants/roles';
import { hasPermission } from '@/shared/constants/permissions';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { recipientsService, type RecipientsService } from '@/shared/services/recipients.service';
import { resolveUnitCondominium } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { dayjs } from '@/shared/utils/date.util';
import { Reservation } from './reservation.entity';
import { reservationRepository, type ReservationRepository } from './reservation.repository';
import type {
  AvailabilityQuery,
  CreateReservationDTO,
  ReviewReservationDTO,
  UpdateReservationDTO,
} from './reservation.schema';

export class ReservationService extends CondominiumScopedService<
  Reservation,
  CreateReservationDTO,
  UpdateReservationDTO
> {
  constructor(
    private readonly reservations: ReservationRepository = reservationRepository,
    private readonly commonAreas: CommonAreaRepository = commonAreaRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
  ) {
    super(reservations, { resource: 'reservation', label: 'Reserva' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateReservationDTO,
  ): Promise<DeepPartial<Reservation>> {
    const area = await this.loadArea(ctx, dto.commonAreaId, dto.condominiumId);

    this.assertUnitOwnership(ctx, dto.unitId);
    const unitCondominium = await resolveUnitCondominium(ctx.scope, dto.unitId);
    if (unitCondominium !== dto.condominiumId) {
      throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
    }

    await this.assertSlotIsBookable(ctx, area, dto.startsAt, dto.endsAt, dto.unitId);

    if (area.capacity > 0 && dto.guestsCount > area.capacity) {
      throw new BusinessRuleError(
        `A area comporta no maximo ${area.capacity} pessoas.`,
      );
    }

    return {
      ...dto,
      requestedById: ctx.actor.userId,
      requestedByName: ctx.actor.name,
      fee: area.reservationFee,
      status: area.requiresApproval ? 'PENDING' : 'CONFIRMED',
    } as DeepPartial<Reservation>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Reservation,
    dto: UpdateReservationDTO,
  ): Promise<DeepPartial<Reservation>> {
    if (current.status === 'COMPLETED' || current.status === 'CANCELED') {
      throw new BusinessRuleError('Reservas concluidas ou canceladas nao podem ser alteradas.');
    }

    this.assertUnitOwnership(ctx, current.unitId);

    const startsAt = dto.startsAt ?? current.startsAt;
    const endsAt = dto.endsAt ?? current.endsAt;

    if (dto.startsAt || dto.endsAt || dto.commonAreaId) {
      const area = await this.loadArea(
        ctx,
        dto.commonAreaId ?? current.commonAreaId,
        dto.condominiumId ?? current.condominiumId,
      );
      await this.assertSlotIsBookable(ctx, area, startsAt, endsAt, current.unitId, current.id);
    }

    return dto as DeepPartial<Reservation>;
  }

  protected override async afterCreate(
    ctx: RequestContext,
    entity: Reservation,
  ): Promise<void> {
    if (entity.status === 'PENDING') {
      const approvers = await this.recipients.usersByRoles(ctx.scope.tenantId, [
        ROLE_ADMIN,
        ROLE_SINDICO,
      ]);
      await this.notifications.notify({
        tenantId: ctx.scope.tenantId,
        condominiumId: entity.condominiumId,
        userIds: approvers,
        title: 'Nova reserva aguardando aprovacao',
        message: `${entity.requestedByName} solicitou uma reserva para ${dayjs(entity.startsAt).format('DD/MM/YYYY HH:mm')}.`,
        type: 'RESERVATION',
        resource: 'reservation',
        resourceId: entity.id,
        actionUrl: `/reservas/${entity.id}`,
      });
    }

    this.realtime.emitToCondominium(entity.condominiumId, 'reservation:updated', {
      id: entity.id,
      status: entity.status,
    });
  }

  // ---------------------------------------------------------------------------
  // Fluxo de aprovacao
  // ---------------------------------------------------------------------------

  async approve(ctx: RequestContext, id: string, dto: ReviewReservationDTO): Promise<Reservation> {
    const reservation = await this.findById(ctx, id);
    this.assertReviewable(reservation);

    // Revalida o conflito: outra reserva pode ter sido confirmada no meio tempo.
    const conflicts = await this.reservations.findOverlapping(
      ctx.scope,
      reservation.commonAreaId,
      reservation.startsAt,
      reservation.endsAt,
      reservation.id,
    );
    if (conflicts.some((item) => item.status === 'CONFIRMED')) {
      throw new BusinessRuleError('Ja existe uma reserva confirmada para este horario.');
    }

    return this.applyReview(ctx, reservation, 'CONFIRMED', dto.reason ?? null);
  }

  async reject(ctx: RequestContext, id: string, dto: ReviewReservationDTO): Promise<Reservation> {
    const reservation = await this.findById(ctx, id);
    this.assertReviewable(reservation);
    return this.applyReview(ctx, reservation, 'REJECTED', dto.reason ?? null);
  }

  /** Cancelamento pelo morador (proprio) ou pela administracao. */
  async cancel(ctx: RequestContext, id: string, dto: ReviewReservationDTO): Promise<Reservation> {
    const reservation = await this.findById(ctx, id);

    const isOwner = reservation.requestedById === ctx.actor.userId;
    const canManage = hasPermission(ctx.actor.permissions, 'reservation:manage');
    if (!isOwner && !canManage) {
      throw new ForbiddenError('Somente o solicitante ou a administracao podem cancelar a reserva.');
    }

    if (reservation.status === 'CANCELED') {
      throw new BusinessRuleError('Reserva ja esta cancelada.');
    }
    if (reservation.status === 'COMPLETED') {
      throw new BusinessRuleError('Reservas concluidas nao podem ser canceladas.');
    }
    if (dayjs(reservation.startsAt).isBefore(dayjs()) && !canManage) {
      throw new BusinessRuleError('Reservas ja iniciadas so podem ser canceladas pela administracao.');
    }

    return this.applyReview(ctx, reservation, 'CANCELED', dto.reason ?? null);
  }

  /** Agenda consolidada usada pelo calendario do frontend. */
  async availability(ctx: RequestContext, query: AvailabilityQuery) {
    const reservations = await this.reservations.listBetween(
      ctx.scope,
      query.condominiumId,
      query.from,
      query.to,
      query.commonAreaId,
    );

    return reservations.map((reservation) => ({
      id: reservation.id,
      commonAreaId: reservation.commonAreaId,
      commonAreaName: reservation.commonArea?.name ?? null,
      unitId: reservation.unitId,
      unitNumber: reservation.unit?.number ?? null,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      status: reservation.status,
      requestedByName: reservation.requestedByName,
    }));
  }

  // ---------------------------------------------------------------------------
  // Regras
  // ---------------------------------------------------------------------------

  private async applyReview(
    ctx: RequestContext,
    reservation: Reservation,
    status: 'CONFIRMED' | 'REJECTED' | 'CANCELED',
    reason: string | null,
  ): Promise<Reservation> {
    const updated = await this.update(ctx, reservation.id, {
      status,
      statusReason: reason,
    } as UpdateReservationDTO);

    const labels: Record<typeof status, string> = {
      CONFIRMED: 'confirmada',
      REJECTED: 'recusada',
      CANCELED: 'cancelada',
    };

    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: reservation.condominiumId,
      userIds: reservation.requestedById ? [reservation.requestedById] : [],
      title: `Reserva ${labels[status]}`,
      message: `Sua reserva de ${dayjs(reservation.startsAt).format('DD/MM/YYYY HH:mm')} foi ${labels[status]}.${reason ? ` Motivo: ${reason}` : ''}`,
      type: 'RESERVATION',
      resource: 'reservation',
      resourceId: reservation.id,
      actionUrl: `/reservas/${reservation.id}`,
    });

    this.realtime.emitToCondominium(reservation.condominiumId, 'reservation:updated', {
      id: reservation.id,
      status,
    });

    return updated;
  }

  private assertReviewable(reservation: Reservation): void {
    if (reservation.status !== 'PENDING') {
      throw new BusinessRuleError('Apenas reservas pendentes podem ser aprovadas ou recusadas.');
    }
  }

  /** Morador so reserva para a propria unidade; sindico/admin reservam para qualquer uma. */
  private assertUnitOwnership(ctx: RequestContext, unitId: string): void {
    if (hasPermission(ctx.actor.permissions, 'reservation:manage')) return;
    if (ctx.actor.unitId && ctx.actor.unitId === unitId) return;
    throw new ForbiddenError('Voce so pode reservar areas comuns para a sua unidade.');
  }

  private async loadArea(
    ctx: RequestContext,
    commonAreaId: string,
    condominiumId: string,
  ): Promise<CommonArea> {
    const area = await this.commonAreas.findById(ctx.scope, commonAreaId);
    if (!area) throw new NotFoundError('Area comum');

    if (area.condominiumId !== condominiumId) {
      throw new BusinessRuleError('A area comum informada pertence a outro condominio.');
    }
    if (area.status !== 'AVAILABLE') {
      throw new BusinessRuleError('Area comum indisponivel para reservas no momento.');
    }

    return area;
  }

  /** Converte HH:mm em minutos desde a meia-noite. */
  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async assertSlotIsBookable(
    ctx: RequestContext,
    area: CommonArea,
    startsAt: Date,
    endsAt: Date,
    unitId: string,
    exceptId?: string,
  ): Promise<void> {
    const start = dayjs(startsAt);
    const end = dayjs(endsAt);

    if (end.isBefore(start) || end.isSame(start)) {
      throw new BusinessRuleError('O termino deve ser posterior ao inicio.');
    }
    if (start.isBefore(dayjs())) {
      throw new BusinessRuleError('Nao e possivel reservar uma data no passado.');
    }
    if (start.isAfter(dayjs().add(area.advanceBookingDays, 'day'))) {
      throw new BusinessRuleError(
        `Reservas podem ser feitas com no maximo ${area.advanceBookingDays} dias de antecedencia.`,
      );
    }

    const durationHours = end.diff(start, 'minute') / 60;
    if (durationHours < area.minHours) {
      throw new BusinessRuleError(`A reserva minima para esta area e de ${area.minHours}h.`);
    }
    if (durationHours > area.maxHours) {
      throw new BusinessRuleError(`A reserva maxima para esta area e de ${area.maxHours}h.`);
    }

    const weekdays = area.availableWeekdays;
    if (weekdays?.length && !weekdays.includes(start.day())) {
      throw new BusinessRuleError('A area comum nao esta disponivel neste dia da semana.');
    }

    // Janela de funcionamento em minutos desde o inicio do dia da reserva.
    // `endMinutes` ultrapassa 1440 quando a reserva cruza a meia-noite, o que
    // so e aceito por areas que fecham exatamente as 00:00.
    const dayStart = start.startOf('day');
    const opensMinutes = this.toMinutes(area.opensAt);
    const closesMinutes = area.closesAt === '00:00' ? 1440 : this.toMinutes(area.closesAt);
    const startMinutes = start.diff(dayStart, 'minute');
    const endMinutes = end.diff(dayStart, 'minute');

    if (startMinutes < opensMinutes || endMinutes > closesMinutes) {
      throw new BusinessRuleError(
        `Reservas permitidas somente entre ${area.opensAt} e ${area.closesAt}.`,
      );
    }

    const overlapping = await this.reservations.findOverlapping(
      ctx.scope,
      area.id,
      startsAt,
      endsAt,
      exceptId,
    );
    if (overlapping.length) {
      throw new BusinessRuleError('Ja existe uma reserva para esta area neste horario.');
    }

    if (area.minIntervalDays > 0) {
      const since = start.subtract(area.minIntervalDays, 'day').toDate();
      const recent = await this.reservations.findRecentByUnit(
        ctx.scope,
        area.id,
        unitId,
        since,
        exceptId,
      );
      if (recent.length) {
        throw new BusinessRuleError(
          `Cada unidade pode reservar esta area a cada ${area.minIntervalDays} dia(s).`,
        );
      }
    }
  }
}

export const reservationService = new ReservationService();
