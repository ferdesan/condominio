---
status: completed
title: 'Backend LGPD Module'
type: backend
complexity: high
---

# Backend LGPD Module

## Overview

Implement the complete LGPD backend module with entities, repositories, anonymization logic, Zod schemas, service layer, and custom routes. This is the core compliance engine: deletion request lifecycle, data export, and consent management. The module follows the existing codebase patterns (BaseRepository, CondominiumScopedService, validate middleware) and integrates with existing repositories for the anonymization cascade.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `LgpdRequest` entity extending `TenantScopedEntity` with status lifecycle (PENDING → EXECUTED/CANCELLED)
- MUST create `LgpdConsent` entity extending `TenantScopedEntity` with unique constraint on (residentId, consentType)
- MUST create `LgpdRequestRepository` extending `BaseRepository<LgpdRequest>` with condominium scoping
- MUST create `LgpdConsentRepository` extending `BaseRepository<LgpdConsent>`
- MUST implement `anonymizePersonalData()` function that replaces personal fields with REDACTED values in a single transaction
- MUST cascade anonymization to dependents and vehicles
- MUST preserve financial records (charges, payments) with anonymized resident name
- MUST create Zod schemas for all request/response types
- MUST implement `LgpdService` with methods: createDeleteRequest, listDeleteRequests, executeDelete, cancelDeleteRequest, exportResidentData, getConsent, updateConsent
- MUST prevent duplicate PENDING requests per resident (ConflictError)
- MUST prevent execution of already-executed or cancelled requests
- MUST log all LGPD operations in audit trail (LGPD_DELETE_REQUEST, LGPD_DELETE, LGPD_DELETE_CANCEL, LGPD_EXPORT, LGPD_CONSENT_GRANTED, LGPD_CONSENT_REVOKED)
- MUST register router at `/lgpd` in `routes/index.ts`
- MUST use custom routes (not createCrudRouter) since endpoints are non-standard CRUD
- MUST implement all unit tests (UT-001 to UT-023) and integration tests (IT-001 to IT-048) assigned to this task
</requirements>

## Subtasks

- [x] 2.1 Create `lgpd-request.entity.ts` with status enum and relations
- [x] 2.2 Create `lgpd-consent.entity.ts` with unique constraint
- [x] 2.3 Create `lgpd-request.repository.ts` with condominium scoping
- [x] 2.4 Create `lgpd-consent.repository.ts`
- [x] 2.5 Create `anonymize.ts` with transaction-based personal data anonymization
- [x] 2.6 Create `lgpd.schema.ts` with Zod schemas for all endpoints
- [x] 2.7 Create `lgpd.service.ts` orchestrating deletion, export, and consent
- [x] 2.8 Create `lgpd.routes.ts` with custom Express routes
- [x] 2.9 Register router in `routes/index.ts`
- [x] 2.10 Implement unit tests for anonymize function and schema validation
- [x] 2.11 Implement integration tests for all LGPD API endpoints
- [x] 2.12 Verify all tests pass

## Implementation Details

### Relevant Files

- `backend/src/shared/entities/tenant-scoped.entity.ts` — Base entity to extend
- `backend/src/shared/repositories/base.repository.ts` — Base repository with CRUD, pagination, tenant scoping
- `backend/src/shared/services/base-crud.service.ts` — Service base class with hooks and audit
- `backend/src/shared/http/crud-router.ts` — Reference for route pattern (not used here, custom routes instead)
- `backend/src/shared/http/base-crud.controller.ts` — Controller pattern reference
- `backend/src/shared/dto/common.schema.ts` — Shared Zod schemas (uuidSchema, emailSchema, etc.)
- `backend/src/shared/errors/app-error.ts` — Error classes (ConflictError, BusinessRuleError, etc.)
- `backend/src/middlewares/auth.middleware.ts` — authorize() middleware
- `backend/src/middlewares/validate.middleware.ts` — validate() middleware
- `backend/src/modules/residents/resident.entity.ts` — Reference for entity pattern
- `backend/src/modules/residents/resident.repository.ts` — Reference for repository pattern
- `backend/src/modules/residents/resident.service.ts` — Reference for service pattern
- `backend/src/modules/residents/resident.schema.ts` — Reference for schema pattern
- `backend/src/modules/residents/resident.routes.ts` — Reference for route pattern
- `backend/src/modules/residents/resident.repository.ts` — Import for anonymization cascade
- `backend/src/modules/dependents/dependent.repository.ts` — Import for anonymization cascade
- `backend/src/modules/vehicles/vehicle.repository.ts` — Import for anonymization cascade
- `backend/src/modules/financial/` — Charge and payment repositories for export

### Dependent Files

- `frontend/src/features/lgpd/` — Frontend module that will consume these APIs (Task 3)
- `backend/tests/integration/lgpd.spec.ts` — Integration tests

### Related ADRs

- [ADR-001: LGPD Data Deletion Strategy](../adrs/adr-001.md) — Anonymization approach
- [ADR-002: LGPD Data Export Format](../adrs/adr-002.md) — JSON export structure
- [ADR-004: LGPD Module Structure](../adrs/adr-004.md) — Single module with sub-routes

## Deliverables

- 6 backend source files: entity×2, repository×2, anonymize.ts, schema.ts, service.ts, routes.ts
- Updated `routes/index.ts` with `/lgpd` registration
- Unit test file `backend/tests/unit/lgpd-anonymize.spec.ts`
- Integration test file `backend/tests/integration/lgpd.spec.ts`
- All assigned test cases implemented and passing

## Tests

Cases assigned from `_tests.md`:

- [x] UT-001, UT-002, UT-003, UT-004, UT-005, UT-006, UT-007, UT-008, UT-009, UT-010, UT-011 — anonymizePersonalData function and LgpdService methods
- [x] UT-012, UT-013, UT-014, UT-015, UT-016, UT-017, UT-018, UT-019, UT-020, UT-021 — Export data structure validation
- [x] UT-022, UT-023 — Consent update with warnings
- [x] IT-001, IT-002, IT-003, IT-004, IT-005, IT-006, IT-007 — Deletion request creation
- [x] IT-008, IT-009, IT-010, IT-011, IT-012, IT-013, IT-014, IT-015 — Deletion execution
- [x] IT-016, IT-017, IT-018, IT-019 — Deletion request history
- [x] IT-020, IT-021, IT-022, IT-023 — Deletion cancellation
- [x] IT-024 — Financial record preservation
- [x] IT-025, IT-026, IT-027, IT-028, IT-029, IT-030, IT-031, IT-032 — Data export
- [x] IT-033, IT-034, IT-035, IT-036, IT-037, IT-038, IT-039, IT-040 — Export on behalf
- [x] IT-041, IT-042, IT-043, IT-044, IT-045, IT-046, IT-047, IT-048 — Consent management

## Success Criteria

- All LGPD API endpoints functional and tested
- Anonymization cascade works correctly (resident → dependents → vehicles)
- Financial records preserved after anonymization
- Duplicate request prevention works
- All 23 unit tests and 48 integration tests pass
