import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';
import { Condominium } from '@/modules/condominiums/condominium.entity';

export const CLOSING_STATUSES = ['CLOSED', 'OPEN'] as const;
export type ClosingStatus = (typeof CLOSING_STATUSES)[number];

export const OPENING_BALANCE_SOURCES = ['INHERITED', 'COMPUTED'] as const;
export type OpeningBalanceSource = (typeof OPENING_BALANCE_SOURCES)[number];

/** Uma linha do balancete: uma categoria, ou a linha explicita sem categoria. */
export type StatementLine = {
  categoryId: string | null;
  name: string;
  total: number;
};

/**
 * O que fica congelado alem dos totais. Vive em `simple-json` porque e um
 * documento: nada consulta, filtra ou ordena estas linhas depois de gravadas, e
 * uma tabela filha custaria repositorio, join e cascata para servir leitura que
 * sempre vem inteira.
 *
 * Os nomes de categoria sao gravados junto de proposito — a categoria pode ser
 * renomeada ou removida depois, e o documento continua dizendo o que dizia no
 * dia em que foi fechado.
 */
export type ClosingBreakdown = {
  income: StatementLine[];
  expense: StatementLine[];
  /** Despesas pagas sem data de pagamento na competencia, fora de todo total. */
  unresolvedPaidExpenses: { count: number; total: number };
};

/**
 * O balancete de um mes, depois de fechado.
 *
 * **A linha so existe depois do primeiro fechamento.** Ausencia de linha e
 * `status = 'OPEN'` significam a mesma coisa na leitura — mes aberto —, e a
 * diferenca e apenas que o segundo ja foi fechado alguma vez. Refechar atualiza
 * a mesma linha, e o indice unico por competencia torna isso estrutural em vez
 * de convencao.
 */
@Entity('financial_closings')
@Index(['tenantId', 'condominiumId', 'referenceMonth'], { unique: true })
export class FinancialClosing extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @ManyToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium?: Condominium;

  /** Competencia no formato YYYY-MM. */
  @Column({ name: 'reference_month', type: 'varchar', length: 7 })
  referenceMonth: string;

  @Column({ type: 'varchar', length: 20, default: 'CLOSED' })
  status: ClosingStatus;

  @Column({
    name: 'opening_balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  openingBalance: number;

  @Column({ name: 'opening_balance_source', type: 'varchar', length: 20, default: 'COMPUTED' })
  openingBalanceSource: OpeningBalanceSource;

  /** Competencia herdada (`YYYY-MM`) ou data de corte (`YYYY-MM-DD`), conforme a origem. */
  @Column({ name: 'opening_balance_from', type: 'varchar', length: 10, nullable: true })
  openingBalanceFrom?: string | null;

  @Column({
    name: 'total_income',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalIncome: number;

  @Column({
    name: 'total_expense',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalExpense: number;

  @Column({
    name: 'closing_balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  closingBalance: number;

  /** Inadimplencia do mes, quadro auxiliar: congelada aqui, fora do resultado. */
  @Column({
    name: 'overdue_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  overdueAmount: number;

  @Column({ name: 'overdue_count', type: 'int', default: 0 })
  overdueCount: number;

  @Column({ type: 'simple-json' })
  breakdown: ClosingBreakdown;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt?: Date | null;

  @Column({ name: 'closed_by_id', type: 'varchar', length: 36, nullable: true })
  closedById?: string | null;

  /** Desnormalizado junto do id: o documento guarda quem fechou, nao quem se chama assim hoje. */
  @Column({ name: 'closed_by_name', type: 'varchar', length: 160, nullable: true })
  closedByName?: string | null;

  @Column({ name: 'reopened_at', type: 'datetime', nullable: true })
  reopenedAt?: Date | null;

  @Column({ name: 'reopened_by_id', type: 'varchar', length: 36, nullable: true })
  reopenedById?: string | null;

  @Column({ name: 'reopened_by_name', type: 'varchar', length: 160, nullable: true })
  reopenedByName?: string | null;

  @Column({ name: 'reopen_count', type: 'int', default: 0 })
  reopenCount: number;
}
