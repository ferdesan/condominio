import type { DeepPartial } from 'typeorm';
import {
  notificationService,
  type NotificationService,
} from '@/modules/notifications/notification.service';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { recipientsService, type RecipientsService } from '@/shared/services/recipients.service';
import type { RequestContext } from '@/shared/services/request-context';
import { dayjs } from '@/shared/utils/date.util';
import { Assembly } from '../entities/assembly.entity';
import { assemblyRepository, type AssemblyRepository } from '../repositories/assembly.repository';
import type {
  CreateAssemblyDTO,
  FinishAssemblyDTO,
  UpdateAssemblyDTO,
} from '../schemas/assembly.schema';

export class AssemblyService extends CondominiumScopedService<
  Assembly,
  CreateAssemblyDTO,
  UpdateAssemblyDTO
> {
  constructor(
    private readonly assemblies: AssemblyRepository = assemblyRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
  ) {
    super(assemblies, { resource: 'assembly', label: 'Assembleia' });
  }

  protected override async prepareCreate(
    _ctx: RequestContext,
    dto: CreateAssemblyDTO,
  ): Promise<DeepPartial<Assembly>> {
    this.assertSchedule(dto.scheduledAt, dto.secondCallAt ?? null);
    return dto as DeepPartial<Assembly>;
  }

  protected override async prepareUpdate(
    _ctx: RequestContext,
    current: Assembly,
    dto: UpdateAssemblyDTO,
  ): Promise<DeepPartial<Assembly>> {
    if (current.status === 'FINISHED') {
      throw new BusinessRuleError('Assembleias encerradas nao podem ser alteradas.');
    }
    this.assertSchedule(
      dto.scheduledAt ?? current.scheduledAt,
      dto.secondCallAt ?? current.secondCallAt ?? null,
    );
    return dto as DeepPartial<Assembly>;
  }

  /** Convocacao: notifica todos os usuarios com acesso ao condominio. */
  protected override async afterCreate(ctx: RequestContext, entity: Assembly): Promise<void> {
    const userIds = await this.recipients.usersOfCondominium(
      ctx.scope.tenantId,
      entity.condominiumId,
    );

    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: entity.condominiumId,
      userIds,
      title: `Convocacao: ${entity.title}`,
      message: `Assembleia ${entity.type === 'ORDINARY' ? 'ordinaria' : 'extraordinaria'} marcada para ${dayjs(entity.scheduledAt).format('DD/MM/YYYY HH:mm')}.`,
      type: 'ASSEMBLY',
      resource: 'assembly',
      resourceId: entity.id,
      actionUrl: `/assembleias/${entity.id}`,
    });
  }

  async start(ctx: RequestContext, id: string): Promise<Assembly> {
    const assembly = await this.findById(ctx, id);

    if (assembly.status !== 'SCHEDULED') {
      throw new BusinessRuleError('Somente assembleias agendadas podem ser iniciadas.');
    }

    return this.update(ctx, id, {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    } as UpdateAssemblyDTO);
  }

  async finish(ctx: RequestContext, id: string, dto: FinishAssemblyDTO): Promise<Assembly> {
    const assembly = await this.findById(ctx, id);

    if (assembly.status === 'FINISHED') {
      throw new BusinessRuleError('Assembleia ja foi encerrada.');
    }
    if (assembly.status === 'CANCELED') {
      throw new BusinessRuleError('Assembleia cancelada nao pode ser encerrada.');
    }

    return this.update(ctx, id, {
      status: 'FINISHED',
      finishedAt: new Date(),
      minutesUrl: dto.minutesUrl ?? assembly.minutesUrl,
      attendeesCount: dto.attendeesCount,
    } as UpdateAssemblyDTO);
  }

  async cancel(ctx: RequestContext, id: string): Promise<Assembly> {
    const assembly = await this.findById(ctx, id);
    if (assembly.status === 'FINISHED') {
      throw new BusinessRuleError('Assembleias encerradas nao podem ser canceladas.');
    }
    return this.update(ctx, id, { status: 'CANCELED' } as UpdateAssemblyDTO);
  }

  async upcoming(ctx: RequestContext, condominiumId?: string): Promise<Assembly[]> {
    return this.assemblies.listUpcoming(ctx.scope, condominiumId);
  }

  /** A segunda convocacao deve ocorrer apos a primeira, no mesmo dia ou depois. */
  private assertSchedule(scheduledAt: Date, secondCallAt: Date | null): void {
    if (secondCallAt && dayjs(secondCallAt).isBefore(dayjs(scheduledAt))) {
      throw new BusinessRuleError(
        'A segunda convocacao deve ser posterior ao horario da primeira.',
      );
    }
  }
}

export const assemblyService = new AssemblyService();
