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
}

export const financialCategoryRepository = new FinancialCategoryRepository();
