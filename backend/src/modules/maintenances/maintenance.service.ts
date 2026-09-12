import type { DeepPartial } from 'typeorm';
import {
  serviceProviderRepository,
  type ServiceProviderRepository,
} from '@/modules/service-providers/service-provider.repository';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { assertReferenceExists } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { addByRecurrence, dayjs } from '@/shared/utils/date.util';
import { Maintenance } from './maintenance.entity';
import { maintenanceRepository, type MaintenanceRepository } from './maintenance.repository';
import type {
  CompleteMaintenanceDTO,
  CreateMaintenanceDTO,
  UpdateMaintenanceDTO,
} from './maintenance.schema';

export class MaintenanceService extends CondominiumScopedService<
  Maintenance,
  CreateMaintenanceDTO,
  UpdateMaintenanceDTO
> {
  constructor(
    private readonly maintenances: MaintenanceRepository = maintenanceRepository,
    private readonly providers: ServiceProviderRepository = serviceProviderRepository,
  ) {
    super(maintenances, { resource: 'maintenance', label: 'Manutencao' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateMaintenanceDTO,
  ): Promise<DeepPartial<Maintenance>> {
    await this.assertReferences(ctx, dto.serviceProviderId ?? null, dto.responsibleId ?? null);

    return {
      ...dto,
      status: dayjs(dto.scheduledFor).isBefore(dayjs(), 'day') ? 'OVERDUE' : dto.status,
      nextExecutionAt: addByRecurrence(dto.scheduledFor, dto.recurrence),
    } as DeepPartial<Maintenance>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Maintenance,
    dto: UpdateMaintenanceDTO,
  ): Promise<DeepPartial<Maintenance>> {
    if (current.status === 'COMPLETED' && dto.status && dto.status !== 'COMPLETED') {
      throw new BusinessRuleError('Manutencoes concluidas nao podem voltar para outro status.');
    }
    await this.assertReferences(ctx, dto.serviceProviderId ?? null, dto.responsibleId ?? null);
    return dto as DeepPartial<Maintenance>;
  }

  async start(ctx: RequestContext, id: string): Promise<Maintenance> {
    const maintenance = await this.findById(ctx, id);

    if (maintenance.status === 'COMPLETED') {
      throw new BusinessRuleError('Manutencao ja concluida.');
    }
    if (maintenance.status === 'CANCELED') {
      throw new BusinessRuleError('Manutencao cancelada.');
    }

    return this.update(ctx, id, {
      status: 'IN_PROGRESS',
      startedAt: maintenance.startedAt ?? new Date(),
    } as UpdateMaintenanceDTO);
  }

  /**
   * Conclui a ordem e, quando recorrente, ja abre a proxima na data calculada —
   * preventivas obrigatorias (elevador, extintores, para-raios) nao podem
   * depender de alguem lembrar de reagendar.
   */
  async complete(
    ctx: RequestContext,
    id: string,
    dto: CompleteMaintenanceDTO,
  ): Promise<{ maintenance: Maintenance; nextId: string | null }> {
    const maintenance = await this.findById(ctx, id);

    if (maintenance.status === 'COMPLETED') {
      throw new BusinessRuleError('Manutencao ja foi concluida.');
    }
    if (maintenance.status === 'CANCELED') {
      throw new BusinessRuleError('Manutencao cancelada nao pode ser concluida.');
    }

    const completedAt = dto.completedAt ?? new Date();
    const completed = await this.update(ctx, id, {
      status: 'COMPLETED',
      completedAt,
      finalCost: dto.finalCost ?? maintenance.estimatedCost,
      notes: dto.notes ?? maintenance.notes,
    } as UpdateMaintenanceDTO);

    let nextId: string | null = null;
    if (dto.scheduleNext && maintenance.recurrence !== 'NONE') {
      const nextDate = addByRecurrence(completedAt, maintenance.recurrence);
      if (nextDate) {
        const next = await this.repository.create(ctx.scope, {
          condominiumId: maintenance.condominiumId,
          title: maintenance.title,
          description: maintenance.description,
          type: maintenance.type,
          status: 'SCHEDULED',
          recurrence: maintenance.recurrence,
          assetName: maintenance.assetName,
          serviceProviderId: maintenance.serviceProviderId,
          responsibleId: maintenance.responsibleId,
          scheduledFor: dayjs(nextDate).toDate(),
          estimatedCost: maintenance.finalCost ?? maintenance.estimatedCost,
          nextExecutionAt: addByRecurrence(nextDate, maintenance.recurrence),
        } as DeepPartial<Maintenance>);
        nextId = next.id;
      }
    }

    return { maintenance: completed, nextId };
  }

  async cancel(ctx: RequestContext, id: string): Promise<Maintenance> {
    const maintenance = await this.findById(ctx, id);
    if (maintenance.status === 'COMPLETED') {
      throw new BusinessRuleError('Manutencoes concluidas nao podem ser canceladas.');
    }
    return this.update(ctx, id, { status: 'CANCELED' } as UpdateMaintenanceDTO);
  }

  async upcoming(ctx: RequestContext, condominiumId?: string): Promise<Maintenance[]> {
    return this.maintenances.listUpcoming(ctx.scope, condominiumId);
  }

  private async assertReferences(
    ctx: RequestContext,
    serviceProviderId: string | null,
    responsibleId: string | null,
  ): Promise<void> {
    if (serviceProviderId) {
      const provider = await this.providers.findById(ctx.scope, serviceProviderId);
      if (!provider) throw new BusinessRuleError('Prestador de servico nao encontrado.');
    }
    if (responsibleId) {
      await assertReferenceExists(ctx.scope, 'users', responsibleId);
    }
  }
}

export const maintenanceService = new MaintenanceService();
