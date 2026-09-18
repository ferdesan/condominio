import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { FinancialCategory } from '../entities/financial-category.entity';

export class FinancialCategoryRepository extends BaseRepository<FinancialCategory> {
  constructor() {
    super(FinancialCategory, {
      alias: 'financial_category',
      searchableFields: ['name', 'code', 'description'],
      filterableFields: ['condominiumId', 'kind', 'active'],
      defaultSort: { field: 'name', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async nameTaken(
    scope: TenantScope,
    condominiumId: string,
    name: string,
    exceptId?: string,
  ): Promise<boolean> {
    const qb = this.query(scope, true)
      .andWhere('financial_category.condominiumId = :condominiumId', { condominiumId })
      .andWhere('financial_category.name = :name', { name });
    if (exceptId) qb.andWhere('financial_category.id != :exceptId', { exceptId });
    return qb.getExists();
  }

  /**
   * Nomes por id, **incluindo as removidas** (`query(scope, true)`).
   *
   * Um balancete nomeia categorias que podem ter sido excluidas depois do
   * lancamento. Resolver so entre as ativas deixaria a linha sem nome — e a
   * linha existe porque o dinheiro passou por ela.
   */
  async namesByIds(scope: TenantScope, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();

    const rows = await this.query(scope, true)
      .andWhere('financial_category.id IN (:...ids)', { ids })
      .select('financial_category.id', 'id')
      .addSelect('financial_category.name', 'name')
      .getRawMany<{ id: string; name: string }>();

    return new Map(rows.map((row) => [row.id, row.name]));
  }
}

export const financialCategoryRepository = new FinancialCategoryRepository();
