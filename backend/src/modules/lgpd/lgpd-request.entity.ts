import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Resident } from '@/modules/residents/resident.entity';

export const LGPD_REQUEST_STATUSES = ['PENDING', 'EXECUTED', 'CANCELLED'] as const;
export type LgpdRequestStatus = (typeof LGPD_REQUEST_STATUSES)[number];

@Entity('lgpd_requests')
@Index(['tenantId', 'condominiumId'])
@Index(['tenantId', 'status'])
export class LgpdRequest extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'resident_id', type: 'varchar', length: 36 })
  residentId: string;

  @ManyToOne(() => Resident)
  @JoinColumn({ name: 'resident_id' })
  resident?: Resident;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: LgpdRequestStatus;

  @Column({ name: 'requested_at', type: 'datetime', precision: 6 })
  requestedAt: Date;

  @Column({ name: 'executed_at', type: 'datetime', precision: 6, nullable: true })
  executedAt?: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', precision: 6, nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
