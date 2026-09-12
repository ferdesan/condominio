import { randomUUID } from 'node:crypto';
import { AppDataSource } from '@/config/data-source';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { auditService, type AuditService } from '@/modules/audit/audit.service';
import { Condominium } from '@/modules/condominiums/condominium.entity';
import { Role } from '@/modules/roles/role.entity';
import { Tenant } from '@/modules/tenants/tenant.entity';
import { User } from '@/modules/users/user.entity';
import { userRepository, type UserRepository } from '@/modules/users/user.repository';
import { tenantRepository, type TenantRepository } from '@/modules/tenants/tenant.repository';
import { ROLE_ADMIN, ROLE_DEFINITIONS } from '@/shared/constants/roles';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/errors';
import { sha256, randomToken } from '@/shared/utils/crypto.util';
import { dayjs } from '@/shared/utils/date.util';
import { hashPassword, verifyPassword } from '@/shared/utils/password.util';
import { authContextService, type AuthContextService } from './auth-context.service';
import { authRepository, type AuthRepository } from './auth.repository';
import { tokenService, type IssuedTokens, type TokenService } from './token.service';
import type {
  ChangePasswordDTO,
  ForgotPasswordDTO,
  LoginDTO,
  RegisterTenantDTO,
  ResetPasswordDTO,
  UpdateProfileDTO,
} from './auth.schema';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string;
};

export type AuthenticatedUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  permissions: string[];
  condominiumIds: string[];
  unitId?: string | null;
  mustChangePassword: boolean;
  preferences?: User['preferences'];
  tenant?: { id: string; name: string; slug: string; plan: string; logoUrl?: string | null };
};

export type LoginResult = {
  user: AuthenticatedUser;
  tokens: IssuedTokens;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository = userRepository,
    private readonly tenants: TenantRepository = tenantRepository,
    private readonly auth: AuthRepository = authRepository,
    private readonly tokens: TokenService = tokenService,
    private readonly contexts: AuthContextService = authContextService,
    private readonly audit: AuditService = auditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login / sessions
  // ---------------------------------------------------------------------------

  async login(dto: LoginDTO, meta: RequestMeta): Promise<LoginResult> {
    const tenantId = dto.tenantSlug ? await this.resolveTenantId(dto.tenantSlug) : undefined;
    const candidates = await this.users.findByEmailForAuthentication(dto.email, tenantId);

    if (!candidates.length) {
      // Mesma resposta de senha incorreta: nao revela se o e-mail existe.
      throw new UnauthorizedError('E-mail ou senha invalidos.');
    }

    const matches: User[] = [];
    for (const candidate of candidates) {
      if (await verifyPassword(dto.password, candidate.passwordHash)) matches.push(candidate);
    }

    if (!matches.length) {
      await Promise.all(candidates.map((candidate) => this.registerFailure(candidate, meta)));
      throw new UnauthorizedError('E-mail ou senha invalidos.');
    }

    if (matches.length > 1) {
      throw new ConflictError('Informe a administradora para concluir o acesso.', [
        { field: 'tenantSlug', message: 'Selecione a administradora desejada.', code: 'TENANT_REQUIRED' },
      ]);
    }

    const user = matches[0];
    this.assertNotLocked(user);
    this.assertActive(user);

    await this.users.registerLoginSuccess(user.id);
    await this.contexts.invalidate(user.tenantId, user.id);

    const tokens = await this.startSession(user, meta);

    await this.audit.record({
      tenantId: user.tenantId,
      action: 'LOGIN',
      resource: 'user',
      resourceId: user.id,
      description: `Login realizado por ${user.email}`,
      actor: { userId: user.id, name: user.name },
      ...meta,
    });

    return { user: await this.toAuthenticatedUser(user), tokens };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<LoginResult> {
    const payload = this.tokens.verifyRefreshToken(refreshToken);
    const stored = await this.auth.findRefreshToken(sha256(refreshToken));

    if (!stored) {
      throw new UnauthorizedError('Sessao expirada. Faca login novamente.');
    }

    if (stored.revokedAt) {
      // Reuso de token revogado: sessao potencialmente comprometida.
      logger.warn('Refresh token reuse detected', { userId: stored.userId });
      await this.auth.revokeAllForUser(stored.userId);
      await this.audit.record({
        tenantId: stored.tenantId,
        action: 'PERMISSION_DENIED',
        resource: 'auth',
        resourceId: stored.userId,
        description: 'Reuso de refresh token detectado: todas as sessoes foram encerradas.',
        ...meta,
      });
      throw new UnauthorizedError('Sessao invalidada por seguranca. Faca login novamente.');
    }

    if (dayjs(stored.expiresAt).isBefore(dayjs())) {
      throw new UnauthorizedError('Sessao expirada. Faca login novamente.');
    }

    const user = await this.users.findAuthenticatable(payload.tid, payload.sub);
    if (!user) throw new UnauthorizedError('Sessao invalida.');
    this.assertActive(user);

    const tokens = await this.startSession(user, meta, stored.sessionId);
    const issued = await this.auth.findRefreshToken(sha256(tokens.refreshToken));
    await this.auth.revokeRefreshToken(stored.id, issued?.id ?? null);

    return { user: await this.toAuthenticatedUser(user), tokens };
  }

  async logout(refreshToken: string | undefined, meta: RequestMeta, actor?: { userId: string; tenantId: string; name: string }): Promise<void> {
    if (refreshToken) {
      const stored = await this.auth.findRefreshToken(sha256(refreshToken));
      if (stored) await this.auth.revokeSession(stored.sessionId);
    }

    if (actor) {
      await this.audit.record({
        tenantId: actor.tenantId,
        action: 'LOGOUT',
        resource: 'user',
        resourceId: actor.userId,
        description: 'Logout realizado.',
        actor: { userId: actor.userId, name: actor.name },
        ...meta,
      });
    }
  }

  async logoutAll(userId: string, tenantId: string): Promise<void> {
    await this.auth.revokeAllForUser(userId);
    await this.contexts.invalidate(tenantId, userId);
  }

  async listSessions(userId: string) {
    const sessions = await this.auth.listActiveSessions(userId);
    return sessions.map((session) => ({
      id: session.id,
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    }));
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  async me(tenantId: string, userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findAuthenticatable(tenantId, userId);
    if (!user) throw new NotFoundError('Usuario');
    return this.toAuthenticatedUser(user);
  }

  async updateProfile(
    tenantId: string,
    userId: string,
    dto: UpdateProfileDTO,
  ): Promise<AuthenticatedUser> {
    const repository = AppDataSource.getRepository(User);
    const user = await this.users.findAuthenticatable(tenantId, userId);
    if (!user) throw new NotFoundError('Usuario');

    await repository.update(userId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      ...(dto.preferences !== undefined
        ? { preferences: { ...(user.preferences ?? {}), ...dto.preferences } }
        : {}),
    });

    await this.contexts.invalidate(tenantId, userId);
    return this.me(tenantId, userId);
  }

  async changePassword(
    tenantId: string,
    userId: string,
    dto: ChangePasswordDTO,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.users.findWithPassword(tenantId, userId);
    if (!user) throw new NotFoundError('Usuario');

    const valid = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Senha atual incorreta.');

    await this.users.updatePassword(userId, await hashPassword(dto.newPassword));
    await this.auth.revokeAllForUser(userId);
    await this.contexts.invalidate(tenantId, userId);

    await this.audit.record({
      tenantId,
      action: 'PASSWORD_CHANGED',
      resource: 'user',
      resourceId: userId,
      description: 'Senha alterada pelo proprio usuario.',
      actor: { userId, name: user.name },
      ...meta,
    });
  }

  /**
   * Sempre responde com sucesso para nao permitir enumeracao de contas.
   * O token e retornado apenas fora de producao (integracao de e-mail e
   * responsabilidade do provedor configurado no deploy).
   */
  async forgotPassword(dto: ForgotPasswordDTO, meta: RequestMeta): Promise<{ token?: string }> {
    const tenantId = dto.tenantSlug ? await this.resolveTenantId(dto.tenantSlug) : undefined;
    const candidates = await this.users.findByEmailForAuthentication(dto.email, tenantId);
    const user = candidates[0];
    if (!user) return {};

    const token = randomToken(32);
    await this.auth.invalidateResetTokens(user.id);
    await this.auth.createResetToken({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: dayjs().add(env.PASSWORD_RESET_TTL_MINUTES, 'minute').toDate(),
    });

    await this.audit.record({
      tenantId: user.tenantId,
      action: 'PASSWORD_CHANGED',
      resource: 'user',
      resourceId: user.id,
      description: 'Solicitacao de recuperacao de senha.',
      ...meta,
    });

    logger.info(`Password reset requested for ${user.email}`);
    return env.NODE_ENV === 'production' ? {} : { token };
  }

  async resetPassword(dto: ResetPasswordDTO, meta: RequestMeta): Promise<void> {
    const stored = await this.auth.findResetToken(sha256(dto.token));
    if (!stored || stored.usedAt || dayjs(stored.expiresAt).isBefore(dayjs())) {
      throw new BadRequestError('Token de recuperacao invalido ou expirado.');
    }

    await this.users.updatePassword(stored.userId, await hashPassword(dto.password));
    await this.auth.markResetTokenUsed(stored.id);
    await this.auth.revokeAllForUser(stored.userId);
    await this.contexts.invalidate(stored.tenantId, stored.userId);

    await this.audit.record({
      tenantId: stored.tenantId,
      action: 'PASSWORD_CHANGED',
      resource: 'user',
      resourceId: stored.userId,
      description: 'Senha redefinida via token de recuperacao.',
      ...meta,
    });
  }

  // ---------------------------------------------------------------------------
  // Tenant self-service signup
  // ---------------------------------------------------------------------------

  /**
   * Cria administradora + papeis padrao + usuario administrador em uma unica
   * transacao: um cadastro parcial deixaria o tenant inutilizavel.
   */
  async registerTenant(dto: RegisterTenantDTO, meta: RequestMeta): Promise<LoginResult> {
    const slug = (dto.slug ?? this.slugify(dto.tenantName)).toLowerCase();
    const document = dto.document?.replace(/\D/g, '') || null;

    if (await this.tenants.findBySlug(slug)) {
      throw new ConflictError('Ja existe uma administradora com este identificador.');
    }
    if (document && (await this.tenants.findByDocument(document))) {
      throw new ConflictError('Ja existe uma administradora com este CNPJ.');
    }

    const passwordHash = await hashPassword(dto.password);

    const userId = await AppDataSource.transaction(async (manager) => {
      const tenant = await manager.save(
        manager.create(Tenant, {
          name: dto.tenantName,
          slug,
          document,
          email: dto.email,
          phone: dto.phone ?? null,
          plan: 'TRIAL',
          status: 'ACTIVE',
          maxCondominiums: 1,
          maxUsers: 10,
          trialEndsAt: dayjs().add(14, 'day').toDate(),
          settings: { timezone: 'America/Sao_Paulo', locale: 'pt-BR', chargeGraceDays: 0 },
        }),
      );

      const roles = await manager.save(
        ROLE_DEFINITIONS.map((definition) =>
          manager.create(Role, {
            tenantId: tenant.id,
            name: definition.name,
            description: definition.description,
            permissions: definition.permissions,
            isSystem: true,
          }),
        ),
      );

      const adminRole = roles.find((role) => role.name === ROLE_ADMIN);
      if (!adminRole) throw new Error('Papel ADMIN nao foi criado.');

      const user = await manager.save(
        manager.create(User, {
          tenantId: tenant.id,
          name: dto.adminName,
          email: dto.email,
          passwordHash,
          phone: dto.phone ?? null,
          status: 'ACTIVE',
          roleId: adminRole.id,
          emailVerifiedAt: new Date(),
          lgpdConsentAt: new Date(),
          preferences: { theme: 'system', locale: 'pt-BR', emailNotifications: true },
        }),
      );

      return user.id;
    });

    const user = await this.users.findByEmailForAuthentication(dto.email);
    const created = user.find((item) => item.id === userId);
    if (!created) throw new Error('Falha ao carregar o usuario recem-criado.');

    const tokens = await this.startSession(created, meta);

    await this.audit.record({
      tenantId: created.tenantId,
      action: 'CREATE',
      resource: 'tenant',
      resourceId: created.tenantId,
      description: `Nova administradora cadastrada: ${dto.tenantName}`,
      actor: { userId: created.id, name: created.name },
      ...meta,
    });

    return { user: await this.toAuthenticatedUser(created), tokens };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async startSession(
    user: User,
    meta: RequestMeta,
    sessionId: string = randomUUID(),
  ): Promise<IssuedTokens> {
    const tokens = this.tokens.issue(user.id, user.tenantId, sessionId);

    await this.auth.createRefreshToken({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: sha256(tokens.refreshToken),
      sessionId,
      expiresAt: this.refreshExpiration(),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    });

    return tokens;
  }

  private refreshExpiration(): Date {
    const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
    if (!match) return dayjs().add(7, 'day').toDate();
    const [, amount, unit] = match;
    const unitMap = { s: 'second', m: 'minute', h: 'hour', d: 'day' } as const;
    return dayjs()
      .add(Number(amount), unitMap[unit as keyof typeof unitMap])
      .toDate();
  }

  private assertActive(user: User): void {
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('Usuario inativo ou bloqueado. Procure a administracao.');
    }
  }

  private assertNotLocked(user: User): void {
    if (user.lockedUntil && dayjs(user.lockedUntil).isAfter(dayjs())) {
      const minutes = dayjs(user.lockedUntil).diff(dayjs(), 'minute') + 1;
      throw new ForbiddenError(
        `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutes} minuto(s).`,
      );
    }
  }

  private async registerFailure(user: User, meta: RequestMeta): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const lockedUntil =
      attempts >= MAX_LOGIN_ATTEMPTS ? dayjs().add(LOCK_MINUTES, 'minute').toDate() : null;

    await this.users.registerLoginFailure(user.id, attempts, lockedUntil);
    await this.audit.record({
      tenantId: user.tenantId,
      action: 'LOGIN_FAILED',
      resource: 'user',
      resourceId: user.id,
      description: `Tentativa de login invalida (${attempts}/${MAX_LOGIN_ATTEMPTS}).`,
      ...meta,
    });
  }

  private async resolveTenantId(slug: string): Promise<string> {
    const tenant = await this.tenants.findBySlug(slug);
    if (!tenant) throw new UnauthorizedError('E-mail ou senha invalidos.');
    if (tenant.status !== 'ACTIVE') {
      throw new ForbiddenError('Administradora suspensa. Entre em contato com o suporte.');
    }
    return tenant.id;
  }

  private async toAuthenticatedUser(user: User): Promise<AuthenticatedUser> {
    const tenant = await this.tenants.findById(user.tenantId);
    const condominiums = user.condominiums ?? [];

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role?.name ?? '',
      permissions: user.role?.permissions ?? [],
      condominiumIds: condominiums.map((condominium: Condominium) => condominium.id),
      unitId: user.unitId ?? null,
      mustChangePassword: user.mustChangePassword,
      preferences: user.preferences,
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            logoUrl: tenant.logoUrl ?? null,
          }
        : undefined,
    };
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
}

export const authService = new AuthService();
