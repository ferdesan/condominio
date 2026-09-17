import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabelas LGPD (MySQL 8 / InnoDB / utf8mb4).
 *
 * Segue as convencoes do schema inicial:
 * - PK `id` VARCHAR(36) (UUID gerado pela aplicacao);
 * - toda tabela de dominio carrega `tenant_id` e e indexada por ele;
 * - exclusao logica via `deleted_at`;
 * - enums sao VARCHAR validados na borda (zod).
 */
export class LgpdTables1757700000000 implements MigrationInterface {
  name = 'LgpdTables1757700000000';

  private readonly tenantBase = `
    id VARCHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    tenant_id VARCHAR(36) NOT NULL`;

  private readonly engine = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

  private table(name: string, columns: string): string {
    return `CREATE TABLE \`${name}\` (${this.tenantBase},${columns}, PRIMARY KEY (id)) ${this.engine}`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      this.table(
        'lgpd_requests',
        `
        condominium_id VARCHAR(36) NOT NULL,
        resident_id VARCHAR(36) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        executed_at DATETIME(6) NULL,
        cancelled_at DATETIME(6) NULL,
        notes TEXT NULL,
        KEY IDX_lgpd_requests_tenant (tenant_id),
        KEY IDX_lgpd_requests_tenant_condominium (tenant_id, condominium_id),
        KEY IDX_lgpd_requests_resident (resident_id),
        KEY IDX_lgpd_requests_status (tenant_id, status),
        CONSTRAINT FK_lgpd_requests_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE,
        CONSTRAINT FK_lgpd_requests_resident FOREIGN KEY (resident_id) REFERENCES residents (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'lgpd_consents',
        `
        resident_id VARCHAR(36) NOT NULL,
        consent_type VARCHAR(50) NOT NULL DEFAULT 'DATA_PROCESSING',
        granted TINYINT(1) NOT NULL DEFAULT 0,
        granted_at DATETIME(6) NULL,
        revoked_at DATETIME(6) NULL,
        ip_address VARCHAR(64) NULL,
        description TEXT NULL,
        UNIQUE KEY UQ_lgpd_consents_resident_type (resident_id, consent_type),
        KEY IDX_lgpd_consents_tenant (tenant_id),
        CONSTRAINT FK_lgpd_consents_resident FOREIGN KEY (resident_id) REFERENCES residents (id) ON DELETE CASCADE`,
      ),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa da criacao para respeitar as chaves estrangeiras.
    await queryRunner.query('DROP TABLE IF EXISTS `lgpd_consents`');
    await queryRunner.query('DROP TABLE IF EXISTS `lgpd_requests`');
  }
}
