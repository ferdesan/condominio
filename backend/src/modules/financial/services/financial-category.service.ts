import type { DeepPartial } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { BusinessRuleError, ConflictError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import type { RequestContext } from '@/shared/services/request-context';
import { FinancialCategory } from '../entities/financial-category.entity';
import {
  financialCategoryRepository,
  type FinancialCategoryRepository,
} from '../repositories/financial-category.repository';
import type {
  CreateFinancialCategoryDTO,
  UpdateFinancialCategoryDTO,
} from '../schemas/financial.schema';

export class FinancialCategoryService extends CondominiumScopedService<
  FinancialCategory,
  CreateFinancialCategoryDTO,
  UpdateFinancialCategoryDTO
> {
  constructor(private readonly categories: FinancialCategoryRepository = financialCategoryRepository) {
    super(categories, { resource: 'financial-category', label: 'Categoria financeira' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateFinancialCategoryDTO,
  ): Promise<DeepPartial<FinancialCategory>> {
    if (await this.categories.nameTaken(ctx.scope, dto.condominiumId, dto.name)) {
      throw new ConflictError('Ja existe uma categoria com este nome neste condominio.');
    }
    return dto as DeepPartial<FinancialCategory>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: FinancialCategory,
    dto: UpdateFinancialCategoryDTO,
  ): Promise<DeepPartial<FinancialCategory>> {
    if (dto.name && dto.name !== current.name) {
      const taken = await this.categories.nameTaken(
        ctx.scope,
        dto.condominiumId ?? current.condominiumId,
        dto.name,
        current.id,
      );
      if (taken) throw new ConflictError('Ja existe uma categoria com este nome neste condominio.');
    }
    return dto as DeepPartial<FinancialCategory>;
  }

  protected override async beforeRemove(
    ctx: RequestContext,
    entity: FinancialCategory,
  ): Promise<void> {
    const [charges, expenses] = await Promise.all([
      this.countUsage('charges', ctx.scope.tenantId, entity.id),
      this.countUsage('expenses', ctx.scope.tenantId, entity.id),
    ]);

    if (charges + expenses > 0) {
      throw new BusinessRuleError(
        'Categoria possui lancamentos vinculados. Desative-a em vez de excluir.',
      );
    }
  }

  private async countUsage(table: string, tenantId: string, categoryId: string): Promise<number> {
    const row = await AppDataSource.createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from(table, 'entry')
      .where('entry.tenant_id = :tenantId', { tenantId })
      .andWhere('entry.category_id = :categoryId', { categoryId })
      .andWhere('entry.deleted_at IS NULL')
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }
}

export const financialCategoryService = new FinancialCategoryService();
