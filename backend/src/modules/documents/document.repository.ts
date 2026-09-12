import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { DocumentFile } from './document.entity';

export class DocumentRepository extends BaseRepository<DocumentFile> {
  constructor() {
    super(DocumentFile, {
      alias: 'document',
      searchableFields: ['title', 'description', 'fileName'],
      filterableFields: ['condominiumId', 'category', 'visibility'],
      defaultSort: { field: 'createdAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async incrementDownloads(scope: TenantScope, id: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(DocumentFile)
      .set({ downloadsCount: () => 'downloads_count + 1' })
      .where('id = :id', { id })
      .andWhere('tenant_id = :tenantId', { tenantId: scope.tenantId })
      .execute();
  }
}

export const documentRepository = new DocumentRepository();
