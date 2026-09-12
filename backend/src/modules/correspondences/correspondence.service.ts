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
import { Correspondence } from './correspondence.entity';
import {
  correspondenceRepository,
  type CorrespondenceRepository,
} from './correspondence.repository';
import type {
  CreateCorrespondenceDTO,
  DeliverCorrespondenceDTO,
  UpdateCorrespondenceDTO,
} from './correspondence.schema';

export class CorrespondenceService extends CondominiumScopedService<
  Correspondence,
  CreateCorrespondenceDTO,
  UpdateCorrespondenceDTO
> {
  constructor(
    private readonly correspondences: CorrespondenceRepository = correspondenceRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
  ) {
    super(correspondences, { resource: 'correspondence', label: 'Correspondencia' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateCorrespondenceDTO,
  ): Promise<DeepPartial<Correspondence>> {
    const unitCondominium = await resolveUnitCondominium(ctx.scope, dto.unitId);
    if (unitCondominium !== dto.condominiumId) {
      throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
    }

    return {
      ...dto,
      receivedBy: dto.receivedBy ?? ctx.actor.name,
    } as DeepPartial<Correspondence>;
  }

  /** Avisa o morador assim que a portaria registra a chegada. */
  protected override async afterCreate(
    ctx: RequestContext,
    entity: Correspondence,
  ): Promise<void> {
    if (entity.status !== 'PENDING') return;

    const userIds = await this.recipients.usersOfUnit(ctx.scope.tenantId, entity.unitId);
    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: entity.condominiumId,
      userIds,
      title: 'Nova correspondencia na portaria',
      message: entity.description
        ? `${entity.description} aguardando retirada.`
        : 'Voce tem uma correspondencia aguardando retirada.',
      type: 'CORRESPONDENCE',
      resource: 'correspondence',
      resourceId: entity.id,
      actionUrl: `/correspondencias/${entity.id}`,
    });

    this.realtime.emitToCondominium(entity.condominiumId, 'correspondence:received', {
      id: entity.id,
      unitId: entity.unitId,
    });
  }

  /** Baixa da retirada: registra quem recebeu, quando e por qual operador. */
  async deliver(
    ctx: RequestContext,
    id: string,
    dto: DeliverCorrespondenceDTO,
  ): Promise<Correspondence> {
    const correspondence = await this.findById(ctx, id);

    if (correspondence.status === 'DELIVERED') {
      throw new BusinessRuleError('Esta correspondencia ja foi entregue.');
    }
    if (correspondence.status === 'RETURNED') {
      throw new BusinessRuleError('Esta correspondencia foi devolvida ao remetente.');
    }

    const updated = await this.update(ctx, id, {
      status: 'DELIVERED',
      deliveredTo: dto.deliveredTo,
      deliveredAt: dto.deliveredAt ?? new Date(),
      notes: dto.notes ?? correspondence.notes,
    } as UpdateCorrespondenceDTO);

    return updated;
  }

  async pendingCount(ctx: RequestContext, condominiumId?: string): Promise<{ pending: number }> {
    return { pending: await this.correspondences.countPending(ctx.scope, condominiumId) };
  }
}

export const correspondenceService = new CorrespondenceService();
