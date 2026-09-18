import type { DeepPartial } from 'typeorm';
import {
  serviceProviderRepository,
  type ServiceProviderRepository,
} from '@/modules/service-providers/service-provider.repository';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { assertReferenceExists } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { addByRecurrence, dayjs, isOverdue } from '@/shared/utils/date.util';
import { assertMonthOpen } from '../closing-guard';
import { Expense, type ExpenseStatus } from '../entities/expense.entity';
import { expenseRepository, type ExpenseRepository } from '../repositories/expense.repository';
import type {
  CreateExpenseDTO,
  PayExpenseDTO,
  UpdateExpenseDTO,
} from '../schemas/financial.schema';

export class ExpenseService extends CondominiumScopedService<
  Expense,
  CreateExpenseDTO,
  UpdateExpenseDTO
> {
  constructor(
    private readonly expenses: ExpenseRepository = expenseRepository,
    private readonly providers: ServiceProviderRepository = serviceProviderRepository,
  ) {
    super(expenses, { resource: 'expense', label: 'Despesa' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateExpenseDTO,
  ): Promise<DeepPartial<Expense>> {
    await this.assertReferences(ctx, dto.categoryId ?? null, dto.serviceProviderId ?? null);

    const status = dto.status === 'PENDING' && isOverdue(dto.dueDate) ? 'OVERDUE' : dto.status;
    this.assertPaidHasDate(status, dto.paidAt ?? null);

    if (status === 'PAID') {
      await assertMonthOpen(ctx.scope, dto.condominiumId, dto.paidAt);
    }

    return { ...dto, status } as DeepPartial<Expense>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Expense,
    dto: UpdateExpenseDTO,
  ): Promise<DeepPartial<Expense>> {
    // A guarda de mes fechado vem antes da regra de valor: nada de um mes
    // fechado pode mudar, e a recusa precisa dizer isso em vez de falar sobre
    // outra regra que tambem se aplicaria.
    if (current.status === 'PAID') {
      await assertMonthOpen(ctx.scope, current.condominiumId, current.paidAt);
    }
    const nextPaidAt = dto.paidAt !== undefined ? dto.paidAt : (current.paidAt ?? null);
    const nextStatus = dto.status ?? current.status;
    if (nextStatus === 'PAID') {
      await assertMonthOpen(ctx.scope, current.condominiumId, nextPaidAt);
    }

    if (current.status === 'PAID' && dto.amount !== undefined && dto.amount !== current.amount) {
      throw new BusinessRuleError('Despesas pagas nao podem ter o valor alterado.');
    }

    this.assertPaidHasDate(nextStatus, nextPaidAt);

    await this.assertReferences(ctx, dto.categoryId ?? null, dto.serviceProviderId ?? null);
    return dto as DeepPartial<Expense>;
  }

  /**
   * Excluir uma despesa paga muda o total de um mes que pode estar fechado. O
   * hook existe; aqui ele so ganha mais uma guarda.
   */
  protected override async beforeRemove(ctx: RequestContext, entity: Expense): Promise<void> {
    if (entity.status === 'PAID') {
      await assertMonthOpen(ctx.scope, entity.condominiumId, entity.paidAt);
    }
  }

  /**
   * `BaseCrudService.restore` **nao tem hook** e restaura antes de ler a linha,
   * entao a unica forma de guardar este caminho e sobrescrever e ler a removida
   * primeiro — `query(scope, true)` inclui excluidas. Sem isto, devolver uma
   * despesa paga a um mes fechado passaria sem recusa (ADR-003).
   */
  override async restore(ctx: RequestContext, id: string): Promise<Expense> {
    const current = await this.expenses
      .query(ctx.scope, true)
      .andWhere('expense.id = :id', { id })
      .getOne();

    if (current?.status === 'PAID') {
      await assertMonthOpen(ctx.scope, current.condominiumId, current.paidAt);
    }

    return super.restore(ctx, id);
  }

  /**
   * Uma despesa `PAID` sem `paidAt` nao pertence a mes nenhum: o balancete e de
   * caixa e soma pela data do pagamento, entao esse dinheiro sai do condominio e
   * nao aparece em competencia alguma — sem erro, sem aviso, sem lugar onde
   * procurar.
   *
   * A verificacao olha o estado **resultante**, e nao o corpo enviado. Marcar
   * `PAID` numa linha que ja tem data passa; limpar a data de uma linha ja paga
   * nao passa. Olhar so o payload deixaria a segunda entrar.
   */
  private assertPaidHasDate(status: ExpenseStatus, paidAt: Date | null): void {
    if (status === 'PAID' && !paidAt) {
      throw new BusinessRuleError('Uma despesa paga precisa da data de pagamento.');
    }
  }

  /**
   * Quita a despesa e, quando recorrente, ja programa a competencia seguinte —
   * evita que contas fixas (agua, energia, contratos) sejam esquecidas.
   */
  async pay(ctx: RequestContext, id: string, dto: PayExpenseDTO): Promise<Expense> {
    const expense = await this.findById(ctx, id);

    if (expense.status === 'PAID') throw new BusinessRuleError('Despesa ja esta paga.');
    if (expense.status === 'CANCELED') throw new BusinessRuleError('Despesa cancelada.');

    const paid = await this.update(ctx, id, {
      status: 'PAID',
      paidAt: dto.paidAt,
      paymentMethod: dto.paymentMethod,
      documentUrl: dto.documentUrl ?? expense.documentUrl,
      notes: dto.notes ?? expense.notes,
    } as UpdateExpenseDTO);

    if (expense.isRecurring) await this.scheduleNextOccurrence(ctx, expense);

    return paid;
  }

  async summary(ctx: RequestContext, condominiumId: string, competence?: string) {
    const totals = await this.expenses.totals(ctx.scope, condominiumId, competence);
    const byCategory = await this.expenses.byCategory(ctx.scope, condominiumId, competence);

    return {
      ...totals,
      byCategory: byCategory.map((row) => ({
        categoryId: row.categoryId,
        total: Number(row.total),
      })),
    };
  }

  private async scheduleNextOccurrence(ctx: RequestContext, expense: Expense): Promise<void> {
    const nextDueDate = addByRecurrence(expense.dueDate, 'MONTHLY');
    if (!nextDueDate) return;

    const nextCompetence = dayjs(expense.competence + '-01')
      .add(1, 'month')
      .format('YYYY-MM');

    const alreadyScheduled = await this.expenses.exists(ctx.scope, {
      condominiumId: expense.condominiumId,
      description: expense.description,
      competence: nextCompetence,
    } as never);
    if (alreadyScheduled) return;

    await this.repository.create(ctx.scope, {
      condominiumId: expense.condominiumId,
      categoryId: expense.categoryId,
      serviceProviderId: expense.serviceProviderId,
      description: expense.description,
      competence: nextCompetence,
      dueDate: nextDueDate,
      amount: expense.amount,
      status: 'PENDING',
      isRecurring: true,
      notes: expense.notes,
    } as DeepPartial<Expense>);
  }

  private async assertReferences(
    ctx: RequestContext,
    categoryId: string | null,
    serviceProviderId: string | null,
  ): Promise<void> {
    if (categoryId) {
      await assertReferenceExists(ctx.scope, 'financial_categories', categoryId);
    }
    if (serviceProviderId) {
      const provider = await this.providers.findById(ctx.scope, serviceProviderId);
      if (!provider) throw new BusinessRuleError('Prestador de servico nao encontrado.');
      if (provider.status === 'BLOCKED') {
        throw new BusinessRuleError('Prestador bloqueado nao pode receber novas despesas.');
      }
    }
  }
}

export const expenseService = new ExpenseService();
