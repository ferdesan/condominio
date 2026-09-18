import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { FinancialClosing } from '../entities/financial-closing.entity';

export class FinancialClosingRepository extends BaseRepository<FinancialClosing> {
  constructor() {
    super(FinancialClosing, {
      alias: 'closing',
      searchableFields: ['referenceMonth'],
      filterableFields: ['condominiumId', 'referenceMonth', 'status'],
      defaultSort: { field: 'referenceMonth', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  /**
   * A linha de uma competencia, ou `null` quando o mes nunca foi fechado.
   *
   * Quem chama precisa distinguir tres estados, e nao dois: sem linha (nunca
   * fechado), linha `OPEN` (fechado e reaberto) e linha `CLOSED`. Os dois
   * primeiros sao mes aberto para efeito de leitura e de guarda.
   */
  async findByMonth(
    scope: TenantScope,
    condominiumId: string,
    referenceMonth: string,
  ): Promise<FinancialClosing | null> {
    return this.query(scope)
      .andWhere('closing.condominiumId = :condominiumId', { condominiumId })
      .andWhere('closing.referenceMonth = :referenceMonth', { referenceMonth })
      .getOne();
  }
}

export const financialClosingRepository = new FinancialClosingRepository();
