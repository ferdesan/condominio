import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Poll } from './poll.entity';

export const ASSEMBLY_TYPES = ['ORDINARY', 'EXTRAORDINARY'] as const;
export type AssemblyType = (typeof ASSEMBLY_TYPES)[number];

export const ASSEMBLY_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'FINISHED',
  'CANCELED',
] as const;
export type AssemblyStatus = (typeof ASSEMBLY_STATUSES)[number];

export const ASSEMBLY_MODES = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const;
export type AssemblyMode = (typeof ASSEMBLY_MODES)[number];

/** Assembleia ordinaria ou extraordinaria (AGO/AGE). */
@Entity('assemblies')
@Index(['tenantId', 'condominiumId', 'status'])
export class Assembly extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ORDINARY' })
  type: AssemblyType;

  @Column({ type: 'varchar', length: 20, default: 'SCHEDULED' })
  status: AssemblyStatus;

  @Column({ type: 'varchar', length: 20, default: 'HYBRID' })
  mode: AssemblyMode;

  @Column({ name: 'scheduled_at', type: 'datetime' })
  scheduledAt: Date;

  /** Horario da segunda convocacao, quando nao ha quorum na primeira. */
  @Column({ name: 'second_call_at', type: 'datetime', nullable: true })
  secondCallAt?: Date | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  location?: string | null;

  @Column({ name: 'online_url', type: 'varchar', length: 255, nullable: true })
  onlineUrl?: string | null;

  /** Percentual minimo de unidades presentes para deliberar. */
  @Column({ name: 'quorum_percent', type: 'int', default: 50 })
  quorumPercent: number;

  @Column({ name: 'agenda_url', type: 'varchar', length: 255, nullable: true })
  agendaUrl?: string | null;

  @Column({ name: 'minutes_url', type: 'varchar', length: 255, nullable: true })
  minutesUrl?: string | null;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt?: Date | null;

  @Column({ name: 'attendees_count', type: 'int', default: 0 })
  attendeesCount: number;

  @OneToMany(() => Poll, (poll) => poll.assembly)
  polls?: Poll[];
}
