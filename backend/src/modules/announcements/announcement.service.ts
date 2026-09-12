import type { DeepPartial } from 'typeorm';
import {
  notificationService,
  type NotificationService,
} from '@/modules/notifications/notification.service';
import { realtimeService, type RealtimeService } from '@/realtime/realtime.service';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { recipientsService, type RecipientsService } from '@/shared/services/recipients.service';
import type { RequestContext } from '@/shared/services/request-context';
import { Announcement } from './announcement.entity';
import {
  announcementRepository,
  type AnnouncementRepository,
} from './announcement.repository';
import type { CreateAnnouncementDTO, UpdateAnnouncementDTO } from './announcement.schema';

export class AnnouncementService extends CondominiumScopedService<
  Announcement,
  CreateAnnouncementDTO,
  UpdateAnnouncementDTO
> {
  constructor(
    private readonly announcements: AnnouncementRepository = announcementRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
  ) {
    super(announcements, { resource: 'announcement', label: 'Comunicado' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateAnnouncementDTO,
  ): Promise<DeepPartial<Announcement>> {
    this.assertAudience(dto.audience, dto.targetBlockIds ?? null);

    return {
      ...dto,
      authorId: ctx.actor.userId,
      authorName: ctx.actor.name,
      publishedAt: dto.status === 'PUBLISHED' ? (dto.publishedAt ?? new Date()) : dto.publishedAt,
    } as DeepPartial<Announcement>;
  }

  protected override async prepareUpdate(
    _ctx: RequestContext,
    current: Announcement,
    dto: UpdateAnnouncementDTO,
  ): Promise<DeepPartial<Announcement>> {
    this.assertAudience(
      dto.audience ?? current.audience,
      dto.targetBlockIds ?? current.targetBlockIds ?? null,
    );
    return dto as DeepPartial<Announcement>;
  }

  protected override async afterCreate(
    ctx: RequestContext,
    entity: Announcement,
  ): Promise<void> {
    if (entity.status === 'PUBLISHED') await this.broadcast(ctx, entity);
  }

  /** Publica o comunicado e dispara a notificacao para o publico-alvo. */
  async publish(ctx: RequestContext, id: string): Promise<Announcement> {
    const announcement = await this.findById(ctx, id);

    if (announcement.status === 'PUBLISHED') {
      throw new BusinessRuleError('Comunicado ja esta publicado.');
    }
    if (announcement.status === 'ARCHIVED') {
      throw new BusinessRuleError('Comunicado arquivado nao pode ser publicado novamente.');
    }

    const published = await this.update(ctx, id, {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    } as UpdateAnnouncementDTO);

    await this.broadcast(ctx, published);
    return published;
  }

  async archive(ctx: RequestContext, id: string): Promise<Announcement> {
    return this.update(ctx, id, { status: 'ARCHIVED' } as UpdateAnnouncementDTO);
  }

  async board(ctx: RequestContext, condominiumId?: string): Promise<Announcement[]> {
    return this.announcements.listPublished(ctx.scope, condominiumId);
  }

  async markAsRead(ctx: RequestContext, id: string): Promise<{ read: boolean }> {
    await this.findById(ctx, id);
    await this.announcements.incrementReads(ctx.scope, id);
    return { read: true };
  }

  private async broadcast(ctx: RequestContext, announcement: Announcement): Promise<void> {
    const userIds = await this.recipients.usersOfCondominium(
      ctx.scope.tenantId,
      announcement.condominiumId,
    );

    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: announcement.condominiumId,
      userIds,
      title: announcement.title,
      message: announcement.content.slice(0, 200),
      type: announcement.category === 'URGENT' ? 'WARNING' : 'ANNOUNCEMENT',
      resource: 'announcement',
      resourceId: announcement.id,
      actionUrl: `/comunicados/${announcement.id}`,
    });

    this.realtime.emitToCondominium(announcement.condominiumId, 'announcement:published', {
      id: announcement.id,
      title: announcement.title,
      category: announcement.category,
    });
  }

  private assertAudience(audience: string, targetBlockIds: string[] | null): void {
    if (audience === 'BLOCKS' && !targetBlockIds?.length) {
      throw new BusinessRuleError('Informe ao menos um bloco para o publico-alvo selecionado.');
    }
  }
}

export const announcementService = new AnnouncementService();
