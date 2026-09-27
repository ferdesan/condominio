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

  /**
   * Competencias `CLOSED` entre `fromMonth` e `toMonth`, inclusive, em ordem.
   * `YYYY-MM` ordena como texto na mesma ordem do calendario, entao o BETWEEN
   * sobre a coluna `varchar` e exato.
   */
  async findClosedBetween(
    scope: TenantScope,
    condominiumId: string,
    fromMonth: string,
    toMonth: string,
  ): Promise<string[]> {
    const rows = await this.query(scope)
      .andWhere('closing.condominiumId = :condominiumId', { condominiumId })
      .andWhere('closing.status = :status', { status: 'CLOSED' })
      .andWhere('closing.referenceMonth BETWEEN :fromMonth AND :toMonth', { fromMonth, toMonth })
      .orderBy('closing.referenceMonth', 'ASC')
      .getMany();
    return rows.map((row) => row.referenceMonth);
  }
}

export const financialClosingRepository = new FinancialClosingRepository();
