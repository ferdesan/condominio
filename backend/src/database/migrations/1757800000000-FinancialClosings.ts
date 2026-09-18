import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Balancete mensal (MySQL 8 / InnoDB / utf8mb4).
 *
 * Tres coisas no mesmo `up()`, porque uma implantacao parcial entre elas deixa o
 * sistema pior do que antes:
 *
 * 1. `financial_closings`, o documento do mes fechado;
 * 2. o saldo de abertura e a data de corte no condominio;
 * 3. **o patch de permissao nos papeis ja gravados.**
 *
 * O item 3 nao e cosmetico. Acrescentar `financial-closing` a `RESOURCES` faz o
 * catalogo e as definicoes de papel crescerem no codigo, mas `roles.permissions`
 * e um JSON gravado no seed, e `RoleService.beforeUpdate` recusa alterar papel de
 * sistema. Sem este patch, num banco ja semeado a tela nasce negando acesso ao
 * proprio administrador — e nenhuma suite ve isso, porque os testes rodam sobre
 * um schema criado por `synchronize` e um seed que roda do zero.
 *
 * Segue as convencoes do schema inicial: PK `id` VARCHAR(36), `tenant_id` em toda
 * tabela de dominio, exclusao logica por `deleted_at`, enums como VARCHAR
 * validados na borda, e dinheiro em DECIMAL(12,2).
 */
export class FinancialClosings1757800000000 implements MigrationInterface {
  name = 'FinancialClosings1757800000000';

  private readonly tenantBase = `
    id VARCHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    tenant_id VARCHAR(36) NOT NULL`;

  private readonly engine = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

  /** Papeis de sistema que recebem o recurso novo, nomeados literalmente. */
  private readonly rolesToPatch = ['ADMIN', 'SINDICO'];

  private readonly newPermission = 'financial-closing:manage';

  private table(name: string, columns: string): string {
    return `CREATE TABLE \`${name}\` (${this.tenantBase},${columns}, PRIMARY KEY (id)) ${this.engine}`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      this.table(
        'financial_closings',
        `
        condominium_id VARCHAR(36) NOT NULL,
        reference_month VARCHAR(7) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
        opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        opening_balance_source VARCHAR(20) NOT NULL DEFAULT 'COMPUTED',
        opening_balance_from VARCHAR(10) NULL,
        total_income DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_expense DECIMAL(12,2) NOT NULL DEFAULT 0,
        closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        overdue_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        overdue_count INT NOT NULL DEFAULT 0,
        breakdown TEXT NOT NULL,
        closed_at DATETIME(6) NULL,
        closed_by_id VARCHAR(36) NULL,
        closed_by_name VARCHAR(160) NULL,
        reopened_at DATETIME(6) NULL,
        reopened_by_id VARCHAR(36) NULL,
        reopened_by_name VARCHAR(160) NULL,
        reopen_count INT NOT NULL DEFAULT 0,
        UNIQUE KEY UQ_financial_closings_month (tenant_id, condominium_id, reference_month),
        KEY IDX_financial_closings_tenant (tenant_id),
        CONSTRAINT FK_financial_closings_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      'ALTER TABLE `condominiums` ADD COLUMN `opening_balance` DECIMAL(12,2) NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `condominiums` ADD COLUMN `opening_balance_date` DATE NULL',
    );

    await this.patchSystemRoles(queryRunner, 'grant');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.patchSystemRoles(queryRunner, 'revoke');

    await queryRunner.query('ALTER TABLE `condominiums` DROP COLUMN `opening_balance_date`');
    await queryRunner.query('ALTER TABLE `condominiums` DROP COLUMN `opening_balance`');

    await queryRunner.query('DROP TABLE IF EXISTS `financial_closings`');
  }

  /**
   * Read-modify-write em TypeScript, e nao funcao JSON do MySQL: a coluna e
   * `simple-json` do TypeORM, ou seja, texto — e o codigo fica legivel e portavel.
   * Idempotente nos dois sentidos: conceder duas vezes nao duplica, revogar o que
   * nao existe nao falha.
   */
  private async patchSystemRoles(
    queryRunner: QueryRunner,
    direction: 'grant' | 'revoke',
  ): Promise<void> {
    const placeholders = this.rolesToPatch.map(() => '?').join(', ');
    const rows: { id: string; permissions: string }[] = await queryRunner.query(
      `SELECT id, permissions FROM \`roles\` WHERE is_system = 1 AND name IN (${placeholders})`,
      this.rolesToPatch,
    );

    for (const row of rows) {
      let permissions: string[];
      try {
        permissions = JSON.parse(row.permissions) as string[];
      } catch {
        // Linha com JSON ilegivel nao e consertada por uma migration de permissao.
        continue;
      }
      if (!Array.isArray(permissions)) continue;

      const has = permissions.includes(this.newPermission);
      if (direction === 'grant' && has) continue;
      if (direction === 'revoke' && !has) continue;

      const next =
        direction === 'grant'
          ? [...permissions, this.newPermission]
          : permissions.filter((permission) => permission !== this.newPermission);

      await queryRunner.query('UPDATE `roles` SET permissions = ? WHERE id = ?', [
        JSON.stringify(next),
        row.id,
      ]);
    }
  }
}
