import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Announcement } from './announcement.entity';

export class AnnouncementRepository extends BaseRepository<Announcement> {
  constructor() {
    super(Announcement, {
      alias: 'announcement',
      searchableFields: ['title', 'content'],
      filterableFields: ['condominiumId', 'status', 'category', 'audience', 'pinned'],
      defaultSort: { field: 'publishedAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  /** Mural do morador: apenas publicados e dentro da validade. */
  async listPublished(scope: TenantScope, condominiumId?: string, limit = 20): Promise<Announcement[]> {
    const qb = this.query(scope)
      .andWhere('announcement.status = :status', { status: 'PUBLISHED' })
      .andWhere('(announcement.expiresAt IS NULL OR announcement.expiresAt > :now)', {
        now: new Date(),
      })
      .orderBy('announcement.pinned', 'DESC')
      .addOrderBy('announcement.publishedAt', 'DESC')
      .take(limit);

    if (condominiumId) {
      qb.andWhere('announcement.condominiumId = :condominiumId', { condominiumId });
    }
    return qb.getMany();
  }

  async incrementReads(scope: TenantScope, id: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(Announcement)
      .set({ readsCount: () => 'reads_count + 1' })
      .where('id = :id', { id })
      .andWhere('tenant_id = :tenantId', { tenantId: scope.tenantId })
      .execute();
  }
}

export const announcementRepository = new AnnouncementRepository();
