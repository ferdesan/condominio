import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';

export const COMMON_AREA_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'BLOCKED'] as const;
export type CommonAreaStatus = (typeof COMMON_AREA_STATUSES)[number];

/** Area comum reservavel: salao de festas, churrasqueira, quadra, coworking. */
@Entity('common_areas')
@Index(['tenantId', 'condominiumId'])
export class CommonArea extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'varchar', length: 20, default: 'AVAILABLE' })
  status: CommonAreaStatus;

  @Column({ name: 'requires_approval', type: 'boolean', default: true })
  requiresApproval: boolean;

  @Column({
    name: 'reservation_fee',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  reservationFee: number;

  /** Janela diaria de funcionamento no formato HH:mm. */
  @Column({ name: 'opens_at', type: 'varchar', length: 5, default: '08:00' })
  opensAt: string;

  @Column({ name: 'closes_at', type: 'varchar', length: 5, default: '22:00' })
  closesAt: string;

  /** Dias da semana liberados (0 = domingo). */
  @Column({ name: 'available_weekdays', type: 'simple-json', nullable: true })
  availableWeekdays?: number[] | null;

  @Column({ name: 'min_hours', type: 'int', default: 1 })
  minHours: number;

  @Column({ name: 'max_hours', type: 'int', default: 6 })
  maxHours: number;

  @Column({ name: 'advance_booking_days', type: 'int', default: 60 })
  advanceBookingDays: number;

  /** Intervalo minimo entre reservas da mesma unidade, em dias. */
  @Column({ name: 'min_interval_days', type: 'int', default: 0 })
  minIntervalDays: number;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  rules?: string | null;
}
