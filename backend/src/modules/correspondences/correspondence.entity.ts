import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Unit } from '@/modules/units/unit.entity';

export const CORRESPONDENCE_TYPES = [
  'LETTER',
  'PACKAGE',
  'REGISTERED',
  'FOOD_DELIVERY',
  'OTHER',
] as const;
export type CorrespondenceType = (typeof CORRESPONDENCE_TYPES)[number];

export const CORRESPONDENCE_STATUSES = ['PENDING', 'DELIVERED', 'RETURNED'] as const;
export type CorrespondenceStatus = (typeof CORRESPONDENCE_STATUSES)[number];

/** Correspondencia ou encomenda recebida na portaria. */
@Entity('correspondences')
@Index(['tenantId', 'condominiumId', 'status'])
export class Correspondence extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @Column({ name: 'resident_id', type: 'varchar', length: 36, nullable: true })
  residentId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PACKAGE' })
  type: CorrespondenceType;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: CorrespondenceStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  carrier?: string | null;

  @Column({ name: 'tracking_code', type: 'varchar', length: 60, nullable: true })
  trackingCode?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ name: 'received_at', type: 'datetime' })
  receivedAt: Date;

  @Column({ name: 'received_by', type: 'varchar', length: 150, nullable: true })
  receivedBy?: string | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt?: Date | null;

  @Column({ name: 'delivered_to', type: 'varchar', length: 150, nullable: true })
  deliveredTo?: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
