import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';
import type { PaymentMethod } from './charge.entity';

export const EXPENSE_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELED'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/** Despesa do condominio (folha, agua, energia, contratos, manutencao). */
@Entity('expenses')
@Index(['tenantId', 'condominiumId', 'status'])
@Index(['tenantId', 'condominiumId', 'competence'])
export class Expense extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'category_id', type: 'varchar', length: 36, nullable: true })
  categoryId?: string | null;

  @Column({ name: 'service_provider_id', type: 'varchar', length: 36, nullable: true })
  serviceProviderId?: string | null;

  @Column({ type: 'varchar', length: 180 })
  description: string;

  /** Competencia no formato YYYY-MM. */
  @Column({ type: 'varchar', length: 7 })
  competence: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: ExpenseStatus;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt?: Date | null;

  @Column({ name: 'payment_method', type: 'varchar', length: 20, nullable: true })
  paymentMethod?: PaymentMethod | null;

  @Column({ name: 'document_url', type: 'varchar', length: 255, nullable: true })
  documentUrl?: string | null;

  @Column({ name: 'document_number', type: 'varchar', length: 60, nullable: true })
  documentNumber?: string | null;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
