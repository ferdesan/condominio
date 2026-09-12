import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Payment } from '../entities/payment.entity';

export class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super(Payment, {
      alias: 'payment',
      searchableFields: ['transactionId', 'notes'],
      filterableFields: ['condominiumId', 'chargeId', 'method'],
      defaultSort: { field: 'paidAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async sumByCharge(scope: TenantScope, chargeId: string): Promise<number> {
    const row = await this.query(scope)
      .andWhere('payment.chargeId = :chargeId', { chargeId })
      .select('SUM(payment.amount)', 'total')
      .getRawOne<{ total: string | null }>();
    return Number(row?.total ?? 0);
  }

  async sumReceived(scope: TenantScope, condominiumId: string, from: Date, to: Date): Promise<number> {
    const row = await this.query(scope)
      .andWhere('payment.condominiumId = :condominiumId', { condominiumId })
      .andWhere('payment.paidAt BETWEEN :from AND :to', { from, to })
      .select('SUM(payment.amount)', 'total')
      .getRawOne<{ total: string | null }>();
    return Number(row?.total ?? 0);
  }
}

export const paymentRepository = new PaymentRepository();
