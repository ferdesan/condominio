import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/logger';
import { realtimeService, type RealtimeService } from '@/realtime/realtime.service';
import type { Paginated, QueryOptions } from '@/shared/types/pagination';
import type { TenantScope } from '@/shared/repositories/types';
import { Notification, type NotificationType } from './notification.entity';
import { notificationRepository, type NotificationRepository } from './notification.repository';

export type NotifyInput = {
  tenantId: string;
  userIds: string[];
  title: string;
  message: string;
  type?: NotificationType;
  resource?: string;
  resourceId?: string;
  actionUrl?: string;
  condominiumId?: string | null;
};

/**
 * Persiste a notificacao (para a central do portal) e entrega em tempo real
 * via Socket.IO. Falhas aqui nunca interrompem a operacao de negocio que a
 * originou.
 */
export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository = notificationRepository,
    private readonly realtime: RealtimeService = realtimeService,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    if (!input.userIds.length) return;

    try {
      const repository = AppDataSource.getRepository(Notification);
      const rows = await repository.save(
        input.userIds.map((userId) =>
          repository.create({
            tenantId: input.tenantId,
            userId,
            condominiumId: input.condominiumId ?? null,
            title: input.title.slice(0, 180),
            message: input.message.slice(0, 500),
            type: input.type ?? 'INFO',
            resource: input.resource ?? null,
            resourceId: input.resourceId ?? null,
            actionUrl: input.actionUrl ?? null,
          }),
        ),
      );

      rows.forEach((row) => this.realtime.emitToUser(row.userId, 'notification:new', row));
    } catch (error) {
      logger.error(`Failed to deliver notification: ${(error as Error).message}`);
    }
  }

  async list(scope: TenantScope, userId: string, options: QueryOptions): Promise<Paginated<Notification>> {
    return this.repository.findMany(scope, {
      ...options,
      filters: { ...options.filters, userId },
    });
  }

  async unreadCount(scope: TenantScope, userId: string): Promise<{ unread: number }> {
    return { unread: await this.repository.countUnread(scope, userId) };
  }

  async markAsRead(scope: TenantScope, userId: string, ids?: string[]): Promise<{ updated: number }> {
    return { updated: await this.repository.markAsRead(scope, userId, ids) };
  }
}

export const notificationService = new NotificationService();
