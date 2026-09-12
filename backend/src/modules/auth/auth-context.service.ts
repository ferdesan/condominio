import { ForbiddenError, UnauthorizedError } from '@/shared/errors';
import { cacheService, type CacheService } from '@/shared/services/cache.service';
import { ROLE_SUPER_ADMIN } from '@/shared/constants/roles';
import type { AuthContext } from '@/shared/types/auth-context';
import { userRepository, type UserRepository } from '@/modules/users/user.repository';

/** Cached slice of the user record that drives authorization decisions. */
type CachedPrincipal = Omit<AuthContext, 'sessionId'>;

const PRINCIPAL_TTL_SECONDS = 60;

/**
 * Turns a verified JWT into the authorization context used by the whole
 * application. Permissions are read from the database (not from the token) so
 * revoking a role takes effect within one minute instead of one token lifetime.
 */
export class AuthContextService {
  constructor(
    private readonly users: UserRepository = userRepository,
    private readonly cache: CacheService = cacheService,
  ) {}

  async resolve(tenantId: string, userId: string, sessionId: string): Promise<AuthContext> {
    const principal = await this.cache.remember(
      this.cacheKey(tenantId, userId),
      PRINCIPAL_TTL_SECONDS,
      () => this.loadPrincipal(tenantId, userId),
    );

    return { ...principal, sessionId };
  }

  async invalidate(tenantId: string, userId: string): Promise<void> {
    await this.cache.del(this.cacheKey(tenantId, userId));
  }

  /** Used when a role changes: every member of the tenant is re-resolved. */
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cache.delByPrefix(`auth:principal:${tenantId}:`);
  }

  private cacheKey(tenantId: string, userId: string): string {
    return `auth:principal:${tenantId}:${userId}`;
  }

  private async loadPrincipal(tenantId: string, userId: string): Promise<CachedPrincipal> {
    const user = await this.users.findAuthenticatable(tenantId, userId);
    if (!user) throw new UnauthorizedError('Sessao invalida.');

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('Usuario inativo ou bloqueado. Procure a administracao.');
    }

    const roleName = user.role?.name ?? '';

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName,
      permissions: user.role?.permissions ?? [],
      condominiumIds: (user.condominiums ?? []).map((condominium) => condominium.id),
      unitId: user.unitId ?? null,
      isSuperAdmin: roleName === ROLE_SUPER_ADMIN,
    };
  }
}

export const authContextService = new AuthContextService();
