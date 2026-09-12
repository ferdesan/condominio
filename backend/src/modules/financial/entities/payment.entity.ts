import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';
import { Charge, type PaymentMethod } from './charge.entity';

/** Baixa (total ou parcial) de uma cobranca. */
@Entity('payments')
@Index(['tenantId', 'chargeId'])
export class Payment extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'charge_id', type: 'varchar', length: 36 })
  chargeId: string;

  @ManyToOne(() => Charge, (charge) => charge.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'charge_id' })
  charge?: Charge;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ name: 'paid_at', type: 'datetime' })
  paidAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'PIX' })
  method: PaymentMethod;

  @Column({ name: 'receipt_url', type: 'varchar', length: 255, nullable: true })
  receiptUrl?: string | null;

  @Column({ name: 'registered_by_id', type: 'varchar', length: 36, nullable: true })
  registeredById?: string | null;

  @Column({ name: 'transaction_id', type: 'varchar', length: 80, nullable: true })
  transactionId?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
