import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ROLE_DEFINITIONS } from '@/shared/constants/roles';

/**
 * O card "Atividade recente" do painel passou a exigir `dashboard-activity:read`
 * em vez de `dashboard:read`.
 *
 * Papeis do sistema: reaplica a definicao do codigo, como em
 * `SyncSystemRolePermissions` — ADMIN e SINDICO ganham o recurso novo pelo
 * `manageAll`; STAFF e RESIDENT continuam sem ele.
 *
 * Papeis personalizados: quem ja via o painel continua vendo o card, para que a
 * mudanca nao tire nada em silencio. Bloquear passa a ser desmarcar a linha
 * "Atividade recente do painel" na matriz de permissoes.
 */
export class DashboardActivityPermission1758300000000 implements MigrationInterface {
  name = 'DashboardActivityPermission1758300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const definition of ROLE_DEFINITIONS) {
      await queryRunner.query(
        'UPDATE `roles` SET `permissions` = ? WHERE `is_system` = 1 AND `name` = ? AND `deleted_at` IS NULL',
        [JSON.stringify(definition.permissions), definition.name],
      );
    }

    const custom: Array<{ id: string; permissions: string | string[] }> = await queryRunner.query(
      'SELECT `id`, `permissions` FROM `roles` WHERE `is_system` = 0 AND `deleted_at` IS NULL',
    );
    for (const role of custom) {
      const permissions: string[] =
        typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
      const seesDashboard =
        permissions.includes('dashboard:read') || permissions.includes('dashboard:manage');
      if (!seesDashboard || permissions.includes('dashboard-activity:read')) continue;
      await queryRunner.query('UPDATE `roles` SET `permissions` = ? WHERE `id` = ?', [
        JSON.stringify([...permissions, 'dashboard-activity:read']),
        role.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const roles: Array<{ id: string; permissions: string | string[] }> = await queryRunner.query(
      'SELECT `id`, `permissions` FROM `roles` WHERE `deleted_at` IS NULL',
    );
    for (const role of roles) {
      const permissions: string[] =
        typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
      const kept = permissions.filter((item) => !item.startsWith('dashboard-activity:'));
      if (kept.length === permissions.length) continue;
      await queryRunner.query('UPDATE `roles` SET `permissions` = ? WHERE `id` = ?', [
        JSON.stringify(kept),
        role.id,
      ]);
    }
  }
}
