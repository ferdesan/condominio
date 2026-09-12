import type { DeepPartial } from 'typeorm';
import { authContextService, type AuthContextService } from '@/modules/auth/auth-context.service';
import { PERMISSION_CATALOG, WILDCARD_PERMISSION } from '@/shared/constants/permissions';
import { BusinessRuleError, ConflictError } from '@/shared/errors';
import { BaseCrudService } from '@/shared/services/base-crud.service';
import type { RequestContext } from '@/shared/services/request-context';
import { Role } from './role.entity';
import { roleRepository, type RoleRepository } from './role.repository';
import type { CreateRoleDTO, UpdateRoleDTO } from './role.schema';

export class RoleService extends BaseCrudService<Role, CreateRoleDTO, UpdateRoleDTO> {
  constructor(
    private readonly roles: RoleRepository = roleRepository,
    private readonly contexts: AuthContextService = authContextService,
  ) {
    super(roles, { resource: 'role', label: 'Papel de acesso' });
  }

  protected override async beforeCreate(
    ctx: RequestContext,
    dto: CreateRoleDTO,
  ): Promise<DeepPartial<Role>> {
    const name = dto.name.trim().toUpperCase();
    if (await this.roles.nameTaken(ctx.scope, name)) {
      throw new ConflictError('Ja existe um papel com este nome.');
    }
    this.assertPermissions(ctx, dto.permissions);

    return { ...dto, name, isSystem: false } as DeepPartial<Role>;
  }

  protected override async beforeUpdate(
    ctx: RequestContext,
    current: Role,
    dto: UpdateRoleDTO,
  ): Promise<DeepPartial<Role>> {
    if (current.isSystem && dto.permissions) {
      throw new BusinessRuleError(
        'Papeis do sistema nao podem ter as permissoes alteradas. Crie um papel personalizado.',
      );
    }
    if (dto.name && dto.name.trim().toUpperCase() !== current.name) {
      if (current.isSystem) throw new BusinessRuleError('Papeis do sistema nao podem ser renomeados.');
      if (await this.roles.nameTaken(ctx.scope, dto.name.trim().toUpperCase(), current.id)) {
        throw new ConflictError('Ja existe um papel com este nome.');
      }
    }
    if (dto.permissions) this.assertPermissions(ctx, dto.permissions);

    return {
      ...dto,
      ...(dto.name ? { name: dto.name.trim().toUpperCase() } : {}),
    } as DeepPartial<Role>;
  }

  protected override async afterUpdate(ctx: RequestContext): Promise<void> {
    // Permissoes mudaram: descarta o cache de autorizacao de todo o tenant.
    await this.contexts.invalidateTenant(ctx.scope.tenantId);
  }

  protected override async beforeRemove(ctx: RequestContext, entity: Role): Promise<void> {
    if (entity.isSystem) {
      throw new BusinessRuleError('Papeis do sistema nao podem ser removidos.');
    }
    const users = await this.roles.countUsers(ctx.scope.tenantId, entity.id);
    if (users > 0) {
      throw new BusinessRuleError(
        `Existem ${users} usuario(s) com este papel. Reatribua-os antes de remover.`,
      );
    }
  }

  /** Catalogo exposto ao frontend para montar a matriz de permissoes. */
  catalog(): { permissions: string[] } {
    return { permissions: [WILDCARD_PERMISSION, ...PERMISSION_CATALOG] };
  }

  /** Um tenant comum nunca pode conceder o curinga global. */
  private assertPermissions(ctx: RequestContext, permissions: string[]): void {
    if (permissions.includes(WILDCARD_PERMISSION) && !ctx.scope.superAdmin) {
      throw new BusinessRuleError('A permissao total (*) e exclusiva de operadores da plataforma.');
    }
  }
}

export const roleService = new RoleService();
