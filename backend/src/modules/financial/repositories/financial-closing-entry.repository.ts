import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { FinancialClosingEntry } from '../entities/financial-closing-entry.entity';

/**
 * Os movimentos congelados de um fechamento.
 *
 * Sem `condominiumField`: a linha nao guarda condominio proprio, ela pertence a
 * um fechamento que ja foi resolvido dentro do escopo de quem le. Filtrar de
 * novo por um campo que nao existe silenciaria a leitura inteira.
 */
export class FinancialClosingEntryRepository extends BaseRepository<FinancialClosingEntry> {
  constructor() {
    // Sem `searchableFields` nem `filterableFields`: nenhuma rota lista esta
    // tabela — o mes vem inteiro e filtra no cliente (ADR-004). `defaultSort`
    // fica porque o padrao do `BaseRepository` (`createdAt DESC`) descreveria a
    // ordem em que as linhas foram gravadas, e nao a ordem do documento.
    super(FinancialClosingEntry, {
      alias: 'closing_entry',
      defaultSort: { field: 'occurredAt', order: 'ASC' },
    });
  }

  /**
   * Os movimentos de um fechamento, na ordem total do documento: data, valor
   * decrescente e `sourceId` para desempatar. A ordem sai do banco porque o
   * indice `(closing_id, kind)` ja leva ate aqui; o servico reaplica a mesma
   * regra em memoria para que o mes aberto e o mes fechado nao possam divergir
   * por colacao.
   */
  async findByClosing(scope: TenantScope, closingId: string): Promise<FinancialClosingEntry[]> {
    return this.query(scope)
      .andWhere('closing_entry.closingId = :closingId', { closingId })
      .orderBy('closing_entry.occurredAt', 'ASC')
      .addOrderBy('closing_entry.amount', 'DESC')
      .addOrderBy('closing_entry.sourceId', 'ASC')
      .getMany();
  }
}

export const financialClosingEntryRepository = new FinancialClosingEntryRepository();
