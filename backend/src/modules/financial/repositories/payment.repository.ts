import { Unit } from '@/modules/units/unit.entity';
import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import type { RawMovement } from '../closing-math';
import { Charge } from '../entities/charge.entity';
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

  /**
   * Receita do balancete de caixa: o que entrou entre `from` (inclusive) e
   * `toExclusive`, agrupado pela categoria **da cobranca** — o pagamento nao tem
   * categoria propria.
   *
   * O join e manual contra `Charge`, e nao pela relacao: um join de relacao
   * herda o filtro de exclusao logica, e uma cobranca removida levaria consigo a
   * categoria de um pagamento que existiu de verdade. O dinheiro entrou; a linha
   * nao pode sumir do documento por causa do estado atual de outra tabela.
   */
  async incomeByCategory(
    scope: TenantScope,
    condominiumId: string,
    from: Date,
    toExclusive: Date,
  ): Promise<{ categoryId: string | null; total: string | null }[]> {
    return this.query(scope)
      .leftJoin(Charge, 'charge', 'charge.id = payment.chargeId')
      .andWhere('payment.condominiumId = :condominiumId', { condominiumId })
      .andWhere('payment.paidAt >= :from', { from })
      .andWhere('payment.paidAt < :toExclusive', { toExclusive })
      .select('charge.categoryId', 'categoryId')
      .addSelect('SUM(payment.amount)', 'total')
      .groupBy('charge.categoryId')
      .getRawMany<{ categoryId: string | null; total: string | null }>();
  }

  /**
   * As entradas do balancete uma a uma, e nao somadas: mesma janela e mesmo
   * regime de caixa de `incomeByCategory`, so que linha por linha.
   *
   * Os dois joins sao manuais pela razao escrita em `:25-33` — um join de
   * relacao herda o filtro de exclusao logica, e aqui ele custaria mais do que
   * a categoria: uma cobranca ou uma unidade removida depois levaria consigo a
   * linha inteira de um pagamento que aconteceu de verdade. O documento
   * descreve o dinheiro que entrou, e nao o cadastro que sobreviveu.
   */
  async movementsInRange(
    scope: TenantScope,
    condominiumId: string,
    from: Date,
    toExclusive: Date,
  ): Promise<RawMovement[]> {
    return this.query(scope)
      .leftJoin(Charge, 'charge', 'charge.id = payment.chargeId')
      .leftJoin(Unit, 'unit', 'unit.id = charge.unitId')
      .andWhere('payment.condominiumId = :condominiumId', { condominiumId })
      .andWhere('payment.paidAt >= :from', { from })
      .andWhere('payment.paidAt < :toExclusive', { toExclusive })
      .select('payment.id', 'sourceId')
      .addSelect('payment.paidAt', 'occurredAt')
      .addSelect('charge.categoryId', 'categoryId')
      .addSelect('charge.description', 'description')
      .addSelect('unit.number', 'counterpart')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.method', 'method')
      .getRawMany<RawMovement>();
  }

  /**
   * Soma dos pagamentos numa janela semiaberta. `from` nulo significa sem limite
   * inferior — e o saldo de abertura sem data de corte (ADR-002).
   */
  async sumInWindow(
    scope: TenantScope,
    condominiumId: string,
    from: Date | null,
    toExclusive: Date,
  ): Promise<number> {
    const qb = this.query(scope)
      .andWhere('payment.condominiumId = :condominiumId', { condominiumId })
      .andWhere('payment.paidAt < :toExclusive', { toExclusive });

    if (from) qb.andWhere('payment.paidAt >= :from', { from });

    const row = await qb.select('SUM(payment.amount)', 'total').getRawOne<{ total: string | null }>();
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
