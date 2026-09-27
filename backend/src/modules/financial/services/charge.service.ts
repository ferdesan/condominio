import type { DeepPartial } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import {
  notificationService,
  type NotificationService,
} from '@/modules/notifications/notification.service';
import { tenantRepository, type TenantRepository } from '@/modules/tenants/tenant.repository';
import { unitRepository, type UnitRepository } from '@/modules/units/unit.repository';
import { realtimeService, type RealtimeService } from '@/realtime/realtime.service';
import { BusinessRuleError, NotFoundError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { recipientsService, type RecipientsService } from '@/shared/services/recipients.service';
import { assertReferenceExists, resolveUnitCondominium } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { dayjs, isOverdue } from '@/shared/utils/date.util';
import { withCashLock } from '../cash-lock';
import { assertCorrectableCashDate, assertMonthOpen, assertRangeOpen } from '../closing-guard';
import { Charge } from '../entities/charge.entity';
import { Payment } from '../entities/payment.entity';
import { chargeRepository, type ChargeRepository } from '../repositories/charge.repository';
import { paymentRepository, type PaymentRepository } from '../repositories/payment.repository';
import type {
  CorrectPaidAtDTO,
  CreateChargeDTO,
  GenerateChargesDTO,
  RegisterPaymentDTO,
  UpdateChargeDTO,
} from '../schemas/financial.schema';

export type ChargeSummary = Awaited<ReturnType<ChargeRepository['totals']>> & {
  delinquencyRate: number;
};

export class ChargeService extends CondominiumScopedService<Charge, CreateChargeDTO, UpdateChargeDTO> {
  constructor(
    private readonly charges: ChargeRepository = chargeRepository,
    private readonly payments: PaymentRepository = paymentRepository,
    private readonly units: UnitRepository = unitRepository,
    private readonly tenants: TenantRepository = tenantRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
  ) {
    super(charges, { resource: 'charge', label: 'Cobranca' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateChargeDTO,
  ): Promise<DeepPartial<Charge>> {
    const unitCondominium = await resolveUnitCondominium(ctx.scope, dto.unitId);
    if (unitCondominium !== dto.condominiumId) {
      throw new BusinessRuleError('A unidade informada pertence a outro condominio.');
    }
    if (dto.categoryId) {
      await assertReferenceExists(ctx.scope, 'financial_categories', dto.categoryId);
    }

    return {
      ...dto,
      status: isOverdue(dto.dueDate) ? 'OVERDUE' : 'PENDING',
      paidAmount: 0,
    } as DeepPartial<Charge>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Charge,
    dto: UpdateChargeDTO,
  ): Promise<DeepPartial<Charge>> {
    if (current.status === 'PAID' && dto.amount !== undefined && dto.amount !== current.amount) {
      throw new BusinessRuleError('Cobrancas quitadas nao podem ter o valor alterado.');
    }
    if (dto.categoryId) {
      await assertReferenceExists(ctx.scope, 'financial_categories', dto.categoryId);
    }
    return dto as DeepPartial<Charge>;
  }

  protected override async beforeRemove(_ctx: RequestContext, entity: Charge): Promise<void> {
    if (entity.paidAmount > 0) {
      throw new BusinessRuleError(
        'Cobranca possui pagamentos registrados. Cancele-a em vez de excluir.',
      );
    }
  }

  /**
   * Gera as cobrancas do mes para todas as unidades do condominio.
   *
   * Tres modos de calculo, nesta ordem de precedencia:
   * 1. `fixedAmount` - mesmo valor para todas as unidades;
   * 2. `totalToApportion` - rateio pela fracao ideal de cada unidade;
   * 3. valor cadastrado em `unit.monthlyFee`.
   */
  async generateMonthly(
    ctx: RequestContext,
    dto: GenerateChargesDTO,
  ): Promise<{ created: number; skipped: number; total: number }> {
    const units = await this.units.listByCondominium(ctx.scope, dto.condominiumId);
    const eligible = dto.onlyOccupied ? units.filter((unit) => unit.status === 'OCCUPIED') : units;

    if (!eligible.length) {
      throw new BusinessRuleError('Nenhuma unidade elegivel encontrada para gerar cobrancas.');
    }

    const fractionTotal = eligible.reduce((sum, unit) => sum + (unit.idealFraction ?? 0), 0);
    if (dto.totalToApportion && fractionTotal <= 0) {
      throw new BusinessRuleError(
        'Rateio por fracao ideal exige que as unidades tenham a fracao cadastrada.',
      );
    }

    const rows: DeepPartial<Charge>[] = [];
    let skipped = 0;

    for (const unit of eligible) {
      const alreadyCharged = await this.charges.existsForUnitAndMonth(
        ctx.scope,
        unit.id,
        dto.referenceMonth,
        dto.categoryId ?? null,
      );
      if (alreadyCharged) {
        skipped += 1;
        continue;
      }

      const amount = this.resolveAmount(dto, unit.monthlyFee, unit.idealFraction, fractionTotal);
      if (amount <= 0) {
        skipped += 1;
        continue;
      }

      rows.push({
        tenantId: ctx.scope.tenantId,
        condominiumId: dto.condominiumId,
        unitId: unit.id,
        categoryId: dto.categoryId ?? null,
        description: dto.description,
        referenceMonth: dto.referenceMonth,
        dueDate: dto.dueDate,
        amount,
        discount: 0,
        interest: 0,
        penalty: 0,
        paidAmount: 0,
        status: isOverdue(dto.dueDate) ? 'OVERDUE' : 'PENDING',
      });
    }

    if (!rows.length) {
      throw new BusinessRuleError(
        'Nenhuma cobranca nova foi gerada: a competencia ja esta lancada para todas as unidades.',
      );
    }

    await AppDataSource.transaction(async (manager) => {
      await manager.save(
        rows.map((row) => manager.create(Charge, row)),
        { chunk: 100 },
      );
    });

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'CREATE',
      resource: 'charge',
      resourceId: dto.condominiumId,
      description: `Geracao de ${rows.length} cobrancas para a competencia ${dto.referenceMonth}.`,
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    this.realtime.emitToCondominium(dto.condominiumId, 'charge:updated', {
      referenceMonth: dto.referenceMonth,
      created: rows.length,
    });

    return {
      created: rows.length,
      skipped,
      total: rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    };
  }

  /** Baixa de pagamento (total ou parcial) com atualizacao do status da cobranca. */
  async registerPayment(
    ctx: RequestContext,
    chargeId: string,
    dto: RegisterPaymentDTO,
  ): Promise<{ charge: Charge; payment: Payment }> {
    const charge = await this.findById(ctx, chargeId);

    if (charge.status === 'CANCELED') {
      throw new BusinessRuleError('Cobranca cancelada nao aceita pagamentos.');
    }

    // A guarda mora aqui, inline, e nao num hook: `registerPayment` escreve a
    // cobranca por `this.repository.update` (abaixo), sem passar por
    // `beforeUpdate`. Montada so como hook, ela deixaria aberta exatamente a
    // porta mais usada do modulo (ADR-003).
    //
    // Guarda, saldo e gravacao sob a trava de caixa do condominio: um
    // fechamento concorrente nao congela o mes entre a guarda e a gravacao, e
    // duas baixas simultaneas da mesma cobranca nao passam ambas pelo saldo.
    const { payment, paidAmount, isSettled, alreadyPaid, charged } = await withCashLock(
      charge.condominiumId,
      async () => {
        await assertMonthOpen(ctx.scope, charge.condominiumId, dto.paidAt);

        const total = this.totalDue(charge);
        const alreadyPaid = await this.payments.sumByCharge(ctx.scope, charge.id);
        const remaining = Math.round((total - alreadyPaid) * 100) / 100;

        if (remaining <= 0) {
          throw new BusinessRuleError('Cobranca ja esta quitada.');
        }
        if (dto.amount > remaining) {
          throw new BusinessRuleError(
            `Valor informado excede o saldo devedor de R$ ${remaining.toFixed(2)}.`,
          );
        }

        const payment = await this.payments.create(ctx.scope, {
          condominiumId: charge.condominiumId,
          chargeId: charge.id,
          amount: dto.amount,
          paidAt: dto.paidAt,
          method: dto.method,
          receiptUrl: dto.receiptUrl ?? null,
          transactionId: dto.transactionId ?? null,
          notes: dto.notes ?? null,
          registeredById: ctx.actor.userId,
        });

        const paidAmount = Math.round((alreadyPaid + dto.amount) * 100) / 100;
        const isSettled = paidAmount >= total;

        const charged = await this.repository.update(ctx.scope, charge.id, {
          paidAmount,
          status: isSettled ? 'PAID' : 'PARTIAL',
          paidAt: isSettled ? dto.paidAt : null,
          paymentMethod: dto.method,
        } as DeepPartial<Charge>);

        return { payment, paidAmount, isSettled, alreadyPaid, charged };
      },
    );

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'UPDATE',
      resource: 'charge',
      resourceId: charge.id,
      description: `Pagamento de R$ ${dto.amount.toFixed(2)} registrado (${dto.method}).`,
      before: { paidAmount: alreadyPaid, status: charge.status },
      after: { paidAmount, status: isSettled ? 'PAID' : 'PARTIAL' },
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    const userIds = await this.recipients.usersOfUnit(ctx.scope.tenantId, charge.unitId);
    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: charge.condominiumId,
      userIds,
      title: isSettled ? 'Pagamento confirmado' : 'Pagamento parcial registrado',
      message: `${charge.description} (${charge.referenceMonth}): R$ ${dto.amount.toFixed(2)} recebido.`,
      type: 'CHARGE',
      resource: 'charge',
      resourceId: charge.id,
      actionUrl: `/financeiro/cobrancas/${charge.id}`,
    });

    this.realtime.emitToCondominium(charge.condominiumId, 'charge:updated', {
      id: charge.id,
      status: isSettled ? 'PAID' : 'PARTIAL',
    });

    return { charge: charged ?? charge, payment };
  }

  /**
   * Corrige a data de uma baixa ja registrada. So a data muda: valor, forma e
   * status da cobranca continuam os mesmos.
   *
   * `charges.paid_at` repete a data da baixa que quitou a cobranca, entao numa
   * cobranca quitada ele e recalculado como a baixa mais recente — corrigir a
   * ultima baixa sem isso deixaria a cobranca dizendo uma data que nenhum
   * pagamento tem. As duas escritas vao na mesma transacao pelo mesmo motivo.
   *
   * As guardas rodam sob a trava de caixa do condominio (`withCashLock`): um
   * fechamento de mes concorrente ou espera esta correcao terminar, ou termina
   * antes e ela ve o mes fechado.
   *
   * Sem notificacao ao morador: e ajuste interno, nao um pagamento novo.
   */
  async correctPaymentDate(
    ctx: RequestContext,
    paymentId: string,
    dto: CorrectPaidAtDTO,
  ): Promise<Payment> {
    const found = await this.payments.findById(ctx.scope, paymentId);
    if (!found) throw new NotFoundError('Pagamento');
    // Acesso ao condominio e existencia da cobranca, antes de travar qualquer coisa.
    await this.findById(ctx, found.chargeId);

    const { payment, charge } = await withCashLock(found.condominiumId, () =>
      AppDataSource.transaction(async (manager) => {
        // Relidos depois da trava: outra correcao do mesmo pagamento pode ter
        // acabado de gravar, e a data "antiga" da guarda precisa ser a atual.
        const payment = await manager.findOneOrFail(Payment, { where: { id: found.id } });
        const charge = await manager.findOneOrFail(Charge, { where: { id: payment.chargeId } });
        if (charge.status === 'CANCELED') {
          throw new BusinessRuleError('Cobranca cancelada nao aceita correcao de pagamento.');
        }

        await assertCorrectableCashDate(ctx.scope, payment.condominiumId, dto.paidAt);
        await assertRangeOpen(ctx.scope, payment.condominiumId, payment.paidAt, dto.paidAt);

        await manager.update(
          Payment,
          { id: payment.id, tenantId: payment.tenantId },
          { paidAt: dto.paidAt },
        );

        if (charge.status === 'PAID') {
          const siblings = await manager.find(Payment, {
            where: { chargeId: charge.id, tenantId: charge.tenantId },
            select: { id: true, paidAt: true },
          });
          const latest = siblings.reduce<Date | null>((max, row) => {
            const when = new Date(row.paidAt);
            return !max || when > max ? when : max;
          }, null);
          await manager.update(
            Charge,
            { id: charge.id, tenantId: charge.tenantId },
            { paidAt: latest },
          );
        }

        return { payment, charge };
      }),
    );

    await this.invalidateCache(ctx);
    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'UPDATE',
      resource: 'payment',
      resourceId: payment.id,
      description: `Data do recebimento corrigida. Motivo: ${dto.reason}`,
      before: { paidAt: payment.paidAt, chargeId: charge.id },
      after: { paidAt: dto.paidAt, chargeId: charge.id },
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    this.realtime.emitToCondominium(charge.condominiumId, 'charge:updated', {
      id: charge.id,
      status: charge.status,
    });

    return { ...payment, paidAt: dto.paidAt };
  }

  async cancel(ctx: RequestContext, id: string, reason?: string): Promise<Charge> {
    const charge = await this.findById(ctx, id);
    if (charge.paidAmount > 0) {
      throw new BusinessRuleError('Cobrancas com pagamento registrado nao podem ser canceladas.');
    }

    return this.update(ctx, id, {
      status: 'CANCELED',
      notes: reason ?? charge.notes,
    } as UpdateChargeDTO);
  }

  async summary(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth?: string,
  ): Promise<ChargeSummary> {
    const totals = await this.charges.totals(ctx.scope, condominiumId, referenceMonth);
    const delinquencyRate = totals.billed > 0 ? (totals.overdue / totals.billed) * 100 : 0;
    return { ...totals, delinquencyRate: Math.round(delinquencyRate * 100) / 100 };
  }

  async delinquency(ctx: RequestContext, condominiumId: string) {
    const rows = await this.charges.delinquencyByUnit(ctx.scope, condominiumId);
    const units = await this.units.listByCondominium(ctx.scope, condominiumId);
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));

    return rows.map((row) => ({
      unitId: row.unitId,
      unitNumber: unitMap.get(row.unitId)?.number ?? null,
      blockId: unitMap.get(row.unitId)?.blockId ?? null,
      charges: Number(row.charges),
      total: Number(row.total),
    }));
  }

  /**
   * Aplica multa e juros configurados no tenant sobre as cobrancas vencidas.
   * Executado pelo job diario e tambem disponivel sob demanda.
   */
  async applyLateFees(ctx: RequestContext, condominiumId?: string): Promise<{ updated: number }> {
    const tenant = await this.tenants.findById(ctx.scope.tenantId);
    const penaltyPercent = tenant?.settings?.latePenaltyPercent ?? 2;
    const interestPercent = tenant?.settings?.lateInterestPercent ?? 1;
    const graceDays = tenant?.settings?.chargeGraceDays ?? 0;

    const qb = this.charges
      .query(ctx.scope)
      .andWhere('charge.status IN (:...statuses)', { statuses: ['PENDING', 'PARTIAL', 'OVERDUE'] })
      .andWhere('charge.dueDate < :limit', {
        limit: dayjs().subtract(graceDays, 'day').format('YYYY-MM-DD'),
      });

    if (condominiumId) qb.andWhere('charge.condominiumId = :condominiumId', { condominiumId });

    const overdueCharges = await qb.getMany();
    let updated = 0;

    for (const charge of overdueCharges) {
      const monthsLate = Math.max(1, dayjs().diff(dayjs(charge.dueDate), 'month') + 1);
      const penalty = Math.round(charge.amount * (penaltyPercent / 100) * 100) / 100;
      const interest = Math.round(charge.amount * (interestPercent / 100) * monthsLate * 100) / 100;

      if (
        charge.penalty === penalty &&
        charge.interest === interest &&
        charge.status === 'OVERDUE'
      ) {
        continue;
      }

      await this.repository.update(ctx.scope, charge.id, {
        penalty,
        interest,
        status: 'OVERDUE',
      } as DeepPartial<Charge>);
      updated += 1;
    }

    return { updated };
  }

  private totalDue(charge: Charge): number {
    return (
      Math.round((charge.amount + charge.interest + charge.penalty - charge.discount) * 100) / 100
    );
  }

  private resolveAmount(
    dto: GenerateChargesDTO,
    monthlyFee: number,
    idealFraction: number | null | undefined,
    fractionTotal: number,
  ): number {
    if (dto.fixedAmount !== undefined) return dto.fixedAmount;
    if (dto.totalToApportion !== undefined) {
      const share = (idealFraction ?? 0) / fractionTotal;
      return Math.round(dto.totalToApportion * share * 100) / 100;
    }
    return monthlyFee;
  }

  /** Cobrancas da unidade do proprio morador (portal do condomino). */
  async myCharges(ctx: RequestContext): Promise<Charge[]> {
    if (!ctx.actor.unitId) throw new NotFoundError('Unidade vinculada ao usuario');
    return this.charges.findAllBy(ctx.scope, { unitId: ctx.actor.unitId }, 100);
  }
}

export const chargeService = new ChargeService();
