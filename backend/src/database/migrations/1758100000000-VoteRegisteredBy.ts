import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coluna `registered_by_user_id` em `votes` para a gestao manual de voto:
 * o sindico/admin registra o voto de uma unidade e o sistema guarda quem
 * fez o registro (mesmo em votacao secreta, o autor do voto permanece nulo).
 *
 * Aceite: execucao contra o MySQL local; os testes criam o schema via
 * `synchronize` a partir da entidade.
 */
export class VoteRegisteredBy1758100000000 implements MigrationInterface {
  name = 'VoteRegisteredBy1758100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `votes` ADD COLUMN `registered_by_user_id` VARCHAR(36) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `votes` DROP COLUMN `registered_by_user_id`');
  }
}
