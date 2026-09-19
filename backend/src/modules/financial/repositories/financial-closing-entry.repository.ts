import type { EntityManager } from 'typeorm';
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

  /**
   * Apaga os lancamentos de um fechamento.
   *
   * **Recebe o `manager` da transacao em vez de usar o repositorio herdado.** O
   * getter do `BaseRepository` resolve `AppDataSource.getRepository(...)`, que e
   * o repositorio global do DataSource e nao o da transacao
   * (`base.repository.ts:37-40`): uma chamada por ele apagaria as linhas fora do
   * bloco, e a atomicidade se perderia sem erro nenhum — o pior jeito de perder,
   * porque nada avisa. Por isso o parametro e obrigatorio e vem primeiro.
   *
   * Remocao fisica, e nao logica. Estas linhas sao substituidas inteiras a cada
   * fechamento (ADR-003), e um conjunto de lapides por refechamento cresceria
   * sem limite sem servir de registro: quem fechou e quando ja esta na
   * auditoria.
   */
  async deleteByClosing(
    manager: EntityManager,
    scope: TenantScope,
    closingId: string,
  ): Promise<void> {
    // O `tenantId` entra aqui pelo mesmo motivo que entra na insercao: o filtro
    // de escopo do repositorio nao esta no caminho, e apagar e inserir precisam
    // enxergar exatamente o mesmo conjunto para que refechar substitua.
    await manager.delete(FinancialClosingEntry, { tenantId: scope.tenantId, closingId });
  }
}

export const financialClosingEntryRepository = new FinancialClosingEntryRepository();
