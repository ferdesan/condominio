---
status: completed
title: "Migration + RBAC LGPD"
type: backend
complexity: low
---

# Migration + RBAC LGPD

## Overview

Create the database foundation for LGPD compliance by adding two new tables (`lgpd_requests`, `lgpd_consents`) via a TypeORM migration, and register the new LGPD resources and permissions in the RBAC system. This task establishes the data layer that all subsequent LGPD tasks build upon.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create a new TypeORM migration file `1757700000000-LgpdTables.ts` following the existing migration pattern in `backend/src/database/migrations/1757600000000-InitialSchema.ts`
- MUST create `lgpd_requests` table with columns: id, created_at, updated_at, deleted_at, tenant_id, condominium_id, resident_id, status, requested_at, executed_at, cancelled_at, notes
- MUST create `lgpd_consents` table with columns: id, created_at, updated_at, deleted_at, tenant_id, resident_id, consent_type, granted, granted_at, revoked_at, ip_address, description
- MUST add foreign key constraints: lgpd_requests → condominiums (ON DELETE CASCADE), lgpd_requests → residents (ON DELETE CASCADE), lgpd_consents → residents (ON DELETE CASCADE)
- MUST add unique constraint on lgpd_consents: (resident_id, consent_type)
- MUST add indexes: IDX_lgpd_requests_tenant, IDX_lgpd_requests_tenant_condominium, IDX_lgpd_requests_resident, IDX_lgpd_requests_status, IDX_lgpd_consents_tenant
- MUST add `'lgpd-request'` and `'lgpd-consent'` to the RESOURCES array in `resources.ts`
- MUST add LGPD permissions to all 5 system roles in `roles.ts`
- MUST implement `down()` method to drop both tables in reverse FK order
</requirements>

## Subtasks

- [x] 1.1 Create migration file `1757700000000-LgpdTables.ts` with `lgpd_requests` table
- [x] 1.2 Add `lgpd_consents` table to the same migration
- [x] 1.3 Add foreign key constraints and indexes
- [x] 1.4 Add `'lgpd-request'` and `'lgpd-consent'` to RESOURCES in `resources.ts`
- [x] 1.5 Add LGPD permissions to ROLE_ADMIN, ROLE_SINDICO, ROLE_RESIDENT in `roles.ts`
- [x] 1.6 Implement `down()` to drop both tables
- [x] 1.7 Verify migration runs successfully with `npm --prefix backend run typeorm migration:run`

## Implementation Details

### Relevant Files
- `backend/src/database/migrations/1757600000000-InitialSchema.ts` — Reference for migration pattern (table helper, base columns, FK convention)
- `backend/src/shared/constants/resources.ts` — Add new resource names
- `backend/src/shared/constants/roles.ts` — Add permissions to system roles
- `backend/src/shared/entities/tenant-scoped.entity.ts` — Reference for tenantBase column template
- `backend/src/config/data-source.ts` — Migration runner config

### Dependent Files
- `backend/src/modules/lgpd/` — New module that will use these tables (Task 2)

### Related ADRs
- [ADR-001: LGPD Data Deletion Strategy](../adrs/adr-001.md) — Deletion request lifecycle
- [ADR-004: LGPD Module Structure](../adrs/adr-004.md) — Two entities in one module

## Deliverables
- Migration file `1757700000000-LgpdTables.ts` with both tables
- Updated `resources.ts` with 2 new resources
- Updated `roles.ts` with LGPD permissions for all 5 roles
- Migration runs successfully on fresh database

## Tests

No test cases assigned to this task — it is infrastructure only.

## Success Criteria
- `lgpd_requests` table created with all columns, indexes, and FK constraints
- `lgpd_consents` table created with unique constraint on (resident_id, consent_type)
- All 5 system roles have appropriate LGPD permissions
- Migration runs without errors and can be rolled back via `down()`
- Existing tests still pass after migration
