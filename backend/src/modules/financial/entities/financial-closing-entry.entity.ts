import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';
import type { PaymentMethod } from './charge.entity';
import { FinancialClosing } from './financial-closing.entity';

export const CLOSING_ENTRY_KINDS = ['INCOME', 'EXPENSE'] as const;
export type ClosingEntryKind = (typeof CLOSING_ENTRY_KINDS)[number];

/**
 * Um movimento congelado do balancete: uma entrada ou uma saida, como ela foi
 * naquele dia.
 *
 * Tabela filha, e nao mais uma chave no `breakdown` (ADR-002): um mes de um
 * condominio grande serializa a ordem de 60-100 KB de movimentos, e `breakdown`
 * e um `TEXT` de 65.535 bytes — o documento caberia no condominio pequeno e
 * truncaria no grande. Alem disso estas linhas sao filtradas, ordenadas e
 * paginadas, que e consulta, enquanto as linhas por categoria sao lidas em
 * bloco.
 *
 * Tudo o que o documento mostra fica gravado aqui, inclusive o que poderia ser
 * resolvido por join: uma categoria renomeada, uma unidade removida ou um
 * prestador descadastrado depois nao podem reescrever uma prestacao de contas
 * ja publicada.
 */
@Entity('financial_closing_entries')
@Index(['closingId', 'kind'])
export class FinancialClosingEntry extends TenantScopedEntity {
  @Column({ name: 'closing_id', type: 'varchar', length: 36 })
  closingId: string;

  @ManyToOne(() => FinancialClosing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'closing_id' })
  closing?: FinancialClosing;

  @Column({ type: 'varchar', length: 20 })
  kind: ClosingEntryKind;

  /** Data de caixa: `payment.paid_at` ou `expense.paid_at`. */
  @Column({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt: Date;

  /** Nulo e um valor de verdade: e a linha "Sem categoria", nunca um descarte. */
  @Column({ name: 'category_id', type: 'varchar', length: 36, nullable: true })
  categoryId?: string | null;

  @Column({ name: 'category_name', type: 'varchar', length: 120 })
  categoryName: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  /** A outra parte: numero da unidade na entrada, prestador na saida. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  counterpart?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  method?: PaymentMethod | null;

  /**
   * O `payment` ou `expense` de onde a linha veio — referencia, e nao link.
   * Guardar o id e barato e impossivel de acrescentar depois; navegar ate ele
   * ofereceria um beco sem saida dentro de um documento que precisa ser
   * confiavel, porque a linha de origem pode ter sido removida.
   */
  @Column({ name: 'source_id', type: 'varchar', length: 36 })
  sourceId: string;
}
