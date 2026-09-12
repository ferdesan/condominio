import { AppDataSource } from '@/config/data-source';
import { ForbiddenError, NotFoundError } from '@/shared/errors';
import type { TenantScope } from '@/shared/repositories/types';

/** Tabelas referenciaveis por chave estrangeira (valores internos, nunca vindos do cliente). */
export type ReferenceTable =
  | 'condominiums'
  | 'blocks'
  | 'units'
  | 'residents'
  | 'employees'
  | 'service_providers'
  | 'common_areas'
  | 'financial_categories'
  | 'charges'
  | 'assemblies'
  | 'polls'
  | 'poll_options'
  | 'users'
  | 'roles';

const LABELS: Record<ReferenceTable, string> = {
  condominiums: 'Condominio',
  blocks: 'Bloco',
  units: 'Unidade',
  residents: 'Morador',
  employees: 'Funcionario',
  service_providers: 'Prestador',
  common_areas: 'Area comum',
  financial_categories: 'Categoria financeira',
  charges: 'Cobranca',
  assemblies: 'Assembleia',
  polls: 'Votacao',
  poll_options: 'Opcao de votacao',
  users: 'Usuario',
  roles: 'Papel de acesso',
};

/**
 * Valida chaves estrangeiras *dentro do tenant*. Sem isso, um cliente poderia
 * vincular um registro seu a um id pertencente a outro tenant (IDOR).
 */
export async function assertReferenceExists(
  scope: TenantScope,
  table: ReferenceTable,
  id: string,
): Promise<void> {
  const row = await AppDataSource.createQueryBuilder()
    .select('1', 'ok')
    .from(table, 'ref')
    .where('ref.id = :id', { id })
    .andWhere(scope.superAdmin ? '1 = 1' : 'ref.tenant_id = :tenantId', {
      tenantId: scope.tenantId,
    })
    .andWhere('ref.deleted_at IS NULL')
    .getRawOne();

  if (!row) throw new NotFoundError(LABELS[table]);
}

/**
 * Garante que o usuario enxerga o condominio informado. Usuarios sem
 * `condominiumIds` (perfis administrativos) enxergam todos do tenant.
 */
export async function assertCondominiumAccess(
  scope: TenantScope,
  condominiumId: string,
): Promise<void> {
  await assertReferenceExists(scope, 'condominiums', condominiumId);

  if (scope.superAdmin) return;
  if (!scope.condominiumIds?.length) return;
  if (scope.condominiumIds.includes(condominiumId)) return;

  throw new ForbiddenError('Voce nao possui acesso a este condominio.');
}

/** Resolve o condominio de uma unidade, validando o escopo do usuario. */
export async function resolveUnitCondominium(
  scope: TenantScope,
  unitId: string,
): Promise<string> {
  const row = await AppDataSource.createQueryBuilder()
    .select('unit.condominium_id', 'condominiumId')
    .from('units', 'unit')
    .where('unit.id = :unitId', { unitId })
    .andWhere(scope.superAdmin ? '1 = 1' : 'unit.tenant_id = :tenantId', {
      tenantId: scope.tenantId,
    })
    .andWhere('unit.deleted_at IS NULL')
    .getRawOne<{ condominiumId: string }>();

  if (!row) throw new NotFoundError('Unidade');
  await assertCondominiumAccess(scope, row.condominiumId);
  return row.condominiumId;
}
