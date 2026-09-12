import type { DeepPartial } from 'typeorm';
import {
  notificationService,
  type NotificationService,
} from '@/modules/notifications/notification.service';
import { realtimeService, type RealtimeService } from '@/realtime/realtime.service';
import { ROLE_ADMIN, ROLE_SINDICO } from '@/shared/constants/roles';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { recipientsService, type RecipientsService } from '@/shared/services/recipients.service';
import { assertReferenceExists } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { Incident, type IncidentStatus } from './incident.entity';
import { incidentRepository, type IncidentRepository } from './incident.repository';
import type {
  AssignIncidentDTO,
  ChangeIncidentStatusDTO,
  CreateIncidentDTO,
  UpdateIncidentDTO,
} from './incident.schema';

/** Transicoes validas do fluxo de atendimento da ocorrencia. */
const STATUS_FLOW: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['IN_ANALYSIS', 'IN_PROGRESS', 'REJECTED', 'RESOLVED'],
  IN_ANALYSIS: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

export class IncidentService extends CondominiumScopedService<
  Incident,
  CreateIncidentDTO,
  UpdateIncidentDTO
> {
  constructor(
    private readonly incidents: IncidentRepository = incidentRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
  ) {
    super(incidents, { resource: 'incident', label: 'Ocorrencia' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreateIncidentDTO,
  ): Promise<DeepPartial<Incident>> {
    const protocol = await this.nextProtocol(ctx);

    return {
      ...dto,
      protocol,
      status: 'OPEN',
      reportedById: ctx.actor.userId,
      // Ocorrencia anonima nao registra o nome do autor, apenas o vinculo interno.
      reportedByName: dto.isAnonymous ? null : ctx.actor.name,
      occurredAt: dto.occurredAt ?? new Date(),
    } as DeepPartial<Incident>;
  }

  protected override async prepareUpdate(
    ctx: RequestContext,
    current: Incident,
    dto: UpdateIncidentDTO,
  ): Promise<DeepPartial<Incident>> {
    if (current.status === 'CLOSED') {
      throw new BusinessRuleError('Ocorrencias encerradas nao podem ser alteradas.');
    }
    if (dto.status && dto.status !== current.status) {
      this.assertTransition(current.status, dto.status);
    }
    if (dto.assignedToId) {
      await assertReferenceExists(ctx.scope, 'users', dto.assignedToId);
    }
    return dto as DeepPartial<Incident>;
  }

  protected override async afterCreate(ctx: RequestContext, entity: Incident): Promise<void> {
    const managers = await this.recipients.usersByRoles(ctx.scope.tenantId, [
      ROLE_ADMIN,
      ROLE_SINDICO,
    ]);

    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: entity.condominiumId,
      userIds: managers,
      title: `Nova ocorrencia ${entity.protocol}`,
      message: `${entity.title} (prioridade ${entity.priority}).`,
      type: 'INCIDENT',
      resource: 'incident',
      resourceId: entity.id,
      actionUrl: `/ocorrencias/${entity.id}`,
    });

    this.realtime.emitToCondominium(entity.condominiumId, 'incident:updated', {
      id: entity.id,
      status: entity.status,
      priority: entity.priority,
    });
  }

  async changeStatus(
    ctx: RequestContext,
    id: string,
    dto: ChangeIncidentStatusDTO,
  ): Promise<Incident> {
    const incident = await this.findById(ctx, id);
    this.assertTransition(incident.status, dto.status);

    const isFinal = dto.status === 'RESOLVED' || dto.status === 'REJECTED';
    if (isFinal && !dto.resolution && !incident.resolution) {
      throw new BusinessRuleError('Informe a tratativa antes de resolver ou recusar a ocorrencia.');
    }

    const updated = await this.update(ctx, id, {
      status: dto.status,
      resolution: dto.resolution ?? incident.resolution,
      resolvedAt: isFinal ? new Date() : incident.resolvedAt,
    } as UpdateIncidentDTO);

    if (incident.reportedById) {
      await this.notifications.notify({
        tenantId: ctx.scope.tenantId,
        condominiumId: incident.condominiumId,
        userIds: [incident.reportedById],
        title: `Ocorrencia ${incident.protocol} atualizada`,
        message: `Status alterado para ${dto.status}.`,
        type: 'INCIDENT',
        resource: 'incident',
        resourceId: incident.id,
        actionUrl: `/ocorrencias/${incident.id}`,
      });
    }

    this.realtime.emitToCondominium(incident.condominiumId, 'incident:updated', {
      id: incident.id,
      status: dto.status,
    });

    return updated;
  }

  async assign(ctx: RequestContext, id: string, dto: AssignIncidentDTO): Promise<Incident> {
    await assertReferenceExists(ctx.scope, 'users', dto.assignedToId);
    const incident = await this.findById(ctx, id);

    const updated = await this.update(ctx, id, {
      assignedToId: dto.assignedToId,
      status: incident.status === 'OPEN' ? 'IN_ANALYSIS' : incident.status,
    } as UpdateIncidentDTO);

    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: incident.condominiumId,
      userIds: [dto.assignedToId],
      title: `Ocorrencia ${incident.protocol} atribuida a voce`,
      message: incident.title,
      type: 'INCIDENT',
      resource: 'incident',
      resourceId: incident.id,
      actionUrl: `/ocorrencias/${incident.id}`,
    });

    return updated;
  }

  async statusSummary(ctx: RequestContext, condominiumId: string) {
    const rows = await this.incidents.countByStatus(ctx.scope, condominiumId);
    return rows.map((row) => ({ status: row.status, total: Number(row.total) }));
  }

  /**
   * Protocolo legivel e sequencial por ano (OC-2026-000123).
   * A colisao e improvavel mas tratada: o indice unico (tenant, protocol)
   * garante a consistencia sob concorrencia.
   */
  private async nextProtocol(ctx: RequestContext): Promise<string> {
    const year = new Date().getFullYear();
    const total = await this.incidents.countByYear(ctx.scope, year);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const candidate = `OC-${year}-${String(total + attempt).padStart(6, '0')}`;
      if (!(await this.incidents.protocolTaken(ctx.scope, candidate))) return candidate;
    }

    return `OC-${year}-${Date.now().toString().slice(-6)}`;
  }

  private assertTransition(from: IncidentStatus, to: IncidentStatus): void {
    if (from === to) return;
    if (!STATUS_FLOW[from].includes(to)) {
      throw new BusinessRuleError(`Transicao de status invalida: ${from} -> ${to}.`);
    }
  }
}

export const incidentService = new IncidentService();
