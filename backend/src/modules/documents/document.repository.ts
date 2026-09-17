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

  /**
   * O caminho de armazenamento, que `select: false` mantem fora de toda leitura
   * comum. Mesma forma de `UserRepository.findWithPassword`: um query builder
   * proprio que pede a coluna, em vez de mexer no `baseQuery` — que a serviria
   * para todas as leituras e anularia o proposito.
   *
   * Inclui removidos de proposito: `afterRemove` roda depois do soft delete, e
   * uma releitura sem `withDeleted` nao acharia mais a linha.
   */
  async findStoredPath(scope: TenantScope, id: string): Promise<string | null> {
    const row = await this.query(scope, true)
      .addSelect('document.filePath')
      .andWhere('document.id = :id', { id })
      .getOne();

    return row?.filePath ?? null;
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
