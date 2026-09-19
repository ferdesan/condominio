import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lancamentos do balancete (MySQL 8 / InnoDB / utf8mb4).
 *
 * Duas coisas no mesmo `up()`:
 *
 * 1. `financial_closing_entries`, um movimento congelado por linha (ADR-002);
 * 2. **os dois indices por `paid_at`** em `payments` e `expenses`.
 *
 * O item 2 nao pertence a esta esteira por acaso. `incomeByCategory`,
 * `paidByCategory` e `sumInWindow` ja filtram exatamente por
 * `(tenant_id, condominium_id, paid_at)` e sempre varreram a tabela sem indice
 * nenhum atras; a leitura linha a linha que nasce agora faz isso com mais
 * frequencia. O indice paga a funcionalidade nova e as agregacoes que a
 * antecedem.
 *
 * Nada aqui e exercitado por suite alguma: os testes criam o schema por
 * `synchronize` a partir das entidades. O aceite desta migration e a execucao
 * contra o MySQL local, registrada na task.
 *
 * Segue as convencoes do schema inicial: PK `id` VARCHAR(36), `tenant_id` em
 * toda tabela de dominio, exclusao logica por `deleted_at`, enums como VARCHAR
 * validados na borda, e dinheiro em DECIMAL(12,2).
 */
export class ClosingEntries1757900000000 implements MigrationInterface {
  name = 'ClosingEntries1757900000000';

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
        'financial_closing_entries',
        `
        closing_id VARCHAR(36) NOT NULL,
        kind VARCHAR(20) NOT NULL,
        occurred_at DATETIME(6) NOT NULL,
        category_id VARCHAR(36) NULL,
        category_name VARCHAR(120) NOT NULL,
        description VARCHAR(200) NOT NULL,
        counterpart VARCHAR(160) NULL,
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(20) NULL,
        source_id VARCHAR(36) NOT NULL,
        KEY IDX_financial_closing_entries_closing (closing_id, kind),
        KEY IDX_financial_closing_entries_tenant (tenant_id),
        CONSTRAINT FK_financial_closing_entries_closing FOREIGN KEY (closing_id) REFERENCES financial_closings (id) ON DELETE CASCADE`,
      ),
    );

    // `category_id` fica sem FK de proposito: a categoria pode ser removida
    // depois, e o documento continua apontando para o id que tinha no dia em que
    // foi fechado — e por isso que `category_name` viaja ao lado dele.
    await queryRunner.query(
      'CREATE INDEX IDX_payments_paid_at ON `payments` (tenant_id, condominium_id, paid_at)',
    );
    await queryRunner.query(
      'CREATE INDEX IDX_expenses_paid_at ON `expenses` (tenant_id, condominium_id, paid_at)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IDX_expenses_paid_at ON `expenses`');
    await queryRunner.query('DROP INDEX IDX_payments_paid_at ON `payments`');

    // A tabela por ultimo: a FK com `ON DELETE CASCADE` sai junto dela, e
    // derrubar os indices antes mantem o `down()` na ordem inversa exata do
    // `up()`.
    await queryRunner.query('DROP TABLE IF EXISTS `financial_closing_entries`');
  }
}
