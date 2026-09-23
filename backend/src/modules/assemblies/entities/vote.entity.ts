import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity, preciseNumericTransformer } from '@/shared/entities';
import { Poll } from './poll.entity';
import { PollOption } from './poll-option.entity';

/**
 * Voto registrado. A unicidade por (poll, unidade) e garantida por indice
 * unico: uma unidade vota uma unica vez em cada deliberacao.
 */
@Entity('votes')
@Index(['tenantId', 'pollId', 'unitId'], { unique: true })
export class Vote extends TenantScopedEntity {
  @Column({ name: 'poll_id', type: 'varchar', length: 36 })
  pollId: string;

  @ManyToOne(() => Poll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poll_id' })
  poll?: Poll;

  @Column({ name: 'option_id', type: 'varchar', length: 36 })
  optionId: string;

  @ManyToOne(() => PollOption, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'option_id' })
  option?: PollOption;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  /** Nulo quando a votacao e secreta: preserva o sigilo do voto. */
  @Column({ name: 'voter_id', type: 'varchar', length: 36, nullable: true })
  voterId?: string | null;

  @Column({ name: 'voter_name', type: 'varchar', length: 150, nullable: true })
  voterName?: string | null;

  /** Usuario (sindico/admin) que registrou o voto em nome da unidade. */
  @Column({ name: 'registered_by_user_id', type: 'varchar', length: 36, nullable: true })
  registeredByUserId?: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 6,
    default: 1,
    transformer: preciseNumericTransformer,
  })
  weight: number;

  @Column({ name: 'voted_at', type: 'datetime' })
  votedAt: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string | null;
}
