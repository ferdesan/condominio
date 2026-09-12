import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity, preciseNumericTransformer } from '@/shared/entities';
import { Poll } from './poll.entity';

/** Alternativa de uma votacao (ex.: Aprovo / Rejeito / Abstencao). */
@Entity('poll_options')
@Index(['tenantId', 'pollId'])
export class PollOption extends TenantScopedEntity {
  @Column({ name: 'poll_id', type: 'varchar', length: 36 })
  pollId: string;

  @ManyToOne(() => Poll, (poll) => poll.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poll_id' })
  poll?: Poll;

  @Column({ type: 'varchar', length: 180 })
  label: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** Contadores desnormalizados, atualizados a cada voto registrado. */
  @Column({ name: 'votes_count', type: 'int', default: 0 })
  votesCount: number;

  @Column({
    name: 'votes_weight',
    type: 'decimal',
    precision: 12,
    scale: 6,
    default: 0,
    transformer: preciseNumericTransformer,
  })
  votesWeight: number;
}
