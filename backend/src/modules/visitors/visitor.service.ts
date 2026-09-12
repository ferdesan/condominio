import type { DeepPartial } from 'typeorm';
import {
  notificationService,
  type NotificationService,
} from '@/modules/notifications/notification.service';
import { realtimeService, type RealtimeService } from '@/realtime/realtime.service';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { recipientsService, type RecipientsService } from '@/shared/services/recipients.service';
import { resolveUnitCondominium } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { shortCode } from '@/shared/utils/crypto.util';
import { Visitor } from './visitor.entity';
import { visitorRepository, type VisitorRepository } from './visitor.repository';
import type {
  CheckInDTO,
  CheckOutDTO,
  CreateVisitorDTO,
  UpdateVisitorDTO,
} from './visitor.schema';

export class VisitorService extends CondominiumScopedService<
  Visitor,
  CreateVisitorDTO,
  UpdateVisitorDTO
> {
  constructor(
    private readonly visitors: VisitorRepository = visitorRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
  ) {
    super(visitors, { resource: 'visitor', label: 'Visitante' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateVisitorDTO,
  ): Promise<DeepPartial<Visitor>> {
    const unitCondominium = await resolveUnitCondominium(ctx.scope, dto.unitId);
    if (unitCondominium !== dto.condominiumId) {
      throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
    }

    if (dto.expectedAt && dto.expectedUntil && dto.expectedUntil <= dto.expectedAt) {
      throw new BusinessRuleError('O periodo previsto de visita e invalido.');
    }

    // Pre-autorizacao feita pelo morador gera um codigo para a portaria.
    const preAuthorized = dto.status === 'EXPECTED';

    return {
      ...dto,
      authorizedById: preAuthorized ? ctx.actor.userId : null,
      authorizedByName: preAuthorized ? ctx.actor.name : null,
      registeredById: ctx.actor.userId,
      accessCode: preAuthorized ? shortCode(6) : null,
    } as DeepPartial<Visitor>;
  }

  /** Entrada registrada pela portaria. */
  async checkIn(ctx: RequestContext, id: string, dto: CheckInDTO): Promise<Visitor> {
    const visitor = await this.findById(ctx, id);

    if (visitor.status === 'CHECKED_IN') {
      throw new BusinessRuleError('Visitante ja esta no condominio.');
    }
    if (visitor.status === 'DENIED' || visitor.status === 'CANCELED') {
      throw new BusinessRuleError('Visita cancelada ou negada pelo morador.');
    }

    const updated = await this.update(ctx, id, {
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
      badgeNumber: dto.badgeNumber ?? visitor.badgeNumber,
      vehiclePlate: dto.vehiclePlate ?? visitor.vehiclePlate,
      notes: dto.notes ?? visitor.notes,
    } as UpdateVisitorDTO);

    const userIds = await this.recipients.usersOfUnit(ctx.scope.tenantId, visitor.unitId);
    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: visitor.condominiumId,
      userIds,
      title: 'Visitante liberado na portaria',
      message: `${visitor.name} acabou de entrar no condominio.`,
      type: 'VISITOR',
      resource: 'visitor',
      resourceId: visitor.id,
      actionUrl: `/visitantes/${visitor.id}`,
    });

    this.realtime.emitToUnit(visitor.unitId, 'visitor:arrived', {
      id: visitor.id,
      name: visitor.name,
    });

    return updated;
  }

  async checkOut(ctx: RequestContext, id: string, dto: CheckOutDTO): Promise<Visitor> {
    const visitor = await this.findById(ctx, id);

    if (visitor.status !== 'CHECKED_IN') {
      throw new BusinessRuleError('Somente visitantes com entrada registrada podem ter saida.');
    }

    return this.update(ctx, id, {
      status: 'CHECKED_OUT',
      checkedOutAt: new Date(),
      notes: dto.notes ?? visitor.notes,
    } as UpdateVisitorDTO);
  }

  /** Consulta usada pelo totem/portaria a partir do codigo informado pelo visitante. */
  async findByAccessCode(ctx: RequestContext, accessCode: string): Promise<Visitor> {
    const visitor = await this.visitors.findByAccessCode(ctx.scope, accessCode.toUpperCase());
    if (!visitor) throw new BusinessRuleError('Codigo de acesso invalido ou ja utilizado.');
    return visitor;
  }

  async insideCount(ctx: RequestContext, condominiumId?: string): Promise<{ inside: number }> {
    return { inside: await this.visitors.countInside(ctx.scope, condominiumId) };
  }
}

export const visitorService = new VisitorService();
