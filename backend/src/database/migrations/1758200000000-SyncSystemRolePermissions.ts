import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ROLE_DEFINITIONS } from '@/shared/constants/roles';

/**
 * Papel do sistema nasce de `ROLE_DEFINITIONS`, mas o seed so roda quando o
 * tenant demo ainda nao existe (`runSeeds` pula se encontrar o tenant) — bases
 * antigas guardam a permissao de quando foram semeadas e divergem do codigo.
 *
 * O caso concreto: `SINDICO` ganhou `role:read` no commit 71cb3ae para o
 * seletor de papeis de `/usuarios`, e um banco semeado antes continuava sem a
 * chave — o `GET /roles` da tela respondia 403 e o toast global anunciava
 * "Voce nao possui permissao". Como `RoleService.beforeUpdate` recusa alterar
 * permissoes de papel de sistema, a correcao nao pode passar pela tela.
 *
 * Reparo de dados: sobrescreve `permissions` dos papeis semeados com a
 * definicao atual do codigo, em todos os tenants. Papel personalizado
 * (`is_system = 0`) nao e tocado — as permissoes dele sao escolha do tenant.
 * Nomes e descricoes tambem ficam: descricao de papel de sistema e editavel
 * pela tela e pode ter sido personalizada.
 *
 * Aceite: execucao contra o MySQL local; os testes criam o schema via
 * `synchronize` a partir da entidade.
 */
export class SyncSystemRolePermissions1758200000000 implements MigrationInterface {
  name = 'SyncSystemRolePermissions1758200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const definition of ROLE_DEFINITIONS) {
      await queryRunner.query(
        'UPDATE `roles` SET `permissions` = ? WHERE `is_system` = 1 AND `name` = ? AND `deleted_at` IS NULL',
        [JSON.stringify(definition.permissions), definition.name],
      );
    }
  }

  public async down(): Promise<void> {
    // Reparo de dados: as permissoes antigas nao estao versionadas em lugar
    // nenhum, entao nao ha o que restaurar.
  }
}
