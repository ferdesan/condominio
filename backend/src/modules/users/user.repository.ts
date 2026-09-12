import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { User } from './user.entity';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User, {
      alias: 'user',
      searchableFields: ['name', 'email', 'phone'],
      filterableFields: ['status', 'roleId', 'unitId'],
      relations: ['role', 'condominiums'],
      defaultSort: { field: 'name', order: 'ASC' },
    });
  }

  /**
   * Login lookup. The e-mail is unique per tenant, so the same address can
   * belong to more than one administradora — callers must disambiguate.
   */
  async findByEmailForAuthentication(email: string, tenantId?: string): Promise<User[]> {
    const qb = this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.condominiums', 'condominium')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email });

    if (tenantId) qb.andWhere('user.tenantId = :tenantId', { tenantId });

    return qb.getMany();
  }

  async findWithPassword(tenantId: string, userId: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .andWhere('user.tenantId = :tenantId', { tenantId })
      .getOne();
  }

  /** Full authorization payload: role permissions + condominium scope. */
  async findAuthenticatable(tenantId: string, userId: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.condominiums', 'condominium')
      .where('user.id = :userId', { userId })
      .andWhere('user.tenantId = :tenantId', { tenantId })
      .getOne();
  }

  async emailTaken(scope: TenantScope, email: string, exceptId?: string): Promise<boolean> {
    const qb = this.query(scope, true)
      .andWhere('user.email = :email', { email });
    if (exceptId) qb.andWhere('user.id != :exceptId', { exceptId });
    return (await qb.getCount()) > 0;
  }

  async registerLoginSuccess(userId: string): Promise<void> {
    await this.repository.update(userId, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  async registerLoginFailure(userId: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await this.repository.update(userId, { failedLoginAttempts: attempts, lockedUntil });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.repository.update(userId, {
      passwordHash,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  /** Replaces the condominium scope of a user (ManyToMany relation). */
  async setCondominiums(userId: string, condominiumIds: string[]): Promise<void> {
    const relation = this.repository
      .createQueryBuilder()
      .relation(User, 'condominiums')
      .of(userId);

    const current = await this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.condominiums', 'condominium')
      .where('user.id = :userId', { userId })
      .getOne();

    const currentIds = (current?.condominiums ?? []).map((item) => item.id);
    const toAdd = condominiumIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !condominiumIds.includes(id));

    if (toAdd.length) await relation.add(toAdd);
    if (toRemove.length) await relation.remove(toRemove);
  }
}

export const userRepository = new UserRepository();
