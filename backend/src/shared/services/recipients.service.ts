import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/logger';

/**
 * Resolve destinatarios de notificacoes a partir da estrutura do condominio.
 * Consultas leves e intencionalmente tolerantes a falha: notificar e um efeito
 * colateral, nunca o motivo de uma operacao falhar.
 */
export class RecipientsService {
  /** Usuarios vinculados a unidade, direta ou via cadastro de morador. */
  async usersOfUnit(tenantId: string, unitId: string): Promise<string[]> {
    try {
      const direct = await AppDataSource.createQueryBuilder()
        .select('u.id', 'id')
        .from('users', 'u')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('u.unit_id = :unitId', { unitId })
        .andWhere('u.deleted_at IS NULL')
        .andWhere("u.status = 'ACTIVE'")
        .getRawMany<{ id: string }>();

      const viaResidents = await AppDataSource.createQueryBuilder()
        .select('r.user_id', 'id')
        .from('residents', 'r')
        .where('r.tenant_id = :tenantId', { tenantId })
        .andWhere('r.unit_id = :unitId', { unitId })
        .andWhere('r.user_id IS NOT NULL')
        .andWhere('r.deleted_at IS NULL')
        .andWhere("r.status = 'ACTIVE'")
        .getRawMany<{ id: string }>();

      return this.unique([...direct, ...viaResidents].map((row) => row.id));
    } catch (error) {
      logger.warn(`usersOfUnit failed: ${(error as Error).message}`);
      return [];
    }
  }

  /** Usuarios com acesso ao condominio (inclui perfis sem vinculo explicito). */
  async usersOfCondominium(tenantId: string, condominiumId: string): Promise<string[]> {
    try {
      const rows = await AppDataSource.createQueryBuilder()
        .select('u.id', 'id')
        .from('users', 'u')
        .leftJoin('user_condominiums', 'uc', 'uc.user_id = u.id')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('u.deleted_at IS NULL')
        .andWhere("u.status = 'ACTIVE'")
        .andWhere('(uc.condominium_id = :condominiumId OR uc.condominium_id IS NULL)', {
          condominiumId,
        })
        .getRawMany<{ id: string }>();

      return this.unique(rows.map((row) => row.id));
    } catch (error) {
      logger.warn(`usersOfCondominium failed: ${(error as Error).message}`);
      return [];
    }
  }

  /** Usuarios de determinados papeis, usado para alertar sindico/portaria. */
  async usersByRoles(tenantId: string, roleNames: string[]): Promise<string[]> {
    if (!roleNames.length) return [];
    try {
      const rows = await AppDataSource.createQueryBuilder()
        .select('u.id', 'id')
        .from('users', 'u')
        .innerJoin('roles', 'r', 'r.id = u.role_id')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('u.deleted_at IS NULL')
        .andWhere("u.status = 'ACTIVE'")
        .andWhere('r.name IN (:...roleNames)', { roleNames })
        .getRawMany<{ id: string }>();

      return this.unique(rows.map((row) => row.id));
    } catch (error) {
      logger.warn(`usersByRoles failed: ${(error as Error).message}`);
      return [];
    }
  }

  private unique(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => Boolean(value)))];
  }
}

export const recipientsService = new RecipientsService();
