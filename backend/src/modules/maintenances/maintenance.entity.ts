import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';

export const MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION'] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const MAINTENANCE_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'CANCELED',
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_RECURRENCES = [
  'NONE',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const;
export type MaintenanceRecurrence = (typeof MAINTENANCE_RECURRENCES)[number];

/** Ordem de manutencao preventiva ou corretiva de um ativo do condominio. */
@Entity('maintenances')
@Index(['tenantId', 'condominiumId', 'status'])
export class Maintenance extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PREVENTIVE' })
  type: MaintenanceType;

  @Column({ type: 'varchar', length: 20, default: 'SCHEDULED' })
  status: MaintenanceStatus;

  @Column({ type: 'varchar', length: 20, default: 'NONE' })
  recurrence: MaintenanceRecurrence;

  /** Ativo ou local, ex.: Elevador Social - Torre A. */
  @Column({ name: 'asset_name', type: 'varchar', length: 150, nullable: true })
  assetName?: string | null;

  @Column({ name: 'service_provider_id', type: 'varchar', length: 36, nullable: true })
  serviceProviderId?: string | null;

  @Column({ name: 'responsible_id', type: 'varchar', length: 36, nullable: true })
  responsibleId?: string | null;

  @Column({ name: 'scheduled_for', type: 'datetime' })
  scheduledFor: Date;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'next_execution_at', type: 'date', nullable: true })
  nextExecutionAt?: string | null;

  @Column({
    name: 'estimated_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  estimatedCost: number;

  @Column({
    name: 'final_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  finalCost?: number | null;

  @Column({ type: 'simple-json', nullable: true })
  attachments?: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
