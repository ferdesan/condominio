import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Notification } from './notification.entity';

export class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super(Notification, {
      alias: 'notification',
      searchableFields: ['title', 'message'],
      filterableFields: ['userId', 'type', 'resource', 'condominiumId'],
      defaultSort: { field: 'createdAt', order: 'DESC' },
    });
  }

  async countUnread(scope: TenantScope, userId: string): Promise<number> {
    return this.query(scope)
      .andWhere('notification.userId = :userId', { userId })
      .andWhere('notification.readAt IS NULL')
      .getCount();
  }

  async markAsRead(scope: TenantScope, userId: string, ids?: string[]): Promise<number> {
    const qb = this.repository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('tenant_id = :tenantId', { tenantId: scope.tenantId })
      .andWhere('user_id = :userId', { userId })
      .andWhere('read_at IS NULL');

    if (ids?.length) qb.andWhere('id IN (:...ids)', { ids });

    const result = await qb.execute();
    return result.affected ?? 0;
  }
}

export const notificationRepository = new NotificationRepository();
