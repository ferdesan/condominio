import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial completo (MySQL 8 / InnoDB / utf8mb4).
 *
 * Convencoes:
 * - PK `id` VARCHAR(36) (UUID gerado pela aplicacao);
 * - toda tabela de dominio carrega `tenant_id` e e indexada por ele;
 * - exclusao logica via `deleted_at`;
 * - enums sao VARCHAR validados na borda (zod) para manter portabilidade e
 *   permitir novos valores sem `ALTER TABLE` bloqueante.
 */
export class InitialSchema1757600000000 implements MigrationInterface {
  name = 'InitialSchema1757600000000';

  private readonly base = `
    id VARCHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL`;

  private readonly tenantBase = `
    id VARCHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    tenant_id VARCHAR(36) NOT NULL`;

  private readonly engine = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

  private table(name: string, columns: string, base = this.tenantBase): string {
    return `CREATE TABLE \`${name}\` (${base},${columns}, PRIMARY KEY (id)) ${this.engine}`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------------
    // Plataforma e acesso
    // ---------------------------------------------------------------------
    await queryRunner.query(
      this.table(
        'tenants',
        `
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(80) NOT NULL,
        document VARCHAR(14) NULL,
        email VARCHAR(180) NULL,
        phone VARCHAR(20) NULL,
        plan VARCHAR(20) NOT NULL DEFAULT 'TRIAL',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        max_condominiums INT NOT NULL DEFAULT 1,
        max_users INT NOT NULL DEFAULT 10,
        logo_url VARCHAR(255) NULL,
        trial_ends_at DATETIME NULL,
        settings TEXT NULL,
        UNIQUE KEY UQ_tenants_slug (slug),
        UNIQUE KEY UQ_tenants_document (document)`,
        this.base,
      ),
    );

    await queryRunner.query(
      this.table(
        'roles',
        `
        name VARCHAR(60) NOT NULL,
        description VARCHAR(255) NULL,
        permissions TEXT NOT NULL,
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        UNIQUE KEY UQ_roles_tenant_name (tenant_id, name),
        KEY IDX_roles_tenant (tenant_id)`,
      ),
    );

    await queryRunner.query(
      this.table(
        'condominiums',
        `
        name VARCHAR(150) NOT NULL,
        document VARCHAR(14) NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'RESIDENTIAL',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        zip_code VARCHAR(8) NULL,
        street VARCHAR(180) NULL,
        number VARCHAR(20) NULL,
        complement VARCHAR(120) NULL,
        district VARCHAR(120) NULL,
        city VARCHAR(120) NULL,
        state VARCHAR(2) NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(180) NULL,
        logo_url VARCHAR(255) NULL,
        syndic_name VARCHAR(150) NULL,
        syndic_phone VARCHAR(20) NULL,
        syndic_term_ends_at DATE NULL,
        charge_due_day INT NOT NULL DEFAULT 10,
        total_units INT NOT NULL DEFAULT 0,
        notes TEXT NULL,
        KEY IDX_condominiums_tenant (tenant_id),
        KEY IDX_condominiums_tenant_name (tenant_id, name)`,
      ),
    );

    await queryRunner.query(
      this.table(
        'users',
        `
        name VARCHAR(150) NOT NULL,
        email VARCHAR(180) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NULL,
        document VARCHAR(11) NULL,
        avatar_url VARCHAR(255) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        role_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NULL,
        last_login_at DATETIME NULL,
        must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        email_verified_at DATETIME NULL,
        failed_login_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        preferences TEXT NULL,
        lgpd_consent_at DATETIME NULL,
        UNIQUE KEY UQ_users_tenant_email (tenant_id, email),
        KEY IDX_users_tenant_status (tenant_id, status),
        KEY IDX_users_role (role_id),
        CONSTRAINT FK_users_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT`,
      ),
    );

    await queryRunner.query(`
      CREATE TABLE \`user_condominiums\` (
        user_id VARCHAR(36) NOT NULL,
        condominium_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (user_id, condominium_id),
        KEY IDX_user_condominiums_condominium (condominium_id),
        CONSTRAINT FK_user_condominiums_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT FK_user_condominiums_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE
      ) ${this.engine}
    `);

    await queryRunner.query(
      this.table(
        'refresh_tokens',
        `
        user_id VARCHAR(36) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        session_id VARCHAR(36) NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        replaced_by_id VARCHAR(36) NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        UNIQUE KEY UQ_refresh_tokens_hash (token_hash),
        KEY IDX_refresh_tokens_tenant_user (tenant_id, user_id),
        KEY IDX_refresh_tokens_session (session_id)`,
      ),
    );

    await queryRunner.query(
      this.table(
        'password_reset_tokens',
        `
        user_id VARCHAR(36) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        UNIQUE KEY UQ_password_reset_tokens_hash (token_hash),
        KEY IDX_password_reset_tokens_tenant_user (tenant_id, user_id)`,
      ),
    );

    await queryRunner.query(
      this.table(
        'audit_logs',
        `
        user_id VARCHAR(36) NULL,
        user_name VARCHAR(150) NULL,
        action VARCHAR(30) NOT NULL,
        resource VARCHAR(60) NOT NULL,
        resource_id VARCHAR(36) NULL,
        description VARCHAR(255) NULL,
        changes TEXT NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        request_id VARCHAR(64) NULL,
        KEY IDX_audit_logs_tenant (tenant_id),
        KEY IDX_audit_logs_action (action),
        KEY IDX_audit_logs_resource (tenant_id, resource, resource_id),
        KEY IDX_audit_logs_created (tenant_id, created_at)`,
      ),
    );

    // ---------------------------------------------------------------------
    // Estrutura fisica
    // ---------------------------------------------------------------------
    await queryRunner.query(
      this.table(
        'blocks',
        `
        condominium_id VARCHAR(36) NOT NULL,
        name VARCHAR(80) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'BLOCK',
        description VARCHAR(255) NULL,
        floors INT NOT NULL DEFAULT 1,
        units_per_floor INT NOT NULL DEFAULT 0,
        has_elevator TINYINT(1) NOT NULL DEFAULT 0,
        UNIQUE KEY UQ_blocks_tenant_condominium_name (tenant_id, condominium_id, name),
        KEY IDX_blocks_tenant (tenant_id),
        CONSTRAINT FK_blocks_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'units',
        `
        condominium_id VARCHAR(36) NOT NULL,
        block_id VARCHAR(36) NOT NULL,
        number VARCHAR(20) NOT NULL,
        floor INT NOT NULL DEFAULT 0,
        type VARCHAR(20) NOT NULL DEFAULT 'APARTMENT',
        status VARCHAR(20) NOT NULL DEFAULT 'VACANT',
        area DECIMAL(10,2) NULL,
        ideal_fraction DECIMAL(10,6) NULL,
        monthly_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        bedrooms INT NOT NULL DEFAULT 0,
        parking_spots INT NOT NULL DEFAULT 0,
        pets_allowed TINYINT(1) NOT NULL DEFAULT 1,
        notes TEXT NULL,
        UNIQUE KEY UQ_units_tenant_block_number (tenant_id, block_id, number),
        KEY IDX_units_tenant (tenant_id),
        KEY IDX_units_tenant_condominium (tenant_id, condominium_id),
        CONSTRAINT FK_units_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE,
        CONSTRAINT FK_units_block FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE CASCADE`,
      ),
    );

    // ---------------------------------------------------------------------
    // Pessoas
    // ---------------------------------------------------------------------
    await queryRunner.query(
      this.table(
        'residents',
        `
        condominium_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NULL,
        name VARCHAR(150) NOT NULL,
        document VARCHAR(11) NULL,
        email VARCHAR(180) NULL,
        phone VARCHAR(20) NULL,
        birth_date DATE NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'OWNER',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        move_in_date DATE NULL,
        move_out_date DATE NULL,
        emergency_contact VARCHAR(150) NULL,
        emergency_phone VARCHAR(20) NULL,
        photo_url VARCHAR(255) NULL,
        lgpd_consent_at DATETIME NULL,
        notes TEXT NULL,
        KEY IDX_residents_tenant (tenant_id),
        KEY IDX_residents_tenant_condominium (tenant_id, condominium_id),
        KEY IDX_residents_tenant_document (tenant_id, document),
        CONSTRAINT FK_residents_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'dependents',
        `
        condominium_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        resident_id VARCHAR(36) NOT NULL,
        name VARCHAR(150) NOT NULL,
        relationship VARCHAR(20) NOT NULL DEFAULT 'OTHER',
        document VARCHAR(11) NULL,
        birth_date DATE NULL,
        phone VARCHAR(20) NULL,
        photo_url VARCHAR(255) NULL,
        has_access_card TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        KEY IDX_dependents_tenant (tenant_id),
        KEY IDX_dependents_tenant_resident (tenant_id, resident_id),
        CONSTRAINT FK_dependents_resident FOREIGN KEY (resident_id) REFERENCES residents (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'employees',
        `
        condominium_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NULL,
        name VARCHAR(150) NOT NULL,
        document VARCHAR(11) NULL,
        position VARCHAR(100) NOT NULL,
        department VARCHAR(100) NULL,
        contract_type VARCHAR(20) NOT NULL DEFAULT 'CLT',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        email VARCHAR(180) NULL,
        phone VARCHAR(20) NULL,
        admission_date DATE NULL,
        termination_date DATE NULL,
        work_schedule VARCHAR(120) NULL,
        salary DECIMAL(12,2) NULL,
        photo_url VARCHAR(255) NULL,
        notes TEXT NULL,
        KEY IDX_employees_tenant (tenant_id),
        KEY IDX_employees_tenant_condominium (tenant_id, condominium_id),
        CONSTRAINT FK_employees_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'service_providers',
        `
        condominium_id VARCHAR(36) NOT NULL,
        company_name VARCHAR(150) NOT NULL,
        trade_name VARCHAR(150) NULL,
        document VARCHAR(14) NULL,
        service_type VARCHAR(100) NOT NULL,
        contact_name VARCHAR(150) NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(180) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        contract_start DATE NULL,
        contract_end DATE NULL,
        rating INT NULL,
        notes TEXT NULL,
        KEY IDX_service_providers_tenant (tenant_id),
        KEY IDX_service_providers_tenant_condominium (tenant_id, condominium_id),
        CONSTRAINT FK_service_providers_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'visitors',
        `
        condominium_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        name VARCHAR(150) NOT NULL,
        document VARCHAR(11) NULL,
        phone VARCHAR(20) NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'VISITOR',
        status VARCHAR(20) NOT NULL DEFAULT 'EXPECTED',
        company VARCHAR(120) NULL,
        vehicle_plate VARCHAR(10) NULL,
        expected_at DATETIME NULL,
        expected_until DATETIME NULL,
        checked_in_at DATETIME NULL,
        checked_out_at DATETIME NULL,
        authorized_by_id VARCHAR(36) NULL,
        authorized_by_name VARCHAR(150) NULL,
        registered_by_id VARCHAR(36) NULL,
        badge_number VARCHAR(30) NULL,
        photo_url VARCHAR(255) NULL,
        access_code VARCHAR(12) NULL,
        notes TEXT NULL,
        KEY IDX_visitors_tenant (tenant_id),
        KEY IDX_visitors_tenant_condominium_status (tenant_id, condominium_id, status),
        KEY IDX_visitors_tenant_document (tenant_id, document),
        CONSTRAINT FK_visitors_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'vehicles',
        `
        condominium_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NULL,
        resident_id VARCHAR(36) NULL,
        plate VARCHAR(10) NOT NULL,
        brand VARCHAR(60) NULL,
        model VARCHAR(60) NULL,
        color VARCHAR(40) NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'CAR',
        year INT NULL,
        parking_spot VARCHAR(20) NULL,
        sticker_number VARCHAR(30) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        notes TEXT NULL,
        UNIQUE KEY UQ_vehicles_tenant_plate (tenant_id, plate),
        KEY IDX_vehicles_tenant_condominium (tenant_id, condominium_id),
        CONSTRAINT FK_vehicles_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE SET NULL`,
      ),
    );

    await queryRunner.query(
      this.table(
        'correspondences',
        `
        condominium_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        resident_id VARCHAR(36) NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'PACKAGE',
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        carrier VARCHAR(120) NULL,
        tracking_code VARCHAR(60) NULL,
        description VARCHAR(255) NULL,
        received_at DATETIME NOT NULL,
        received_by VARCHAR(150) NULL,
        delivered_at DATETIME NULL,
        delivered_to VARCHAR(150) NULL,
        photo_url VARCHAR(255) NULL,
        notes TEXT NULL,
        KEY IDX_correspondences_tenant (tenant_id),
        KEY IDX_correspondences_tenant_condominium_status (tenant_id, condominium_id, status),
        CONSTRAINT FK_correspondences_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE`,
      ),
    );

    // ---------------------------------------------------------------------
    // Areas comuns e reservas
    // ---------------------------------------------------------------------
    await queryRunner.query(
      this.table(
        'common_areas',
        `
        condominium_id VARCHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT NULL,
        capacity INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
        requires_approval TINYINT(1) NOT NULL DEFAULT 1,
        reservation_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        opens_at VARCHAR(5) NOT NULL DEFAULT '08:00',
        closes_at VARCHAR(5) NOT NULL DEFAULT '22:00',
        available_weekdays TEXT NULL,
        min_hours INT NOT NULL DEFAULT 1,
        max_hours INT NOT NULL DEFAULT 6,
        advance_booking_days INT NOT NULL DEFAULT 60,
        min_interval_days INT NOT NULL DEFAULT 0,
        photo_url VARCHAR(255) NULL,
        rules TEXT NULL,
        KEY IDX_common_areas_tenant (tenant_id),
        KEY IDX_common_areas_tenant_condominium (tenant_id, condominium_id),
        CONSTRAINT FK_common_areas_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'reservations',
        `
        condominium_id VARCHAR(36) NOT NULL,
        common_area_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        requested_by_id VARCHAR(36) NOT NULL,
        requested_by_name VARCHAR(150) NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        guests_count INT NOT NULL DEFAULT 0,
        fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        paid_at DATETIME NULL,
        reviewed_by_id VARCHAR(36) NULL,
        reviewed_at DATETIME NULL,
        status_reason VARCHAR(255) NULL,
        notes TEXT NULL,
        KEY IDX_reservations_tenant (tenant_id),
        KEY IDX_reservations_area_period (tenant_id, common_area_id, starts_at),
        KEY IDX_reservations_condominium_status (tenant_id, condominium_id, status),
        CONSTRAINT FK_reservations_common_area FOREIGN KEY (common_area_id) REFERENCES common_areas (id) ON DELETE CASCADE,
        CONSTRAINT FK_reservations_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE`,
      ),
    );

    // ---------------------------------------------------------------------
    // Financeiro
    // ---------------------------------------------------------------------
    await queryRunner.query(
      this.table(
        'financial_categories',
        `
        condominium_id VARCHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        kind VARCHAR(20) NOT NULL DEFAULT 'EXPENSE',
        code VARCHAR(20) NULL,
        color VARCHAR(20) NULL,
        description VARCHAR(255) NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        UNIQUE KEY UQ_financial_categories_name (tenant_id, condominium_id, name),
        KEY IDX_financial_categories_tenant (tenant_id),
        CONSTRAINT FK_financial_categories_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'charges',
        `
        condominium_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        category_id VARCHAR(36) NULL,
        resident_id VARCHAR(36) NULL,
        description VARCHAR(180) NOT NULL,
        reference_month VARCHAR(7) NOT NULL,
        due_date DATE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        interest DECIMAL(12,2) NOT NULL DEFAULT 0,
        penalty DECIMAL(12,2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        paid_at DATETIME NULL,
        payment_method VARCHAR(20) NULL,
        barcode VARCHAR(60) NULL,
        invoice_url VARCHAR(255) NULL,
        notes TEXT NULL,
        KEY IDX_charges_tenant (tenant_id),
        KEY IDX_charges_condominium_status (tenant_id, condominium_id, status),
        KEY IDX_charges_unit_reference (tenant_id, unit_id, reference_month),
        KEY IDX_charges_due_date (tenant_id, due_date),
        CONSTRAINT FK_charges_unit FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE CASCADE,
        CONSTRAINT FK_charges_category FOREIGN KEY (category_id) REFERENCES financial_categories (id) ON DELETE SET NULL`,
      ),
    );

    await queryRunner.query(
      this.table(
        'payments',
        `
        condominium_id VARCHAR(36) NOT NULL,
        charge_id VARCHAR(36) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        paid_at DATETIME NOT NULL,
        method VARCHAR(20) NOT NULL DEFAULT 'PIX',
        receipt_url VARCHAR(255) NULL,
        registered_by_id VARCHAR(36) NULL,
        transaction_id VARCHAR(80) NULL,
        notes TEXT NULL,
        KEY IDX_payments_tenant (tenant_id),
        KEY IDX_payments_tenant_charge (tenant_id, charge_id),
        CONSTRAINT FK_payments_charge FOREIGN KEY (charge_id) REFERENCES charges (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'expenses',
        `
        condominium_id VARCHAR(36) NOT NULL,
        category_id VARCHAR(36) NULL,
        service_provider_id VARCHAR(36) NULL,
        description VARCHAR(180) NOT NULL,
        competence VARCHAR(7) NOT NULL,
        due_date DATE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        paid_at DATETIME NULL,
        payment_method VARCHAR(20) NULL,
        document_url VARCHAR(255) NULL,
        document_number VARCHAR(60) NULL,
        is_recurring TINYINT(1) NOT NULL DEFAULT 0,
        notes TEXT NULL,
        KEY IDX_expenses_tenant (tenant_id),
        KEY IDX_expenses_condominium_status (tenant_id, condominium_id, status),
        KEY IDX_expenses_condominium_competence (tenant_id, condominium_id, competence),
        CONSTRAINT FK_expenses_category FOREIGN KEY (category_id) REFERENCES financial_categories (id) ON DELETE SET NULL,
        CONSTRAINT FK_expenses_provider FOREIGN KEY (service_provider_id) REFERENCES service_providers (id) ON DELETE SET NULL`,
      ),
    );

    // ---------------------------------------------------------------------
    // Assembleias e votacoes
    // ---------------------------------------------------------------------
    await queryRunner.query(
      this.table(
        'assemblies',
        `
        condominium_id VARCHAR(36) NOT NULL,
        title VARCHAR(180) NOT NULL,
        description TEXT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'ORDINARY',
        status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
        mode VARCHAR(20) NOT NULL DEFAULT 'HYBRID',
        scheduled_at DATETIME NOT NULL,
        second_call_at DATETIME NULL,
        location VARCHAR(180) NULL,
        online_url VARCHAR(255) NULL,
        quorum_percent INT NOT NULL DEFAULT 50,
        agenda_url VARCHAR(255) NULL,
        minutes_url VARCHAR(255) NULL,
        started_at DATETIME NULL,
        finished_at DATETIME NULL,
        attendees_count INT NOT NULL DEFAULT 0,
        KEY IDX_assemblies_tenant (tenant_id),
        KEY IDX_assemblies_condominium_status (tenant_id, condominium_id, status),
        CONSTRAINT FK_assemblies_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'polls',
        `
        condominium_id VARCHAR(36) NOT NULL,
        assembly_id VARCHAR(36) NULL,
        title VARCHAR(180) NOT NULL,
        description TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        voter_type VARCHAR(20) NOT NULL DEFAULT 'OWNERS',
        weighted_by_fraction TINYINT(1) NOT NULL DEFAULT 0,
        is_secret TINYINT(1) NOT NULL DEFAULT 0,
        allow_multiple TINYINT(1) NOT NULL DEFAULT 0,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        quorum_percent INT NOT NULL DEFAULT 0,
        total_votes INT NOT NULL DEFAULT 0,
        eligible_units INT NOT NULL DEFAULT 0,
        results_published_at DATETIME NULL,
        KEY IDX_polls_tenant (tenant_id),
        KEY IDX_polls_condominium_status (tenant_id, condominium_id, status),
        CONSTRAINT FK_polls_assembly FOREIGN KEY (assembly_id) REFERENCES assemblies (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'poll_options',
        `
        poll_id VARCHAR(36) NOT NULL,
        label VARCHAR(180) NOT NULL,
        description VARCHAR(255) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        votes_count INT NOT NULL DEFAULT 0,
        votes_weight DECIMAL(12,6) NOT NULL DEFAULT 0,
        KEY IDX_poll_options_tenant (tenant_id),
        KEY IDX_poll_options_tenant_poll (tenant_id, poll_id),
        CONSTRAINT FK_poll_options_poll FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'votes',
        `
        poll_id VARCHAR(36) NOT NULL,
        option_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NOT NULL,
        voter_id VARCHAR(36) NULL,
        voter_name VARCHAR(150) NULL,
        weight DECIMAL(12,6) NOT NULL DEFAULT 1,
        voted_at DATETIME NOT NULL,
        ip_address VARCHAR(64) NULL,
        UNIQUE KEY UQ_votes_poll_unit (tenant_id, poll_id, unit_id),
        KEY IDX_votes_tenant (tenant_id),
        CONSTRAINT FK_votes_poll FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE,
        CONSTRAINT FK_votes_option FOREIGN KEY (option_id) REFERENCES poll_options (id) ON DELETE CASCADE`,
      ),
    );

    // ---------------------------------------------------------------------
    // Comunicacao e operacao
    // ---------------------------------------------------------------------
    await queryRunner.query(
      this.table(
        'announcements',
        `
        condominium_id VARCHAR(36) NOT NULL,
        title VARCHAR(180) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        audience VARCHAR(20) NOT NULL DEFAULT 'ALL',
        target_block_ids TEXT NULL,
        pinned TINYINT(1) NOT NULL DEFAULT 0,
        published_at DATETIME NULL,
        expires_at DATETIME NULL,
        author_id VARCHAR(36) NULL,
        author_name VARCHAR(150) NULL,
        attachment_url VARCHAR(255) NULL,
        reads_count INT NOT NULL DEFAULT 0,
        KEY IDX_announcements_tenant (tenant_id),
        KEY IDX_announcements_condominium_status (tenant_id, condominium_id, status),
        CONSTRAINT FK_announcements_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'incidents',
        `
        condominium_id VARCHAR(36) NOT NULL,
        unit_id VARCHAR(36) NULL,
        protocol VARCHAR(20) NOT NULL,
        title VARCHAR(180) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(20) NOT NULL DEFAULT 'OTHER',
        priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        reported_by_id VARCHAR(36) NULL,
        reported_by_name VARCHAR(150) NULL,
        is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
        assigned_to_id VARCHAR(36) NULL,
        occurred_at DATETIME NULL,
        resolved_at DATETIME NULL,
        resolution TEXT NULL,
        attachments TEXT NULL,
        location VARCHAR(180) NULL,
        UNIQUE KEY UQ_incidents_protocol (tenant_id, protocol),
        KEY IDX_incidents_tenant (tenant_id),
        KEY IDX_incidents_condominium_status (tenant_id, condominium_id, status),
        CONSTRAINT FK_incidents_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'maintenances',
        `
        condominium_id VARCHAR(36) NOT NULL,
        title VARCHAR(180) NOT NULL,
        description TEXT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'PREVENTIVE',
        status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
        recurrence VARCHAR(20) NOT NULL DEFAULT 'NONE',
        asset_name VARCHAR(150) NULL,
        service_provider_id VARCHAR(36) NULL,
        responsible_id VARCHAR(36) NULL,
        scheduled_for DATETIME NOT NULL,
        started_at DATETIME NULL,
        completed_at DATETIME NULL,
        next_execution_at DATE NULL,
        estimated_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
        final_cost DECIMAL(12,2) NULL,
        attachments TEXT NULL,
        notes TEXT NULL,
        KEY IDX_maintenances_tenant (tenant_id),
        KEY IDX_maintenances_condominium_status (tenant_id, condominium_id, status),
        CONSTRAINT FK_maintenances_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE,
        CONSTRAINT FK_maintenances_provider FOREIGN KEY (service_provider_id) REFERENCES service_providers (id) ON DELETE SET NULL`,
      ),
    );

    await queryRunner.query(
      this.table(
        'documents',
        `
        condominium_id VARCHAR(36) NOT NULL,
        title VARCHAR(180) NOT NULL,
        description VARCHAR(255) NULL,
        category VARCHAR(20) NOT NULL DEFAULT 'OTHER',
        visibility VARCHAR(20) NOT NULL DEFAULT 'RESIDENTS',
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NOT NULL,
        size_bytes INT NOT NULL DEFAULT 0,
        version INT NOT NULL DEFAULT 1,
        uploaded_by_id VARCHAR(36) NULL,
        expires_at DATE NULL,
        downloads_count INT NOT NULL DEFAULT 0,
        tags TEXT NULL,
        KEY IDX_documents_tenant (tenant_id),
        KEY IDX_documents_condominium_category (tenant_id, condominium_id, category),
        CONSTRAINT FK_documents_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums (id) ON DELETE CASCADE`,
      ),
    );

    await queryRunner.query(
      this.table(
        'notifications',
        `
        user_id VARCHAR(36) NOT NULL,
        condominium_id VARCHAR(36) NULL,
        title VARCHAR(180) NOT NULL,
        message VARCHAR(500) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'INFO',
        resource VARCHAR(60) NULL,
        resource_id VARCHAR(36) NULL,
        action_url VARCHAR(255) NULL,
        read_at DATETIME NULL,
        KEY IDX_notifications_tenant (tenant_id),
        KEY IDX_notifications_user_read (tenant_id, user_id, read_at),
        CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE`,
      ),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa da criacao para respeitar as chaves estrangeiras.
    const tables = [
      'notifications',
      'documents',
      'maintenances',
      'incidents',
      'announcements',
      'votes',
      'poll_options',
      'polls',
      'assemblies',
      'expenses',
      'payments',
      'charges',
      'financial_categories',
      'reservations',
      'common_areas',
      'correspondences',
      'vehicles',
      'visitors',
      'service_providers',
      'employees',
      'dependents',
      'residents',
      'units',
      'blocks',
      'audit_logs',
      'password_reset_tokens',
      'refresh_tokens',
      'user_condominiums',
      'users',
      'condominiums',
      'roles',
      'tenants',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }
}
