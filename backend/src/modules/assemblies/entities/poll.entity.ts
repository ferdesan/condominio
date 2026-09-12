import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Assembly } from './assembly.entity';
import { PollOption } from './poll-option.entity';

export const POLL_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'CANCELED'] as const;
export type PollStatus = (typeof POLL_STATUSES)[number];

export const POLL_VOTER_TYPES = ['OWNERS', 'ALL_RESIDENTS'] as const;
export type PollVoterType = (typeof POLL_VOTER_TYPES)[number];

/**
 * Votacao online. Pode estar vinculada a uma pauta de assembleia ou existir
 * isoladamente (consulta aos moradores).
 */
@Entity('polls')
@Index(['tenantId', 'condominiumId', 'status'])
export class Poll extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'assembly_id', type: 'varchar', length: 36, nullable: true })
  assemblyId?: string | null;

  @ManyToOne(() => Assembly, (assembly) => assembly.polls, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'assembly_id' })
  assembly?: Assembly | null;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: PollStatus;

  @Column({ name: 'voter_type', type: 'varchar', length: 20, default: 'OWNERS' })
  voterType: PollVoterType;

  /** Voto ponderado pela fracao ideal da unidade. */
  @Column({ name: 'weighted_by_fraction', type: 'boolean', default: false })
  weightedByFraction: boolean;

  @Column({ name: 'is_secret', type: 'boolean', default: false })
  isSecret: boolean;

  @Column({ name: 'allow_multiple', type: 'boolean', default: false })
  allowMultiple: boolean;

  @Column({ name: 'starts_at', type: 'datetime' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'datetime' })
  endsAt: Date;

  @Column({ name: 'quorum_percent', type: 'int', default: 0 })
  quorumPercent: number;

  @Column({ name: 'total_votes', type: 'int', default: 0 })
  totalVotes: number;

  @Column({ name: 'eligible_units', type: 'int', default: 0 })
  eligibleUnits: number;

  @Column({ name: 'results_published_at', type: 'datetime', nullable: true })
  resultsPublishedAt?: Date | null;

  @OneToMany(() => PollOption, (option) => option.poll, { cascade: ['insert'] })
  options?: PollOption[];
}
