import type { DeepPartial } from 'typeorm';
import { authContextService, type AuthContextService } from '@/modules/auth/auth-context.service';
import { authRepository, type AuthRepository } from '@/modules/auth/auth.repository';
import { roleRepository, type RoleRepository } from '@/modules/roles/role.repository';
import { tenantRepository, type TenantRepository } from '@/modules/tenants/tenant.repository';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '@/shared/constants/roles';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { BaseCrudService } from '@/shared/services/base-crud.service';
import { assertCondominiumAccess } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { generateTemporaryPassword, hashPassword } from '@/shared/utils/password.util';
import { User } from './user.entity';
import { userRepository, type UserRepository } from './user.repository';
import type { AdminResetPasswordDTO, CreateUserDTO, UpdateUserDTO } from './user.schema';

export type CreatedUser = User & { temporaryPassword?: string };

export class UserService extends BaseCrudService<User, CreateUserDTO, UpdateUserDTO> {
  constructor(
    private readonly users: UserRepository = userRepository,
    private readonly roles: RoleRepository = roleRepository,
    private readonly tenants: TenantRepository = tenantRepository,
    private readonly auth: AuthRepository = authRepository,
    private readonly contexts: AuthContextService = authContextService,
  ) {
    super(users, { resource: 'user', label: 'Usuario' });
  }

  /**
   * Convite de usuario. Quando a senha nao e informada, gera uma temporaria
   * (retornada uma unica vez) e obriga a troca no primeiro acesso.
   */
  async invite(ctx: RequestContext, dto: CreateUserDTO): Promise<CreatedUser> {
    await this.assertUserLimit(ctx);
    await this.assertEmailAvailable(ctx, dto.email);
    await this.assertRole(ctx, dto.roleId);
    await this.assertCondominiums(ctx, dto.condominiumIds);

    const temporaryPassword = dto.password ?? generateTemporaryPassword();
    const user = await this.users.create(ctx.scope, {
      name: dto.name,
      email: dto.email,
      passwordHash: await hashPassword(temporaryPassword),
      phone: dto.phone ?? null,
      document: dto.document ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      status: dto.status,
      roleId: dto.roleId,
      unitId: dto.unitId ?? null,
      mustChangePassword: dto.mustChangePassword ?? !dto.password,
      preferences: { theme: 'system', locale: 'pt-BR', emailNotifications: true },
    } as DeepPartial<User>);

    if (dto.condominiumIds.length) {
      await this.users.setCondominiums(user.id, dto.condominiumIds);
    }

    await this.writeAudit(ctx, 'CREATE', user, null, {
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      status: user.status,
    });

    const result = (await this.findById(ctx, user.id)) as CreatedUser;
    if (!dto.password) result.temporaryPassword = temporaryPassword;
    return result;
  }

  override async create(ctx: RequestContext, dto: CreateUserDTO): Promise<User> {
    return this.invite(ctx, dto);
  }

  protected override async beforeUpdate(
    ctx: RequestContext,
    current: User,
    dto: UpdateUserDTO,
  ): Promise<DeepPartial<User>> {
    if (dto.email && dto.email !== current.email) {
      await this.assertEmailAvailable(ctx, dto.email, current.id);
    }
    if (dto.roleId && dto.roleId !== current.roleId) {
      await this.assertRole(ctx, dto.roleId);
      await this.assertNotLastAdmin(ctx, current);
    }
    if (dto.status && dto.status !== 'ACTIVE' && current.status === 'ACTIVE') {
      await this.assertNotLastAdmin(ctx, current);
      if (current.id === ctx.actor.userId) {
        throw new BusinessRuleError('Voce nao pode desativar o proprio usuario.');
      }
    }
    if (dto.condominiumIds) {
      await this.assertCondominiums(ctx, dto.condominiumIds);
    }

    const { condominiumIds: _ignored, ...rest } = dto;
    if (dto.roleId && dto.roleId !== current.roleId) {
      // A relacao `role` e eager: o findById do repositorio sempre carrega o
      // papel antigo, e o TypeORM le o valor da coluna `role_id` da relacao em
      // vez do escalar `roleId` — sem mandar a relacao nova junto, o diff de
      // colunas conclui "nada mudou" e o UPDATE sai sem `role_id`.
      return { ...rest, role: { id: dto.roleId } } as DeepPartial<User>;
    }
    return rest as DeepPartial<User>;
  }

  protected override async afterUpdate(
    ctx: RequestContext,
    entity: User,
    _previous: User,
    dto: UpdateUserDTO,
  ): Promise<void> {
    if (dto.condominiumIds) {
      await this.users.setCondominiums(entity.id, dto.condominiumIds);
    }
    // Sessoes ativas precisam enxergar o novo papel/escopo imediatamente.
    await this.contexts.invalidate(ctx.scope.tenantId, entity.id);
    if (dto.status && dto.status !== 'ACTIVE') {
      await this.auth.revokeAllForUser(entity.id);
    }
  }

  protected override async beforeRemove(ctx: RequestContext, entity: User): Promise<void> {
    if (entity.id === ctx.actor.userId) {
      throw new BusinessRuleError('Voce nao pode remover o proprio usuario.');
    }
    if (entity.role?.name === ROLE_SUPER_ADMIN && !ctx.scope.superAdmin) {
      throw new ForbiddenError('Apenas operadores da plataforma podem remover super administradores.');
    }
    await this.assertNotLastAdmin(ctx, entity);
  }

  protected override async afterRemove(ctx: RequestContext, entity: User): Promise<void> {
    await this.auth.revokeAllForUser(entity.id);
    await this.contexts.invalidate(ctx.scope.tenantId, entity.id);
  }

  /** Reset administrativo: invalida as sessoes e exige troca no proximo acesso. */
  async resetPassword(
    ctx: RequestContext,
    id: string,
    dto: AdminResetPasswordDTO,
  ): Promise<{ temporaryPassword?: string }> {
    const user = await this.findById(ctx, id);
    const password = dto.password ?? generateTemporaryPassword();

    await this.users.updatePassword(user.id, await hashPassword(password));
    await this.users.update(ctx.scope, user.id, { mustChangePassword: true } as DeepPartial<User>);
    await this.auth.revokeAllForUser(user.id);
    await this.contexts.invalidate(ctx.scope.tenantId, user.id);

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'PASSWORD_CHANGED',
      resource: 'user',
      resourceId: user.id,
      description: `Senha redefinida pela administracao (${ctx.actor.email}).`,
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return dto.password ? {} : { temporaryPassword: password };
  }

  private async assertEmailAvailable(
    ctx: RequestContext,
    email: string,
    exceptId?: string,
  ): Promise<void> {
    if (await this.users.emailTaken(ctx.scope, email, exceptId)) {
      throw new ConflictError('Ja existe um usuario com este e-mail nesta administradora.');
    }
  }

  private async assertRole(ctx: RequestContext, roleId: string): Promise<void> {
    const role = await this.roles.findById(ctx.scope, roleId);
    if (!role) throw new NotFoundError('Papel de acesso');

    if (role.name === ROLE_SUPER_ADMIN && !ctx.scope.superAdmin) {
      throw new ForbiddenError('Apenas operadores da plataforma podem atribuir este papel.');
    }
  }

  private async assertCondominiums(ctx: RequestContext, condominiumIds: string[]): Promise<void> {
    for (const condominiumId of condominiumIds) {
      await assertCondominiumAccess(ctx.scope, condominiumId);
    }
  }

  private async assertUserLimit(ctx: RequestContext): Promise<void> {
    if (ctx.scope.superAdmin) return;

    const tenant = await this.tenants.findById(ctx.scope.tenantId);
    if (!tenant) return;

    const current = await this.users.count(ctx.scope);
    if (current >= tenant.maxUsers) {
      throw new BusinessRuleError(
        `O plano ${tenant.plan} permite ate ${tenant.maxUsers} usuarios. Faca upgrade para adicionar mais.`,
      );
    }
  }

  /** Um tenant nunca pode ficar sem nenhum administrador ativo. */
  private async assertNotLastAdmin(ctx: RequestContext, user: User): Promise<void> {
    const role = user.role ?? (await this.roles.findById(ctx.scope, user.roleId));
    if (role?.name !== ROLE_ADMIN) return;

    // `role` ja e o alias da relacao carregada pelo repositorio base.
    const admins = await this.users
      .query(ctx.scope)
      .andWhere('role.name = :roleName', { roleName: ROLE_ADMIN })
      .andWhere('user.status = :status', { status: 'ACTIVE' })
      .andWhere('user.id != :userId', { userId: user.id })
      .getCount();

    if (admins === 0) {
      throw new BusinessRuleError(
        'Esta e a unica conta administradora ativa. Promova outro usuario antes de alterar esta.',
      );
    }
  }
}

export const userService = new UserService();
