import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';
import { CommonArea } from '@/modules/common-areas/common-area.entity';
import { Unit } from '@/modules/units/unit.entity';

export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'CANCELED',
  'COMPLETED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

@Entity('reservations')
@Index(['tenantId', 'commonAreaId', 'startsAt'])
@Index(['tenantId', 'condominiumId', 'status'])
export class Reservation extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'common_area_id', type: 'varchar', length: 36 })
  commonAreaId: string;

  @ManyToOne(() => CommonArea, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'common_area_id' })
  commonArea?: CommonArea;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @Column({ name: 'requested_by_id', type: 'varchar', length: 36 })
  requestedById: string;

  @Column({ name: 'requested_by_name', type: 'varchar', length: 150 })
  requestedByName: string;

  @Column({ name: 'starts_at', type: 'datetime' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'datetime' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: ReservationStatus;

  @Column({ name: 'guests_count', type: 'int', default: 0 })
  guestsCount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  fee: number;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt?: Date | null;

  @Column({ name: 'reviewed_by_id', type: 'varchar', length: 36, nullable: true })
  reviewedById?: string | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'status_reason', type: 'varchar', length: 255, nullable: true })
  statusReason?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
