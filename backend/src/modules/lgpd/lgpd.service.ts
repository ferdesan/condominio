import type { QueryOptions } from '@/shared/types/pagination';
import { AppDataSource } from '@/config/data-source';
import { auditService, type AuditInput } from '@/modules/audit/audit.service';
import type { AuditAction } from '@/modules/audit/audit-log.entity';
import { correspondenceRepository } from '@/modules/correspondences/correspondence.repository';
import { dependentRepository } from '@/modules/dependents/dependent.repository';
import { documentRepository } from '@/modules/documents/document.repository';
import { chargeRepository } from '@/modules/financial/repositories/charge.repository';
import { paymentRepository } from '@/modules/financial/repositories/payment.repository';
import { lgpdConsentRepository } from './lgpd-consent.repository';
import { LgpdConsent, type LgpdConsentType } from './lgpd-consent.entity';
import { lgpdRequestRepository } from './lgpd-request.repository';
import { LgpdRequest } from './lgpd-request.entity';
import { reservationRepository } from '@/modules/reservations/reservation.repository';
import { residentRepository } from '@/modules/residents/resident.repository';
import { Resident } from '@/modules/residents/resident.entity';
import { vehicleRepository } from '@/modules/vehicles/vehicle.repository';
import { ConflictError, ForbiddenError, NotFoundError, AppError } from '@/shared/errors';
import { hasPermission, permission } from '@/shared/constants/permissions';
import type { RequestContext } from '@/shared/services/request-context';
import type { TenantScope } from '@/shared/repositories/types';
import {
  ANONYMIZED_LABEL,
  anonymizePersonalData,
  isAnonymizedName,
  type AnonymizeResult,
} from './anonymize';
import type { CreateDeleteRequestDTO, LgpdExportPayload, UpdateConsentDTO } from './lgpd.schema';

const ACTIVE_CHARGE_STATUSES = ['PENDING', 'PARTIAL', 'OVERDUE'];
const UPCOMING_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED'];

export class LgpdDuplicateRequestError extends AppError {
  constructor(message = 'Ja existe um pedido de cancelamento de contas pendente.') {
    super(message, 409, 'LGPD_DUPLICATE_REQUEST');
  }
}

export class LgpdExecuteConflictError extends AppError {
  constructor(message = 'Execucao do pedido ja esta em andamento ou foi concluida.') {
    super(message, 409, 'LGPD_EXECUTE_CONFLICT');
  }
}

export type CreateDeleteRequestResult = {
  id: string;
  status: 'PENDING';
  requestedAt: Date;
  requestedBy: string;
  residentId: string;
  residentName: string;
  condominiumId: string;
  notes?: string | null;
  warnings: string[];
};

export type ExecuteDeleteResult = {
  id: string;
  status: 'EXECUTED';
  executedAt: Date;
} & AnonymizeResult;

export type ConsentView = {
  residentId: string;
  consentType: string;
  granted: boolean;
  grantedAt?: Date | null;
  revokedAt?: Date | null;
  description?: string | null;
  warnings: string[];
};

export class LgpdService {
  private executionLocks = new Map<string, boolean>();

  private audit(
    ctx: RequestContext,
    action: AuditAction,
    resource: string,
    resourceId?: string | null,
    description?: string | null,
    before?: Record<string, unknown> | null,
    after?: Record<string, unknown> | null,
  ): AuditInput {
    return {
      tenantId: ctx.scope.tenantId,
      action,
      resource,
      resourceId: resourceId ?? null,
      description,
      before,
      after,
      actor: { userId: ctx.actor.userId, name: ctx.actor.name },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    };
  }

  private assertCondominium(scope: TenantScope, condominiumId: string): void {
    if (scope.condominiumIds?.length && !scope.condominiumIds.includes(condominiumId)) {
      throw new ForbiddenError('Acesso negado para este condominio.');
    }
  }

  private async findMyResident(ctx: RequestContext): Promise<Resident> {
    const resident = await residentRepository.findOneBy(ctx.scope, { userId: ctx.actor.userId });
    if (!resident) throw new NotFoundError('Morador');
    return resident;
  }

  private hasTerminatingPower(ctx: RequestContext): boolean {
    return hasPermission(ctx.actor.permissions, permission('lgpd-request', 'manage'));
  }

  /** Bloqueia novos pedidos quando algum dependente ja foi anonimizado (EC-6). */
  private async assertNoProcessedDependents(scope: TenantScope, resident: Resident): Promise<void> {
    const dependents = await dependentRepository.findAllBy(scope, { residentId: resident.id });
    const processed = dependents.filter((dependent) => isAnonymizedName(dependent.name));
    if (processed.length > 0) {
      throw new AppError(
        'Um dependente ja foi anonimizado; faca contato com o sindico.',
        409,
        'LGPD_DEPENDENT_PROCESSED',
      );
    }
  }

  private async collectWarnings(scope: TenantScope, resident: Resident): Promise<string[]> {
    const warnings: string[] = [];

    const charges = await chargeRepository.findAllBy(scope, { unitId: resident.unitId });
    const activeCharges = charges.filter((charge) =>
      ACTIVE_CHARGE_STATUSES.includes(charge.status),
    ).length;
    if (activeCharges > 0) {
      warnings.push(`${activeCharges} cobrança(s) em aberto serão mantidas após a anonimização.`);
    }

    const reservations = await reservationRepository.findAllBy(scope, { unitId: resident.unitId });
    const upcoming = reservations.filter((reservation) =>
      UPCOMING_RESERVATION_STATUSES.includes(reservation.status),
    ).length;
    if (upcoming > 0) {
      warnings.push(`${upcoming} reserva(s) futura(s) serão mantidas após a anonimização.`);
    }

    return warnings;
  }

  private toRequestView(request: LgpdRequest) {
    return {
      id: request.id,
      residentId: request.residentId,
      residentName:
        request.resident && !isAnonymizedName(request.resident.name)
          ? request.resident.name
          : ANONYMIZED_LABEL,
      condominiumId: request.condominiumId,
      status: request.status,
      requestedAt: request.requestedAt,
      executedAt: request.executedAt ?? null,
      cancelledAt: request.cancelledAt ?? null,
      notes: request.notes ?? null,
    };
  }

  private async recordConsent(
    ctx: RequestContext,
    resident: Resident,
    granted: boolean,
    consentType: LgpdConsentType = 'DATA_PROCESSING',
    description?: string | null,
  ): Promise<LgpdConsent> {
    const existing = await lgpdConsentRepository.findOneBy(ctx.scope, {
      residentId: resident.id,
      consentType,
    });
    const now = new Date();
    let consent: LgpdConsent;
    if (existing) {
      consent = (await lgpdConsentRepository.update(ctx.scope, existing.id, {
        granted,
        grantedAt: granted ? now : existing.grantedAt,
        revokedAt: granted ? null : now,
        description: description ?? existing.description,
        ipAddress: ctx.ipAddress ?? existing.ipAddress,
      })) as LgpdConsent;
    } else {
      consent = await lgpdConsentRepository.create(ctx.scope, {
        residentId: resident.id,
        consentType,
        granted,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
        description: description ?? null,
        ipAddress: ctx.ipAddress ?? null,
      });
    }
    if (granted) {
      await residentRepository.update(ctx.scope, resident.id, { lgpdConsentAt: now });
    }
    return consent;
  }

  private async recordConsentAudit(ctx: RequestContext, resident: Resident, granted: boolean) {
    const action: AuditAction = granted ? 'LGPD_CONSENT_GRANTED' : 'LGPD_CONSENT_REVOKED';
    await auditService.record(
      this.audit(
        ctx,
        action,
        'lgpd-consent',
        resident.id,
        `Consentimento ${granted ? 'registrado' : 'revogado'}`,
      ),
    );
  }

  async createDeleteRequest(
    ctx: RequestContext,
    dto: CreateDeleteRequestDTO,
  ): Promise<CreateDeleteRequestResult> {
    const resident = await this.findMyResident(ctx);
    this.assertCondominium(ctx.scope, dto.condominiumId);
    if (resident.condominiumId !== dto.condominiumId) {
      throw new ForbiddenError('Morador so pode solicitar cancelamento para o proprio condominio.');
    }
    await this.assertNoProcessedDependents(ctx.scope, resident);

    const pending = await lgpdRequestRepository.countPendingByResident(ctx.scope, resident.id);
    if (pending > 0) throw new LgpdDuplicateRequestError();

    await this.recordConsent(ctx, resident, true);
    await this.recordConsentAudit(ctx, resident, true);

    const created = await lgpdRequestRepository.create(ctx.scope, {
      condominiumId: dto.condominiumId,
      residentId: resident.id,
      status: 'PENDING',
      requestedAt: new Date(),
      notes: dto.notes ?? null,
    });

    const warnings = await this.collectWarnings(ctx.scope, resident);

    await auditService.record(
      this.audit(
        ctx,
        'LGPD_DELETE_REQUEST',
        'lgpd-request',
        created.id,
        'Solicitacao de cancelamento de contas',
      ),
    );

    return {
      id: created.id,
      status: 'PENDING',
      requestedAt: created.requestedAt,
      requestedBy: ctx.actor.name,
      residentId: resident.id,
      residentName: resident.name,
      condominiumId: created.condominiumId,
      notes: created.notes ?? null,
      warnings,
    };
  }

  async listDeleteRequests(ctx: RequestContext, options: QueryOptions) {
    const result = await lgpdRequestRepository.findMany(ctx.scope, options);
    return { ...result, data: result.data.map((request) => this.toRequestView(request)) };
  }

  async getDeleteRequest(ctx: RequestContext, id: string) {
    const request = await lgpdRequestRepository.findById(ctx.scope, id);
    if (!request) throw new NotFoundError('Solicitacao LGPD');
    if (!this.hasTerminatingPower(ctx)) {
      const resident = await residentRepository.findOneBy(ctx.scope, { id: request.residentId });
      if (!resident || resident.userId !== ctx.actor.userId) {
        throw new ForbiddenError('Acesso negado a este pedido.');
      }
    }
    return this.toRequestView(request);
  }

  async executeDelete(ctx: RequestContext, id: string): Promise<ExecuteDeleteResult> {
    if (this.executionLocks.has(id)) throw new LgpdExecuteConflictError();

    const request = await lgpdRequestRepository.findById(ctx.scope, id);
    if (!request) throw new NotFoundError('Solicitacao LGPD');
    if (request.status === 'EXECUTED') throw new ConflictError('Solicitacao ja executada.');
    if (request.status === 'CANCELLED')
      throw new ConflictError('Solicitacao cancelada nao pode ser executada.');

    if (this.executionLocks.has(id)) throw new LgpdExecuteConflictError();

    this.executionLocks.set(id, true);
    try {
      const result = await anonymizePersonalData(ctx.scope, request.residentId);
      const executedAt = new Date();
      await lgpdRequestRepository.update(ctx.scope, id, { status: 'EXECUTED', executedAt });

      await auditService.record(
        this.audit(ctx, 'LGPD_DELETE', 'lgpd-request', id, 'Dados pessoais anonimizados'),
      );

      return { id, status: 'EXECUTED', executedAt, ...result };
    } finally {
      this.executionLocks.delete(id);
    }
  }

  async cancelDeleteRequest(ctx: RequestContext, id: string) {
    const request = await lgpdRequestRepository.findById(ctx.scope, id);
    if (!request) throw new NotFoundError('Solicitacao LGPD');

    if (!this.hasTerminatingPower(ctx)) {
      const resident = await residentRepository.findOneBy(ctx.scope, { id: request.residentId });
      if (!resident || resident.userId !== ctx.actor.userId) {
        throw new ForbiddenError('Apenas o morador solicitante ou um administrador pode cancelar.');
      }
    }

    if (request.status === 'EXECUTED')
      throw new ConflictError('Solicitacao ja executada nao pode ser cancelada.');
    if (request.status === 'CANCELLED') throw new ConflictError('Solicitacao ja cancelada.');

    const cancelledAt = new Date();
    const updated = await lgpdRequestRepository.update(ctx.scope, id, {
      status: 'CANCELLED',
      cancelledAt,
    });

    await auditService.record(
      this.audit(ctx, 'LGPD_DELETE_CANCEL', 'lgpd-request', id, 'Cancelamento da solicitacao'),
    );

    return this.toRequestView((updated as LgpdRequest) ?? request);
  }

  async getMyConsent(ctx: RequestContext, consentType: LgpdConsentType): Promise<ConsentView> {
    const resident = await this.findMyResident(ctx);
    const consent = await lgpdConsentRepository.findOneBy(ctx.scope, {
      residentId: resident.id,
      consentType,
    });
    const warnings = await this.collectWarnings(ctx.scope, resident);
    if (!consent) {
      const registeredAt = resident.lgpdConsentAt;
      return {
        residentId: resident.id,
        consentType,
        granted: Boolean(registeredAt),
        grantedAt: registeredAt ?? null,
        revokedAt: null,
        description: null,
        warnings,
      };
    }
    return {
      residentId: consent.residentId,
      consentType: consent.consentType,
      granted: consent.granted,
      grantedAt: consent.grantedAt ?? null,
      revokedAt: consent.revokedAt ?? null,
      description: consent.description ?? null,
      warnings,
    };
  }

  async updateConsent(ctx: RequestContext, dto: UpdateConsentDTO): Promise<ConsentView> {
    const resident = await this.findMyResident(ctx);
    const warnings = await this.collectWarnings(ctx.scope, resident);
    const consent = await this.recordConsent(
      ctx,
      resident,
      dto.granted,
      dto.consentType,
      dto.description,
    );
    await this.recordConsentAudit(ctx, resident, dto.granted);

    return {
      residentId: consent.residentId,
      consentType: consent.consentType,
      granted: consent.granted,
      grantedAt: consent.grantedAt ?? null,
      revokedAt: consent.revokedAt ?? null,
      description: consent.description ?? null,
      warnings,
    };
  }

  async exportResidentData(
    ctx: RequestContext,
    options: { residentId?: string } = {},
  ): Promise<LgpdExportPayload> {
    let resident: Resident;
    if (options.residentId) {
      resident = (await AppDataSource.getRepository(Resident).findOne({
        where: { id: options.residentId, tenantId: ctx.scope.tenantId },
      })) as Resident;
      if (!resident) throw new NotFoundError('Morador');
      this.assertCondominium(ctx.scope, resident.condominiumId);
    } else {
      resident = await this.findMyResident(ctx);
    }

    const payload = await this.buildExportPayload(ctx, resident);

    await auditService.record(
      this.audit(ctx, 'LGPD_EXPORT', 'resident', resident.id, 'Exportacao dos dados pessoais'),
    );

    return payload;
  }

  private toExportObject(entity: Record<string, unknown>): Record<string, unknown> {
    const { tenantId, deletedAt, createdAt, updatedAt, filePath, ...safe } = entity;
    void tenantId;
    void deletedAt;
    void createdAt;
    void updatedAt;
    void filePath;
    return safe;
  }

  private async reservationsFor(resident: Resident, scope: TenantScope) {
    const reservations = await reservationRepository.findAllBy(scope, { unitId: resident.unitId });
    return reservations.map((reservation) =>
      this.toExportObject(reservation as unknown as Record<string, unknown>),
    );
  }

  private async chargesFor(resident: Resident, scope: TenantScope) {
    const byUnit = await chargeRepository.findAllBy(scope, { unitId: resident.unitId });
    const byResident = await chargeRepository.findAllBy(scope, { residentId: resident.id });
    const merged = new Map<string, (typeof byUnit)[number]>();
    for (const charge of [...byUnit, ...byResident]) merged.set(charge.id, charge);

    const charges: Record<string, unknown>[] = [];
    const payments: Record<string, unknown>[] = [];
    for (const charge of merged.values()) {
      const chargePayments = await paymentRepository.findAllBy(scope, { chargeId: charge.id });
      payments.push(
        ...chargePayments.map((payment) =>
          this.toExportObject(payment as unknown as Record<string, unknown>),
        ),
      );
      charges.push({
        ...this.toExportObject(charge as unknown as Record<string, unknown>),
        payments: chargePayments.map((payment) =>
          this.toExportObject(payment as unknown as Record<string, unknown>),
        ),
      });
    }
    return { charges, payments };
  }

  private async buildExportPayload(
    ctx: RequestContext,
    resident: Resident,
  ): Promise<LgpdExportPayload> {
    const scope = ctx.scope;
    const now = new Date().toISOString();

    if (isAnonymizedName(resident.name)) {
      void scope;
      return {
        exportDate: now,
        platform: 'condominio',
        dataSubject: { name: ANONYMIZED_LABEL, email: null },
        resident: this.toExportObject(resident as unknown as Record<string, unknown>),
        dependents: [],
        vehicles: [],
        reservations: [],
        financial: { charges: [], payments: [] },
        correspondences: [],
        documents: [],
      };
    }

    const dependents = await dependentRepository.findAllBy(scope, { residentId: resident.id });
    const vehicles = await vehicleRepository.findAllBy(scope, { residentId: resident.id });
    const reservations = await this.reservationsFor(resident, scope);
    const financial = await this.chargesFor(resident, scope);
    const correspondences = await correspondenceRepository.findAllBy(scope, {
      unitId: resident.unitId,
    });
    const documents = await documentRepository.findAllBy(scope, {
      condominiumId: resident.condominiumId,
    });

    return {
      exportDate: now,
      platform: 'condominio',
      dataSubject: { name: resident.name, email: resident.email ?? null },
      resident: this.toExportObject(resident as unknown as Record<string, unknown>),
      dependents: dependents.map((dependent) =>
        this.toExportObject(dependent as unknown as Record<string, unknown>),
      ),
      vehicles: vehicles.map((vehicle) =>
        this.toExportObject(vehicle as unknown as Record<string, unknown>),
      ),
      reservations,
      financial,
      correspondences: correspondences.map((correspondence) =>
        this.toExportObject(correspondence as unknown as Record<string, unknown>),
      ),
      documents: documents.map((document) =>
        this.toExportObject(document as unknown as Record<string, unknown>),
      ),
    };
  }
}

export const lgpdService = new LgpdService();
