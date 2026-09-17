import { auditService, type AuditService } from '@/modules/audit/audit.service';
import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors';
import type { RequestContext } from '@/shared/services/request-context';
import type { Paginated, QueryOptions } from '@/shared/types/pagination';
import { isValidCnpj } from '@/shared/utils/document.util';
import { Tenant } from './tenant.entity';
import { tenantRepository, type TenantRepository } from './tenant.repository';
import type { CreateTenantDTO, UpdateLgpdSettingsDTO, UpdateTenantDTO } from './tenant.schema';

/**
 * Administracao das contas da plataforma. Operacoes que atravessam tenants sao
 * restritas ao SUPER_ADMIN; um administrador comum so enxerga o proprio tenant.
 */
export class TenantService {
  constructor(
    private readonly tenants: TenantRepository = tenantRepository,
    private readonly audit: AuditService = auditService,
  ) {}

  async list(ctx: RequestContext, options: QueryOptions): Promise<Paginated<Tenant>> {
    this.assertPlatformOperator(ctx);
    return this.tenants.findMany(options);
  }

  async findById(ctx: RequestContext, id: string): Promise<Tenant> {
    if (!ctx.scope.superAdmin && id !== ctx.scope.tenantId) {
      throw new ForbiddenError('Voce so pode consultar a propria administradora.');
    }
    const tenant = await this.tenants.findById(id);
    if (!tenant) throw new NotFoundError('Administradora');
    return tenant;
  }

  async current(ctx: RequestContext): Promise<Tenant> {
    return this.findById(ctx, ctx.scope.tenantId);
  }

  async create(ctx: RequestContext, dto: CreateTenantDTO): Promise<Tenant> {
    this.assertPlatformOperator(ctx);
    await this.assertUnique(dto.slug, dto.document ?? null);

    const tenant = await this.tenants.create({
      ...dto,
      document: dto.document ?? null,
      settings: { timezone: 'America/Sao_Paulo', locale: 'pt-BR', ...(dto.settings ?? {}) },
    });

    await this.audit.record({
      tenantId: tenant.id,
      action: 'CREATE',
      resource: 'tenant',
      resourceId: tenant.id,
      description: `Administradora ${tenant.name} criada.`,
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return tenant;
  }

  async update(ctx: RequestContext, id: string, dto: UpdateTenantDTO): Promise<Tenant> {
    const current = await this.findById(ctx, id);

    // Limites de plano e status sao comerciais: so a plataforma altera.
    if (!ctx.scope.superAdmin) {
      const restricted: Array<keyof UpdateTenantDTO> = [
        'plan',
        'status',
        'maxCondominiums',
        'maxUsers',
        'slug',
      ];
      const attempted = restricted.filter((field) => dto[field] !== undefined);
      if (attempted.length) {
        throw new ForbiddenError(
          `Os campos ${attempted.join(', ')} so podem ser alterados pelo suporte da plataforma.`,
        );
      }
    }

    if (dto.slug && dto.slug !== current.slug) await this.assertUnique(dto.slug, null);
    if (dto.document && dto.document !== current.document) {
      await this.assertUnique(null, dto.document);
    }

    const updated = await this.tenants.update(id, {
      ...dto,
      settings: dto.settings ? { ...(current.settings ?? {}), ...dto.settings } : current.settings,
    });
    if (!updated) throw new NotFoundError('Administradora');

    await this.audit.record({
      tenantId: id,
      action: 'UPDATE',
      resource: 'tenant',
      resourceId: id,
      description: 'Dados da administradora atualizados.',
      before: { name: current.name, plan: current.plan, status: current.status },
      after: { name: updated.name, plan: updated.plan, status: updated.status },
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return updated;
  }

  async updateLgpdSettings(
    ctx: RequestContext,
    id: string,
    dto: UpdateLgpdSettingsDTO,
  ): Promise<Tenant> {
    const current = await this.findById(ctx, id);

    const updated = await this.tenants.update(id, {
      settings: {
        ...(current.settings ?? {}),
        lgpd: { ...(current.settings?.lgpd ?? {}), ...dto },
      },
    });
    if (!updated) throw new NotFoundError('Administradora');

    await this.audit.record({
      tenantId: id,
      action: 'UPDATE',
      resource: 'tenant',
      resourceId: id,
      description: 'Configuracoes de LGPD da administradora atualizadas.',
      before: { lgpd: current.settings?.lgpd ?? null },
      after: { lgpd: updated.settings?.lgpd ?? null },
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return updated;
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    this.assertPlatformOperator(ctx);

    const tenant = await this.tenants.findById(id);
    if (!tenant) throw new NotFoundError('Administradora');

    await this.tenants.softDelete(id);
    await this.audit.record({
      tenantId: id,
      action: 'DELETE',
      resource: 'tenant',
      resourceId: id,
      description: `Administradora ${tenant.name} desativada.`,
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  private assertPlatformOperator(ctx: RequestContext): void {
    if (!ctx.scope.superAdmin) {
      throw new ForbiddenError('Recurso restrito a operadores da plataforma.');
    }
  }

  private async assertUnique(slug: string | null, document: string | null): Promise<void> {
    if (slug && (await this.tenants.findBySlug(slug))) {
      throw new ConflictError('Ja existe uma administradora com este identificador.');
    }
    if (document) {
      if (!isValidCnpj(document)) throw new ConflictError('CNPJ invalido.');
      if (await this.tenants.findByDocument(document)) {
        throw new ConflictError('Ja existe uma administradora com este CNPJ.');
      }
    }
  }
}

export const tenantService = new TenantService();
