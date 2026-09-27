import type { SelectQueryBuilder } from 'typeorm';
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
   * O vinculo usuario-condominio e ManyToMany (`user_condominiums`), entao nao
   * cabe no `condominiumField` da base, que exige coluna propria. O escopo e
   * aplicado aqui como subquery sobre o pivot, o que cobre de uma vez lista,
   * detalhe, contagem e as releituras de create/update/delete.
   *
   * Quem entra: os usuarios vinculados a pelo menos um condominio do escopo, e
   * os usuarios sem vinculo nenhum — que, por definicao do modelo, enxergam o
   * tenant inteiro e precisam continuar visiveis (mesma semantica de
   * `RecipientsService.usersOfCondominium`).
   *
   * Quem fica de fora: usuario vinculado apenas a condominios que o ator nao
   * administra. Some da listagem e vira 404 no detalhe, sem revelar existencia.
   */
  protected override baseQuery(scope: TenantScope, withDeleted = false): SelectQueryBuilder<User> {
    const qb = super.baseQuery(scope, withDeleted);
    if (scope.superAdmin || !scope.condominiumIds?.length) return qb;

    return qb.andWhere(
      `(user.id IN (SELECT uc.user_id FROM user_condominiums uc
                    WHERE uc.condominium_id IN (:...scopedCondominiums))
        OR NOT EXISTS (SELECT 1 FROM user_condominiums uc_all
                       WHERE uc_all.user_id = user.id))`,
      { scopedCondominiums: scope.condominiumIds },
    );
  }

  /**
   * Unicidade de e-mail e por tenant, nao por condominio: um usuario de outro
   * condominio ainda ocupa o endereco. Por isso a checagem ignora o escopo de
   * condominio — se obeyedesse, um ator com escopo poderia cadastrar um e-mail
   * ja existente fora dos seus condominios e violar o indice unico do banco.
   */
  private tenantWideQuery(scope: TenantScope): SelectQueryBuilder<User> {
    const qb = this.repository
      .createQueryBuilder(this.alias)
      .where(`${this.alias}.tenantId = :scopedTenantId`, { scopedTenantId: scope.tenantId });

    return qb;
  }

  /** Verifica se o usuario tem alcada sobre a lista de usuarios do tenant. */
  async countAllOfTenant(scope: TenantScope): Promise<number> {
    return this.tenantWideQuery(scope).getCount();
  }

  /** Conta administradores ativos de todo o tenant, ignorando o escopo. */
  async countActiveAdminsOfTenant(
    scope: TenantScope,
    exceptUserId: string,
    roleName: string,
  ): Promise<number> {
    return this.tenantWideQuery(scope)
      .innerJoin('user.role', 'role')
      .andWhere('role.name = :roleName', { roleName })
      .andWhere('user.status = :status', { status: 'ACTIVE' })
      .andWhere('user.id != :userId', { userId: exceptUserId })
      .getCount();
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
    const qb = this.tenantWideQuery(scope).withDeleted().andWhere('user.email = :email', { email });
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

  async registerLoginFailure(
    userId: string,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
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
    const relation = this.repository.createQueryBuilder().relation(User, 'condominiums').of(userId);

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
