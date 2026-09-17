# PRD: Condominio SaaS — Finalizacao (LGPD + Testes)

## Overview

The condominium SaaS platform is functionally complete with 25+ backend modules, 21+ frontend feature pages, and a solid DevOps pipeline. However, two critical gaps remain: **LGPD legal compliance** (data subject rights for deletion, export, and consent) and **test coverage** (4 backend modules without integration tests, critical frontend infrastructure untested). This PRD formalizes the work to close these gaps and bring the platform to production-ready status.

The platform serves condominium administrators (SINDICO, ADMIN), residents (MORADOR), and platform operators (SUPER_ADMIN). Residents need LGPD rights exercised through the UI. The system must comply with LGPD Articles 8, 16, 18, 37, and 41. Test coverage must be risk-prioritized: security-critical infrastructure first, then high-value business logic, then supporting components.

## Goals

- Residents can request deletion of their personal data, and admins can execute those requests with proper anonymization of personal fields while preserving financial/legal records.
- Residents can export all their personal data in JSON format for portability.
- Residents can view and update their LGPD consent preferences with granular control.
- The platform displays DPO contact information and data retention policy.
- All LGPD operations are logged in the audit trail for accountability.
- The 4 backend modules without integration tests (dependents, employees, service-providers, residents) have full test coverage.
- Critical frontend infrastructure (auth-provider, permissions, ProtectedRoute) has dedicated test coverage.
- High-value untested components (theme-provider, utils, financial module, dashboard) have test coverage.

## User Stories

Full catalog: [_user_stories.md](_user_stories.md)

| Range | Feature Area | Count |
|-------|-------------|-------|
| US-001 to US-005 | LGPD Data Deletion | 5 stories |
| US-006 to US-008 | LGPD Data Export | 3 stories |
| US-009 to US-011 | LGPD Consent Management | 3 stories |
| US-012 to US-015 | Backend Integration Tests | 4 stories |
| US-016 to US-022 | Frontend Critical Tests | 7 stories |
| US-023 to US-024 | Frontend High-Value Tests | 2 stories |
| US-025 | LGPD Configuration | 1 story |

## Core Features

### Feature 1: LGPD Data Deletion

Residents can request deletion of their personal data. The system anonymizes all personally identifiable fields (name, CPF, email, phone, address) and preserves financial/legal records with anonymized identifiers. Admins execute pending requests through a dedicated panel.

**Functional requirements:**
- `POST /lgpd/delete-request` — Resident creates a deletion request
- `GET /lgpd/delete-requests` — Admin lists pending/executed/cancelled requests (scoped to condominium)
- `POST /lgpd/delete-request/:id/execute` — Admin executes anonymization
- `POST /lgpd/delete-request/:id/cancel` — Resident cancels pending request
- Anonymization replaces: name → `REDACTED-{uuid}`, cpf → `000.000.000-00`, email → `redacted@redacted.invalid`, phone → `0000000000`, address → empty
- Cascade to dependents: all linked dependents are anonymized in the same transaction
- Financial records (charges, payments, expenses) preserved with anonymized resident name
- Audit log entry with action `LGPD_DELETE` for every execution

### Feature 2: LGPD Data Export

Residents can download all their personal data in JSON format. The export consolidates data from all related entities (profile, dependents, vehicles, reservations, financial records, correspondences, documents) excluding system fields.

**Functional requirements:**
- `GET /lgpd/export` — Resident exports own data; admin exports resident data for their condominium
- JSON structure: `exportDate`, `platform`, `dataSubject`, `resident`, `dependents`, `vehicles`, `reservations`, `financial` (charges + payments), `correspondences`, `documents`
- System fields (`id`, `tenantId`, `createdAt`, `updatedAt`, `deletedAt`) excluded from export
- Dates in ISO 8601 format
- File download with `Content-Disposition: attachment`
- Audit log entry with action `LGPD_EXPORT`

### Feature 3: LGPD Consent Management

Residents can view their current consent status and update consent preferences. The system provides granular consent control and logs all changes in the audit trail.

**Functional requirements:**
- `GET /lgpd/consent` — Resident views consent status
- `POST /lgpd/consent` — Resident provides or revokes consent
- Consent stored in `lgpdConsentAt` (timestamp of grant) and new `lgpdConsentRevokedAt` (timestamp of revocation)
- Revocation warns about service unavailability
- Audit log entries: `LGPD_CONSENT_GRANTED`, `LGPD_CONSENT_REVOKED`

### Feature 4: LGPD Configuration

Admins can configure DPO contact information and data retention policy in tenant settings.

**Functional requirements:**
- DPO name, email fields in tenant settings
- Data retention period configuration
- DPO contact displayed in resident profile and privacy policy
- Only users with `tenant:update` permission can modify

### Feature 5: Backend Integration Tests (4 Modules)

Complete integration test coverage for the 4 modules currently without tests: dependents, employees, service-providers, residents.

**Functional requirements:**
- Each module gets a dedicated spec file in `backend/tests/integration/`
- Tests cover: CRUD operations, validation, soft delete, restore, tenant isolation, pagination, search
- Tests use the existing `sql.js` in-memory test setup from `backend/tests/setup.ts`
- Test data created via the existing seed infrastructure

### Feature 6: Frontend Critical Infrastructure Tests

Dedicated tests for the 3 most security-critical frontend modules: auth-provider, permissions.ts, ProtectedRoute.

**Functional requirements:**
- `auth-provider` tests: session restore, login, logout, token refresh, session-expired handling
- `permissions.ts` tests: `hasPermission()`, `hasAnyPermission()`, wildcard matching, edge cases
- `ProtectedRoute` tests: initializing state, unauthenticated redirect, unauthorized (ForbiddenPage), authorized (children rendered)

### Feature 7: Frontend High-Value Tests

Tests for theme-provider, query-provider, use-account-theme, utils.ts, financial module components (13), and dashboard components (6).

**Functional requirements:**
- `theme-provider` tests: localStorage persistence, system preference detection, toggle/set theme
- `query-provider` tests: 401 skip, error toasts, retry policy
- `use-account-theme` tests: account theme adoption, device choice override
- `utils.ts` tests: `cn()`, `initials()`, `sleep()`
- Financial component tests: categories, charges, expenses, summary, generate, payment dialogs
- Dashboard component tests: stat-card, activity-feed, charts, tooltip

## Business Rules

### LGPD Deletion

- A resident can have only one pending deletion request at a time.
- Deletion requests can only be executed by users with SINDICO or ADMIN role.
- Anonymization is irreversible once executed.
- Financial records are preserved with anonymized personal fields (legal retention requirement).
- Dependent records are anonymized in the same transaction as the resident.
- Active reservations and charges are not deleted — only personal fields are anonymized.
- All deletion operations are logged in the audit trail.

### LGPD Export

- Residents can only export their own data (enforced by tenant scope and JWT).
- Admins can export data for any resident in their condominium.
- Export includes all personal data across all related entities.
- Export does not include file contents (only metadata for documents).
- All export operations are logged in the audit trail.

### LGPD Consent

- Consent is per-resident, not per-dependent.
- Providing consent updates `lgpdConsentAt` to current timestamp.
- Revoking consent sets `lgpdConsentRevokedAt` to current timestamp.
- Consent revocation warns about service unavailability but does not block the action.
- All consent changes are logged in the audit trail.

### Testing

- Integration tests use the existing `sql.js` in-memory database setup.
- Frontend tests use Vitest + Testing Library with the existing `renderWithProviders` harness.
- All tests must pass before PR merge (CI gate).
- Tests are scoped to the specific module/feature being tested.

## User Experience

### Key Personas

- **Morador (Resident)** — Exercises LGPD rights through their profile page. Clicks "Exportar meus dados" to download JSON. Toggles consent switch with confirmation. Requests data deletion with warning about consequences.
- **Sindico (Building Manager)** — Reviews and executes pending LGPD deletion requests through a dedicated panel. Views deletion history. Configures DPO contact in tenant settings.
- **Admin (Tenant Admin)** — Same as Sindico but with additional access to tenant-level LGPD configuration.
- **SuperAdmin (Platform Admin)** — Cross-tenant access for compliance oversight.

### Primary User Flows

**Data Deletion Flow:**
1. Resident accesses profile → sees "Dados Pessoais" section
2. Clicks "Solicitar exclusão de dados" → confirmation dialog with warnings
3. Confirms → request created with status `PENDING`
4. Sindico/Admin sees pending request in LGPD panel
5. Clicks "Executar" → second confirmation
6. System anonymizes all personal fields in a transaction
7. Status changes to `EXECUTED`, audit log updated

**Data Export Flow:**
1. Resident accesses profile → clicks "Exportar meus dados"
2. System generates JSON with all related data
3. Browser downloads file with timestamp in filename
4. Audit log updated

**Consent Management Flow:**
1. Resident accesses profile → sees "Consentimento LGPD" section
2. Toggles consent switch → confirmation dialog
3. Confirms → consent status updated, audit log updated

### UI/UX Considerations

- All LGPD operations require confirmation dialogs with clear explanations.
- Anonymized records show "Anonimizado" instead of personal data.
- Warning messages explain consequences of deletion/revocation.
- Toast notifications for success/error on all operations.
- Empty states for panels with no requests/data.
- Mobile-responsive design consistent with existing UI patterns.

## High-Level Technical Constraints

- Must integrate with existing TypeORM entities and tenant-scoped repository pattern.
- Must use existing Zod validation schemas and `validate` middleware.
- Must use existing JWT authentication and RBAC authorization middleware.
- Must use existing audit logging service.
- Must use existing React Query hooks and API client (`lib/api.ts`).
- Must use existing test infrastructure (sql.js for backend, Vitest + Testing Library for frontend).
- Must not break existing API contracts or database schema (migration required for new tables).
- Must maintain multi-tenant isolation (row-level security via `tenantId`).

## Non-Goals (Out of Scope)

- **PDF export of personal data** — JSON satisfies LGPD portability; PDF adds unnecessary complexity.
- **Email notifications for LGPD requests** — Can be added later; not required for initial compliance.
- **Automated data retention enforcement** — Manual review flagged by admin; automation is a future enhancement.
- **Full unit test coverage of all ~30 backend services** — Risk-prioritized approach focuses on critical gaps.
- **Test coverage of thin UI wrappers** (Radix primitives, label constants) — Low risk, indirect coverage sufficient.
- **LGPD consent for dependents** — Dependents are managed under the resident's consent; separate consent is out of scope.
- **DPO appointment** — The platform provides the configuration field; the actual appointment is an organizational responsibility.

## Architecture Decision Records

- [ADR-001: LGPD Data Deletion Strategy](adrs/adr-001.md) — Real anonymization + preservation of financial records
- [ADR-002: LGPD Data Export Format](adrs/adr-002.md) — JSON as the sole export format
- [ADR-003: Testing Priority Strategy](adrs/adr-003.md) — Risk-based tiered testing approach

## Open Questions

- Should the LGPD panel be a separate route (`/lgpd`) or a section within the existing tenant settings (`/configuracoes`)? **Recommendation:** Separate route `/lgpd` for visibility, linked from tenant settings.
- Should the DPO configuration be per-tenant or per-platform? **Recommendation:** Per-tenant (each condominium may have different DPO).
- What is the default data retention period? **Recommendation:** 5 years (aligns with typical tax record retention in Brazil).
- Should anonymized records be visible to admins or completely hidden? **Recommendation:** Hidden by default with a toggle to show anonymized records.
