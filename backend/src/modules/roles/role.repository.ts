import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Role } from './role.entity';

export class RoleRepository extends BaseRepository<Role> {
  constructor() {
    super(Role, {
      alias: 'role',
      searchableFields: ['name', 'description'],
      filterableFields: ['isSystem'],
      defaultSort: { field: 'name', order: 'ASC' },
    });
  }

  async findByName(tenantId: string, name: string): Promise<Role | null> {
    return this.findOneBy({ tenantId }, { name } as Partial<Record<keyof Role, unknown>>);
  }

  async nameTaken(scope: TenantScope, name: string, exceptId?: string): Promise<boolean> {
    const qb = this.query(scope, true).andWhere('role.name = :name', { name });
    if (exceptId) qb.andWhere('role.id != :exceptId', { exceptId });
    return (await qb.getCount()) > 0;
  }

  async countUsers(tenantId: string, roleId: string): Promise<number> {
    return this.repository.manager
      .createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from('users', 'u')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('u.role_id = :roleId', { roleId })
      .andWhere('u.deleted_at IS NULL')
      .getRawOne<{ total: string }>()
      .then((row) => Number(row?.total ?? 0));
  }
}

export const roleRepository = new RoleRepository();
