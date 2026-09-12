import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const INCIDENT_CATEGORIES = [
  'NOISE',
  'SECURITY',
  'MAINTENANCE',
  'NEIGHBOR',
  'CLEANING',
  'PET',
  'PARKING',
  'OTHER',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

export const INCIDENT_STATUSES = [
  'OPEN',
  'IN_ANALYSIS',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Ocorrencia registrada por morador ou funcionario, com protocolo rastreavel. */
@Entity('incidents')
@Index(['tenantId', 'condominiumId', 'status'])
@Index(['tenantId', 'protocol'], { unique: true })
export class Incident extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36, nullable: true })
  unitId?: string | null;

  /** Protocolo sequencial legivel, ex.: OC-2026-000123. */
  @Column({ type: 'varchar', length: 20 })
  protocol: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'OTHER' })
  category: IncidentCategory;

  @Column({ type: 'varchar', length: 20, default: 'MEDIUM' })
  priority: IncidentPriority;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: IncidentStatus;

  @Column({ name: 'reported_by_id', type: 'varchar', length: 36, nullable: true })
  reportedById?: string | null;

  @Column({ name: 'reported_by_name', type: 'varchar', length: 150, nullable: true })
  reportedByName?: string | null;

  @Column({ name: 'is_anonymous', type: 'boolean', default: false })
  isAnonymous: boolean;

  @Column({ name: 'assigned_to_id', type: 'varchar', length: 36, nullable: true })
  assignedToId?: string | null;

  @Column({ name: 'occurred_at', type: 'datetime', nullable: true })
  occurredAt?: Date | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  attachments?: string[] | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  location?: string | null;
}
