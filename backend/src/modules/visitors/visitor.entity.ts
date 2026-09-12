import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Unit } from '@/modules/units/unit.entity';

export const VISITOR_TYPES = ['VISITOR', 'DELIVERY', 'SERVICE', 'BROKER', 'OTHER'] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];

export const VISITOR_STATUSES = [
  'EXPECTED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'DENIED',
  'CANCELED',
] as const;
export type VisitorStatus = (typeof VISITOR_STATUSES)[number];

/** Controle de acesso de visitantes com pre-autorizacao pelo morador. */
@Entity('visitors')
@Index(['tenantId', 'condominiumId', 'status'])
@Index(['tenantId', 'document'])
export class Visitor extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  document?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'VISITOR' })
  type: VisitorType;

  @Column({ type: 'varchar', length: 20, default: 'EXPECTED' })
  status: VisitorStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  company?: string | null;

  @Column({ name: 'vehicle_plate', type: 'varchar', length: 10, nullable: true })
  vehiclePlate?: string | null;

  @Column({ name: 'expected_at', type: 'datetime', nullable: true })
  expectedAt?: Date | null;

  @Column({ name: 'expected_until', type: 'datetime', nullable: true })
  expectedUntil?: Date | null;

  @Column({ name: 'checked_in_at', type: 'datetime', nullable: true })
  checkedInAt?: Date | null;

  @Column({ name: 'checked_out_at', type: 'datetime', nullable: true })
  checkedOutAt?: Date | null;

  /** Usuario (morador) que autorizou previamente a entrada. */
  @Column({ name: 'authorized_by_id', type: 'varchar', length: 36, nullable: true })
  authorizedById?: string | null;

  @Column({ name: 'authorized_by_name', type: 'varchar', length: 150, nullable: true })
  authorizedByName?: string | null;

  @Column({ name: 'registered_by_id', type: 'varchar', length: 36, nullable: true })
  registeredById?: string | null;

  @Column({ name: 'badge_number', type: 'varchar', length: 30, nullable: true })
  badgeNumber?: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl?: string | null;

  @Column({ name: 'access_code', type: 'varchar', length: 12, nullable: true })
  accessCode?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
