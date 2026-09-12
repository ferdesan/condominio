import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';
import { Unit } from '@/modules/units/unit.entity';
import { Payment } from './payment.entity';

export const CHARGE_STATUSES = ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELED'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const PAYMENT_METHODS = [
  'PIX',
  'BOLETO',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'TRANSFER',
  'CASH',
  'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Cobranca lancada para uma unidade (taxa condominial, fundo, multa, rateio). */
@Entity('charges')
@Index(['tenantId', 'condominiumId', 'status'])
@Index(['tenantId', 'unitId', 'referenceMonth'])
export class Charge extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @Column({ name: 'category_id', type: 'varchar', length: 36, nullable: true })
  categoryId?: string | null;

  @Column({ name: 'resident_id', type: 'varchar', length: 36, nullable: true })
  residentId?: string | null;

  @Column({ type: 'varchar', length: 180 })
  description: string;

  /** Competencia no formato YYYY-MM. */
  @Column({ name: 'reference_month', type: 'varchar', length: 7 })
  referenceMonth: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  discount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  interest: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  penalty: number;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  paidAmount: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: ChargeStatus;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt?: Date | null;

  @Column({ name: 'payment_method', type: 'varchar', length: 20, nullable: true })
  paymentMethod?: PaymentMethod | null;

  @Column({ name: 'barcode', type: 'varchar', length: 60, nullable: true })
  barcode?: string | null;

  @Column({ name: 'invoice_url', type: 'varchar', length: 255, nullable: true })
  invoiceUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @OneToMany(() => Payment, (payment) => payment.charge)
  payments?: Payment[];
}
