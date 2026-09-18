import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';
import { Block } from '@/modules/blocks/block.entity';

export const CONDOMINIUM_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'MIXED'] as const;
export type CondominiumType = (typeof CONDOMINIUM_TYPES)[number];

export const CONDOMINIUM_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type CondominiumStatus = (typeof CONDOMINIUM_STATUSES)[number];

@Entity('condominiums')
@Index(['tenantId', 'name'])
export class Condominium extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 14, nullable: true })
  document?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'RESIDENTIAL' })
  type: CondominiumType;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: CondominiumStatus;

  @Column({ name: 'zip_code', type: 'varchar', length: 8, nullable: true })
  zipCode?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  street?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  number?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  complement?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  district?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email?: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 255, nullable: true })
  logoUrl?: string | null;

  @Column({ name: 'syndic_name', type: 'varchar', length: 150, nullable: true })
  syndicName?: string | null;

  @Column({ name: 'syndic_phone', type: 'varchar', length: 20, nullable: true })
  syndicPhone?: string | null;

  @Column({ name: 'syndic_term_ends_at', type: 'date', nullable: true })
  syndicTermEndsAt?: string | null;

  /** Dia padrao de vencimento das taxas condominiais (1-28). */
  @Column({ name: 'charge_due_day', type: 'int', default: 10 })
  chargeDueDay: number;

  /**
   * Saldo em caixa na data de corte, digitado uma vez. E o ponto de partida do
   * balancete: dele em diante cada mes fechado entrega o seu saldo ao seguinte,
   * e so os meses anteriores ao primeiro fechamento voltam a este numero.
   */
  @Column({
    name: 'opening_balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  openingBalance: number;

  /**
   * Data a que o saldo de abertura se refere. Nulo significa "sem corte": tudo
   * o que o banco guarda entra na conta, que e a leitura honesta de nao ter sido
   * informada.
   */
  @Column({ name: 'opening_balance_date', type: 'date', nullable: true })
  openingBalanceDate?: string | null;

  @Column({ name: 'total_units', type: 'int', default: 0 })
  totalUnits: number;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @OneToMany(() => Block, (block) => block.condominium)
  blocks?: Block[];
}
