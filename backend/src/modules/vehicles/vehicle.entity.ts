import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Unit } from '@/modules/units/unit.entity';

export const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE', 'TRUCK', 'BICYCLE', 'OTHER'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

@Entity('vehicles')
@Index(['tenantId', 'condominiumId'])
@Index(['tenantId', 'plate'], { unique: true })
export class Vehicle extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36, nullable: true })
  unitId?: string | null;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit | null;

  @Column({ name: 'resident_id', type: 'varchar', length: 36, nullable: true })
  residentId?: string | null;

  @Column({ type: 'varchar', length: 10 })
  plate: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  brand?: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  model?: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'CAR' })
  type: VehicleType;

  @Column({ type: 'int', nullable: true })
  year?: number | null;

  @Column({ name: 'parking_spot', type: 'varchar', length: 20, nullable: true })
  parkingSpot?: string | null;

  @Column({ name: 'sticker_number', type: 'varchar', length: 30, nullable: true })
  stickerNumber?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: VehicleStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
