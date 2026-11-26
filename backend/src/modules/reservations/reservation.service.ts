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
import { tenantRepository, type TenantRepository } from '@/modules/tenants/tenant.repository';
import { dayjs, resolveTimeZone, wallClockSlot } from '@/shared/utils/date.util';
import { Reservation, type ReservationStatus } from './reservation.entity';
import { reservationRepository, type ReservationRepository } from './reservation.repository';
import type {
  AvailabilityQuery,
  CreateReservationDTO,
  ReservationStatusChange,
  ReservationUpdateInput,
  ReviewReservationDTO,
} from './reservation.schema';

/** Recusadas, canceladas e concluidas sao historico: nao se editam. */
const EDITABLE_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

function isStatusChange(dto: ReservationUpdateInput): dto is ReservationStatusChange {
  return 'status' in dto;
}

export class ReservationService extends CondominiumScopedService<
  Reservation,
  CreateReservationDTO,
  ReservationUpdateInput
> {
  constructor(
    private readonly reservations: ReservationRepository = reservationRepository,
    private readonly commonAreas: CommonAreaRepository = commonAreaRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
    private readonly tenants: TenantRepository = tenantRepository,
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
    this.assertCapacity(area, dto.guestsCount);

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
    dto: ReservationUpdateInput,
  ): Promise<DeepPartial<Reservation>> {
    // Transicoes de status vem do fluxo de aprovacao, que ja conferiu permissao
    // e estado. O schema publico de edicao nao aceita `status`, entao essa forma
    // nunca chega de uma requisicao.
    if (isStatusChange(dto)) return dto as DeepPartial<Reservation>;

    if (!EDITABLE_STATUSES.includes(current.status)) {
      throw new BusinessRuleError(
        'Somente reservas pendentes ou confirmadas podem ser alteradas.',
      );
    }

    this.assertUnitOwnership(ctx, current.unitId);

    const unitId = dto.unitId ?? current.unitId;
    const commonAreaId = dto.commonAreaId ?? current.commonAreaId;
    const startsAt = dto.startsAt ?? current.startsAt;
    const endsAt = dto.endsAt ?? current.endsAt;
    const guestsCount = dto.guestsCount ?? current.guestsCount;

    const unitChanged = unitId !== current.unitId;
    const areaChanged = commonAreaId !== current.commonAreaId;
    const periodChanged =
      startsAt.getTime() !== new Date(current.startsAt).getTime() ||
      endsAt.getTime() !== new Date(current.endsAt).getTime();
    const guestsChanged = guestsCount !== current.guestsCount;

    if (unitChanged) {
      this.assertUnitOwnership(ctx, unitId);
      const unitCondominium = await resolveUnitCondominium(ctx.scope, unitId);
      if (unitCondominium !== current.condominiumId) {
        throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
      }
    }

    const payload: DeepPartial<Reservation> = { ...dto } as DeepPartial<Reservation>;

    // Mudou o "quando", o "onde" ou o "quem": o horario precisa ser reservavel
    // de novo, como se a reserva estivesse nascendo agora.
    if (unitChanged || areaChanged || periodChanged) {
      const area = await this.loadArea(ctx, commonAreaId, current.condominiumId);
      await this.assertSlotIsBookable(ctx, area, startsAt, endsAt, unitId, current.id);
      this.assertCapacity(area, guestsCount);

      if (areaChanged) payload.fee = area.reservationFee;

      // Mudanca de area ou periodo reabre a decisao. Quem tem
      // `reservation:manage` e o proprio aprovador, entao a edicao dele mantem
      // a reserva confirmada; a de qualquer outro volta para a fila.
      if (areaChanged || periodChanged) {
        const status = this.statusAfterReschedule(ctx, current.status, area);
        if (status !== current.status) {
          payload.status = status;
          payload.statusReason = null;
        }
      }
    } else if (guestsChanged) {
      // So os convidados mudaram: a area pode ate estar em manutencao agora, o
      // que nao deve impedir corrigir a contagem de uma reserva ja existente.
      const area = await this.commonAreas.findById(ctx.scope, commonAreaId);
      if (!area) throw new NotFoundError('Area comum');
      this.assertCapacity(area, guestsCount);
    }

    return payload;
  }

  protected override async afterUpdate(
    ctx: RequestContext,
    entity: Reservation,
    previous: Reservation,
    dto: ReservationUpdateInput,
  ): Promise<void> {
    // `applyReview` notifica e emite o evento das transicoes por conta propria.
    if (isStatusChange(dto)) return;

    const when = dayjs(entity.startsAt).format('DD/MM/YYYY HH:mm');

    if (entity.status === 'PENDING' && previous.status !== 'PENDING') {
      const approvers = await this.recipients.usersByRoles(ctx.scope.tenantId, [
        ROLE_ADMIN,
        ROLE_SINDICO,
      ]);
      await this.notifications.notify({
        tenantId: ctx.scope.tenantId,
        condominiumId: entity.condominiumId,
        userIds: approvers,
        title: 'Reserva alterada aguardando aprovacao',
        message: `${ctx.actor.name} alterou a reserva de ${entity.requestedByName}, agora para ${when}. A reserva voltou para aprovacao.`,
        type: 'RESERVATION',
        resource: 'reservation',
        resourceId: entity.id,
        actionUrl: `/reservas/${entity.id}`,
      });
    }

    // Quem pediu a reserva fica sabendo quando outra pessoa a altera.
    if (entity.requestedById && entity.requestedById !== ctx.actor.userId) {
      await this.notifications.notify({
        tenantId: ctx.scope.tenantId,
        condominiumId: entity.condominiumId,
        userIds: [entity.requestedById],
        title: 'Reserva alterada',
        message: `Sua reserva foi alterada por ${ctx.actor.name} e agora esta marcada para ${when}.`,
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
    const updated = await this.update(ctx, reservation.id, { status, statusReason: reason });

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

  private assertCapacity(area: CommonArea, guestsCount: number): void {
    if (area.capacity > 0 && guestsCount > area.capacity) {
      throw new BusinessRuleError(`A area comporta no maximo ${area.capacity} pessoas.`);
    }
  }

  /**
   * Status depois de mudar area ou periodo — a mesma regra da criacao: area
   * sem aprovacao confirma direto; area com aprovacao deixa pendente, exceto
   * quando quem edita e o proprio aprovador e a reserva ja estava confirmada.
   */
  private statusAfterReschedule(
    ctx: RequestContext,
    current: ReservationStatus,
    area: CommonArea,
  ): ReservationStatus {
    if (!area.requiresApproval) return 'CONFIRMED';
    if (current === 'CONFIRMED' && hasPermission(ctx.actor.permissions, 'reservation:manage')) {
      return 'CONFIRMED';
    }
    return 'PENDING';
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

  private async tenantTimeZone(ctx: RequestContext): Promise<string> {
    const tenant = await this.tenants.findById(ctx.scope.tenantId);
    return resolveTimeZone(tenant?.settings?.timezone);
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

    // Dia da semana e janela sao hora local do condominio, lidas no fuso do
    // tenant — nunca no fuso do processo, que em producao costuma ser UTC.
    // `endMinutes` ultrapassa 1440 quando a reserva cruza a meia-noite, o que
    // so e aceito por areas que fecham exatamente as 00:00.
    const timeZone = await this.tenantTimeZone(ctx);
    const { weekday, startMinutes, endMinutes } = wallClockSlot(startsAt, endsAt, timeZone);

    const weekdays = area.availableWeekdays;
    if (weekdays?.length && !weekdays.includes(weekday)) {
      throw new BusinessRuleError('A area comum nao esta disponivel neste dia da semana.');
    }

    const opensMinutes = this.toMinutes(area.opensAt);
    const closesMinutes = area.closesAt === '00:00' ? 1440 : this.toMinutes(area.closesAt);

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
