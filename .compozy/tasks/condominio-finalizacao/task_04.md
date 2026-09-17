---
status: completed
title: "Backend Integration Tests (4 Modulos)"
type: test
complexity: medium
---

# Backend Integration Tests (4 Modulos)

## Overview

Create comprehensive integration test suites for the 4 backend modules that currently lack dedicated integration tests: dependents, employees, service-providers, and residents. Each module gets a dedicated spec file covering CRUD operations, validation, soft delete, restore, tenant isolation, pagination, and search. These tests use the existing sql.js in-memory database setup and follow the patterns established by existing integration tests.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `backend/tests/integration/dependents.spec.ts` covering CRUD, validation, soft delete, tenant isolation
- MUST create `backend/tests/integration/employees.spec.ts` covering CRUD, validation, contract types, soft delete, tenant isolation
- MUST create `backend/tests/integration/service-providers.spec.ts` covering CRUD, validation, CNPJ check, soft delete, tenant isolation
- MUST create `backend/tests/integration/residents.spec.ts` covering CRUD, unit linkage, validation, soft delete, cascade to dependents, tenant isolation
- MUST follow existing test patterns from `backend/tests/integration/` (setup, teardown, test data creation)
- MUST use sql.js in-memory database (existing `backend/tests/setup.ts`)
- MUST test tenant isolation for all modules (cross-tenant access blocked)
- MUST test validation errors (invalid CPF, missing required fields, duplicate documents)
- MUST test soft delete and restore operations
- MUST test pagination and search functionality
- MUST implement all assigned IT cases (IT-049 to IT-052)
</requirements>

## Subtasks

- [x] 4.1 Create `dependents.spec.ts` with CRUD tests, validation, tenant isolation, cascade
- [x] 4.2 Create `employees.spec.ts` with CRUD tests, contract types, validation, tenant isolation
- [x] 4.3 Create `service-providers.spec.ts` with CRUD tests, CNPJ validation, tenant isolation
- [x] 4.4 Create `residents.spec.ts` with CRUD tests, unit linkage, cascade to dependents, tenant isolation
- [x] 4.5 Verify all new tests pass
- [x] 4.6 Verify existing tests still pass (no regressions)

## Implementation Details

### Relevant Files
- `backend/tests/integration/auth.spec.ts` — Reference for test setup pattern (beforeAll, beforeEach, seed data)
- `backend/tests/integration/condominium-structure.spec.ts` — Reference for CRUD test pattern
- `backend/tests/integration/operations.spec.ts` — Reference for multi-module test pattern
- `backend/tests/setup.ts` — Test database setup (sql.js in-memory)
- `backend/src/modules/dependents/` — Module under test
- `backend/src/modules/employees/` — Module under test
- `backend/src/modules/service-providers/` — Module under test
- `backend/src/modules/residents/` — Module under test

### Dependent Files
- None originally (tests were expected to be standalone). Runtime was extended minimally to satisfy two assigned test contracts that cannot pass against the current runtime:
  - `EmployeeService`/`EmployeeRepository` — added `documentTaken` + duplicate-CPF check (`ConflictError`, 409) for IT-050.E3
  - `ResidentService`/`DependentRepository` — added cascade soft-delete of dependents on resident removal (`afterRemove` → `softDeleteByResidentId`) for IT-049.E3 / IT-052.E4 (restore does NOT cascade, per US-015 EC-6)
  - `tests/helpers/test-context.ts` — `login()` now accepts an optional `tenantSlug` (default `demo`) to enable cross-tenant isolation scenarios
  - Added `tests/helpers/test-data.ts` — valid-CPF/CNPJ generators (`isValidCpf`/`isValidCnpj` algorithms) and `registerIsolatedTenant()` (self-service `POST /auth/register` + condominium/block/unit scaffolding)

### Progress / Implementation Summary
- Created 4 spec files implementing all 16 assigned cases (IT-049..IT-052 + edge cases). All comments in pt-BR matching codebase conventions.
- Conflict resolutions recorded per Authority ladder (`_tests.md` says "400 validation error"; runtime coupling wins):
  - Schema/format validation errors (invalid CPF format, negative salary, invalid CNPJ format) assert **422 VALIDATION_ERROR** — machine-checkable `ValidationError` class, consistent with `condominium-structure.spec.ts`
  - Algorithmic document validation (resident `isValidCpf`) asserts **409 BUSINESS_RULE_VIOLATION** (matches existing `ResidentService` rule)
  - Duplicate CPF for employees: runtime had no enforcement → extended with **409 CONFLICT** per IT-050.E3
- Verification: `npx tsc --noEmit` clean, `npm run lint` clean, full `npm test -- --runInBand` = **246/246 passing** (230 pre-existing + 16 new, zero regressions).

### Related ADRs
- [ADR-003: Testing Priority Strategy](../adrs/adr-003.md) — Why these 4 modules are prioritized

## Deliverables
- `backend/tests/integration/dependents.spec.ts`
- `backend/tests/integration/employees.spec.ts`
- `backend/tests/integration/service-providers.spec.ts`
- `backend/tests/integration/residents.spec.ts`
- All assigned test cases implemented and passing

## Tests

Cases assigned from `_tests.md`:

- [x] IT-049, IT-049.E1, IT-049.E2, IT-049.E3 — Dependents CRUD, tenant isolation, validation, cascade
- [x] IT-050, IT-050.E1, IT-050.E2, IT-050.E3 — Employees CRUD, tenant isolation, validation, duplicate CPF
- [x] IT-051, IT-051.E1, IT-051.E2 — Service-providers CRUD, tenant isolation, CNPJ validation
- [x] IT-052, IT-052.E1, IT-052.E2, IT-052.E3, IT-052.E4 — Residents CRUD, tenant isolation, unit linkage, validation, cascade

## Success Criteria
- All 4 new spec files created and passing
- Each module tested for: create, read, update, soft delete, restore, tenant isolation, validation
- No regressions in existing test suite
- Test database setup/teardown works correctly
