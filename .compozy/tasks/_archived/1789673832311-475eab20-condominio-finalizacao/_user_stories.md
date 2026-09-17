# User Stories: Condominio SaaS - Finalizacao (LGPD + Testes)

Canonical behavior catalog for the finalization phase. Companion to `_prd.md`; consumed by `_techspec.md` (component mapping) and `_tests.md` (coverage matrix).

## Personas

- **Morador (Resident)** — Condominium resident who needs to exercise LGPD rights over their personal data
- **Dependente (Dependent)** — Family member of a resident, data processed under the resident's consent
- **Sindico (Building Manager)** — Condominium administrator who manages residents and handles compliance requests
- **Admin (Tenant Admin)** — Tenant-level administrator with full access to all modules
- **SuperAdmin (Platform Admin)** — Platform operator with cross-tenant access for support and compliance oversight
- **Developer (QA/Testing)** — Developer writing automated tests to ensure system reliability

## Story Index

| ID | Feature Area | Persona | Story |
|----|-------------|---------|-------|
| US-001 | LGPD Deletion | Morador | Request deletion of personal data |
| US-002 | LGPD Deletion | Sindico | Execute pending deletion request |
| US-003 | LGPD Deletion | Sindico | View deletion request history |
| US-004 | LGPD Deletion | Morador | Cancel pending deletion request |
| US-005 | LGPD Deletion | Developer | Deletion preserves financial records |
| US-006 | LGPD Export | Morador | Export personal data as JSON |
| US-007 | LGPD Export | Sindico | Export resident data on behalf |
| US-008 | LGPD Export | Developer | Export includes all related entities |
| US-009 | LGPD Consent | Morador | View current consent status |
| US-010 | LGPD Consent | Morador | Update consent preferences |
| US-011 | LGPD Consent | Developer | Consent changes are audited |
| US-012 | Backend Tests | Developer | Integration test for dependents module |
| US-013 | Backend Tests | Developer | Integration test for employees module |
| US-014 | Backend Tests | Developer | Integration test for service-providers module |
| US-015 | Backend Tests | Developer | Integration test for residents module |
| US-016 | Frontend Tests | Developer | Test auth-provider session lifecycle |
| US-017 | Frontend Tests | Developer | Test permissions.ts authorization logic |
| US-018 | Frontend Tests | Developer | Test ProtectedRoute guard behavior |
| US-019 | Frontend Tests | Developer | Test theme-provider persistence |
| US-020 | Frontend Tests | Developer | Test use-account-theme hook |
| US-021 | Frontend Tests | Developer | Test utils.ts pure functions |
| US-022 | Frontend Tests | Developer | Test query-provider error handling |
| US-023 | Frontend Tests | Developer | Test financial module components |
| US-024 | Frontend Tests | Developer | Test dashboard components |
| US-025 | LGPD Config | Admin | Configure DPO contact and retention policy |

## LGPD Data Deletion

### US-001: Request Deletion of Personal Data

**As a** Morador, **I want** to request the deletion of my personal data from the platform, **so that** my LGPD right to deletion is exercised.

Acceptance criteria:

- AC-1: Given I am authenticated as a resident, when I navigate to my profile and click "Solicitar exclusão de dados", then a confirmation dialog is shown explaining what will be deleted.
- AC-2: Given I confirm the deletion request, when the system processes it, then a `LGPD_DELETE_REQUEST` entry is created in `lgpd_requests` with status `PENDING`.
- AC-3: Given I have active charges or reservations, when I request deletion, then the system warns me that financial records will be anonymized but preserved.
- AC-4: Given I have dependents linked to my account, when I request deletion, then the system warns that dependent data will also be anonymized.

Edge cases:

- EC-1: User has no active session → redirect to login before showing deletion request form.
- EC-2: User has pending charges with status `PENDING` → warning message displayed but request still allowed.
- EC-3: User submits deletion request twice → second request rejected with "Já existe uma solicitação pendente" message.
- EC-4: User's consent is not recorded (`lgpdConsentAt` is null) → request still allowed (consent is not required for deletion).
- EC-5: Network error during request creation → toast error message, request not created.
- EC-6: User is a dependent (not a resident) → deletion request redirects to the linked resident's profile.

### US-002: Execute Pending Deletion Request

**As a** Sindico, **I want** to execute a pending LGPD deletion request, **so that** the resident's personal data is properly anonymized and the platform remains compliant.

Acceptance criteria:

- AC-1: Given I am authenticated as a SINDICO or ADMIN, when I navigate to the LGPD requests panel, then I see all pending deletion requests for my condominium.
- AC-2: Given I click "Executar" on a pending request, when I confirm, then the system anonymizes all personal fields (name → `REDACTED-{hash}`, cpf → `000.000.000-00`, email → `redacted@redacted.invalid`, phone → `0000000000`, address fields → empty).
- AC-3: Given the anonymization is complete, when the transaction commits, then the `lgpd_requests` status changes to `EXECUTED` with `executedAt` timestamp.
- AC-4: Given the deletion is executed, when any admin views the resident list, then the anonymized record is no longer visible (filtered by default).

Edge cases:

- EC-1: Admin clicks "Executar" on an already-executed request → button disabled, status shows "Executado".
- EC-2: Database transaction fails during anonymization → transaction rolled back, status remains `PENDING`, error logged.
- EC-3: Resident has linked dependents → all dependent personal fields are also anonymized in the same transaction.
- EC-4: Resident has active reservations → reservations are preserved with anonymized resident name.
- EC-5: Resident has financial charges → charges are preserved with anonymized resident name, amounts unchanged.
- EC-6: Concurrent deletion requests for the same resident → second execution rejected with conflict message.
- EC-7: Admin is not SINDICO or ADMIN → 403 Forbidden response.

### US-003: View Deletion Request History

**As a** Sindico, **I want** to view the history of all LGPD deletion requests (pending, executed, cancelled), **so that** I can track compliance activities.

Acceptance criteria:

- AC-1: Given I am authenticated as a SINDICO or ADMIN, when I access the LGPD panel, then I see a list of all deletion requests with status, request date, and execution date.
- AC-2: Given I filter by status, when I select "Pendente", then only pending requests are displayed.
- AC-3: Given I view a request detail, when I click on it, then I see the requesting resident's name (or "Anonimizado" if already executed) and the request timestamp.

Edge cases:

- EC-1: No deletion requests exist → empty state message "Nenhuma solicitação de exclusão registrada".
- EC-2: Admin has multiple condominiums → requests are scoped to the selected condominium.
- EC-3: Request was executed → resident name shows as "Anonimizado" in the list.

### US-004: Cancel Pending Deletion Request

**As a** Morador, **I want** to cancel my pending deletion request, **so that** I can change my mind before data is permanently anonymized.

Acceptance criteria:

- AC-1: Given I have a pending deletion request, when I access my profile, then I see a "Cancelar solicitação" option.
- AC-2: Given I click cancel and confirm, when the system processes it, then the `lgpd_requests` status changes to `CANCELLED`.

Edge cases:

- EC-1: Request is already executed → cancel option not available.
- EC-2: Request is already cancelled → no action available.
- EC-3: Network error during cancellation → toast error, status unchanged.

### US-005: Deletion Preserves Financial Records

**As a** Developer, **I want** the deletion process to anonymize personal fields while preserving financial transaction integrity, **so that** the platform complies with both LGPD and tax/legal retention requirements.

Acceptance criteria:

- AC-1: Given a resident with charges and payments is anonymized, when an admin views the financial report, then the charges and payments still appear with correct amounts, dates, and categories but with anonymized resident name.
- AC-2: Given a resident with charges and payments is anonymized, when the financial summary is generated, then the totals and statistics remain accurate.
- AC-3: Given the anonymization transaction completes, when the audit log is queried, then an entry with action `LGPD_DELETE` exists with the resident ID and timestamp.

Edge cases:

- EC-1: Resident has no financial records → anonymization proceeds without financial impact.
- EC-2: Resident has pending charges that are not yet paid → charges preserved with anonymized name.
- EC-3: Resident has a payment in progress → payment record preserved with anonymized payer name.

## LGPD Data Export

### US-006: Export Personal Data as JSON

**As a** Morador, **I want** to download all my personal data in JSON format, **so that** I can exercise my LGPD portability right.

Acceptance criteria:

- AC-1: Given I am authenticated as a resident, when I click "Exportar meus dados" in my profile, then the system generates a JSON file and initiates download.
- AC-2: Given the export is generated, when I open the file, then it contains: `exportDate`, `platform`, `dataSubject`, `resident` (profile data), `dependents`, `vehicles`, `reservations`, `financial` (charges + payments), `correspondences`, `documents`.
- AC-3: Given the export completes, when the audit log is queried, then an entry with action `LGPD_EXPORT` exists.

Edge cases:

- EC-1: Resident has no dependents → `dependents` array is empty.
- EC-2: Resident has no vehicles → `vehicles` array is empty.
- EC-3: Resident has no financial records → `financial` object has empty `charges` and `payments` arrays.
- EC-4: Resident has documents with file paths → export contains document metadata only (not file contents).
- EC-5: Network error during export generation → toast error message.
- EC-6: Resident account is anonymized → export returns empty/minimal data with warning.
- EC-7: Export file is large (>10MB) → still generated and downloaded (no size limit for personal data export).

### US-007: Export Resident Data on Behalf

**As a** Sindico, **I want** to export personal data for a resident in my condominium, **so that** I can fulfill LGPD portability requests received through non-digital channels.

Acceptance criteria:

- AC-1: Given I am authenticated as a SINDICO or ADMIN, when I select a resident and click "Exportar dados LGPD", then the system generates a JSON export for that resident.
- AC-2: Given the export is generated for another resident, when the audit log is queried, then an entry with action `LGPD_EXPORT` includes both the admin ID and the target resident ID.

Edge cases:

- EC-1: Admin tries to export data for a resident in a different condominium → 403 Forbidden.
- EC-2: Target resident is already anonymized → export returns minimal data with warning.
- EC-3: Admin is a SINDICO (not ADMIN) → allowed only for residents in their condominium.

### US-008: Export Includes All Related Entities

**As a** Developer, **I want** the export to consolidate data from all entities related to the resident, **so that** the export is comprehensive and satisfies LGPD portability requirements.

Acceptance criteria:

- AC-1: Given a resident with dependents, vehicles, reservations, charges, payments, correspondences, and documents, when the export is generated, then all entities are included in the correct JSON sections.
- AC-2: Given the export JSON, when the structure is validated, then system fields (`id`, `tenantId`, `createdAt`, `updatedAt`, `deletedAt`) are excluded from user-facing data.
- AC-3: Given the export JSON, when dates are included, then they are in ISO 8601 format.

Edge cases:

- EC-1: Resident has entities linked through multiple condominiums → only entities in the current condominium scope are exported.
- EC-2: Resident has soft-deleted entities → soft-deleted entities are excluded from the export.
- EC-3: Resident has entities with nested relationships (e.g., charge → payments) → nested data is flattened to the relevant level.

## LGPD Consent Management

### US-009: View Current Consent Status

**As a** Morador, **I want** to see when I gave my consent and what it covers, **so that** I can make informed decisions about my data.

Acceptance criteria:

- AC-1: Given I am authenticated as a resident, when I access my profile, then I see "Consentimento LGPD" section with the consent date (`lgpdConsentAt`).
- AC-2: Given I have never given consent (`lgpdConsentAt` is null), when I view the section, then I see "Consentimento não registrado" with a prompt to provide consent.

Edge cases:

- EC-1: Consent was given during registration → date shown is the registration timestamp.
- EC-2: Consent was never given → section shows warning but does not block other functionality.

### US-010: Update Consent Preferences

**As a** Morador, **I want** to update my consent preferences (provide or revoke consent), **so that** I can control how my data is processed.

Acceptance criteria:

- AC-1: Given I am authenticated as a resident, when I toggle the consent switch, then a confirmation dialog explains the implications.
- AC-2: Given I confirm consent update, when the system processes it, then `lgpdConsentAt` is updated to the current timestamp (for providing consent) or a new `lgpdConsentRevokedAt` field is set (for revoking consent).
- AC-3: Given I revoke consent, when the system processes it, then a warning is shown that some services may become unavailable.

Edge cases:

- EC-1: User tries to revoke consent while having active reservations → warning that reservations will be cancelled.
- EC-2: User tries to revoke consent while having pending charges → warning that payment processing may be affected.
- EC-3: Network error during consent update → toast error, consent unchanged.

### US-011: Consent Changes Are Audited

**As a** Developer, **I want** all consent changes to be logged in the audit trail, **so that** the platform can demonstrate accountability (LGPD Art. 37).

Acceptance criteria:

- AC-1: Given a resident provides consent, when the audit log is queried, then an entry with action `LGPD_CONSENT_GRANTED` exists.
- AC-2: Given a resident revokes consent, when the audit log is queried, then an entry with action `LGPD_CONSENT_REVOKED` exists.

Edge cases:

- EC-1: Consent is given during registration → logged as `LGPD_CONSENT_GRANTED` with the registration context.
- EC-2: Multiple consent updates in quick succession → each is logged separately with its timestamp.

## Backend Integration Tests

### US-012: Integration Test for Dependents Module

**As a** Developer, **I want** integration tests covering the dependents CRUD endpoints, **so that** the module's correctness and tenant isolation are verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when the dependents tests execute, then all CRUD operations (create, read, update, soft delete, restore) pass.
- AC-2: Given a test creates a dependent, when another tenant queries dependents, then the created dependent is not visible (tenant isolation).
- AC-3: Given a test tries to create a dependent with invalid data, when validation fails, then appropriate error messages are returned.

Edge cases:

- EC-1: Create dependent with missing required fields → 400 with validation errors.
- EC-2: Create dependent with invalid CPF format → 400 with CPF validation error.
- EC-3: Delete dependent that doesn't exist → 404.
- EC-4: Restore a non-deleted dependent → appropriate error.
- EC-5: Create dependent linked to non-existent resident → 404 or 400.

### US-013: Integration Test for Employees Module

**As a** Developer, **I want** integration tests covering the employees CRUD endpoints, **so that** the module's correctness and tenant isolation are verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when the employees tests execute, then all CRUD operations pass.
- AC-2: Given a test creates an employee, when another tenant queries employees, then the created employee is not visible (tenant isolation).
- AC-3: Given a test tries to create an employee with contract type CLT, when the contract fields are valid, then the employee is created successfully.

Edge cases:

- EC-1: Create employee with missing required fields → 400 with validation errors.
- EC-2: Create employee with invalid salary (negative) → 400 with validation error.
- EC-3: Delete employee that doesn't exist → 404.
- EC-4: List employees with pagination and search → correct filtering.
- EC-5: Create employee with duplicate CPF in same condominium → 409 Conflict.

### US-014: Integration Test for Service-Providers Module

**As a** Developer, **I want** integration tests covering the service-providers CRUD endpoints, **so that** the module's correctness and tenant isolation are verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when the service-providers tests execute, then all CRUD operations pass.
- AC-2: Given a test creates a service provider, when another tenant queries service providers, then the created provider is not visible (tenant isolation).
- AC-3: Given a test tries to create a service provider with invalid CNPJ, when validation fails, then appropriate error is returned.

Edge cases:

- EC-1: Create service provider with missing required fields → 400 with validation errors.
- EC-2: Create service provider with invalid CNPJ → 400 with CNPJ validation error.
- EC-3: Delete service provider that doesn't exist → 404.
- EC-4: List service providers with search by company name → correct filtering.
- EC-5: Soft delete and restore service provider → restore works correctly.

### US-015: Integration Test for Residents Module

**As a** Developer, **I want** integration tests covering the residents CRUD endpoints, **so that** the module's correctness, unit linkage, and tenant isolation are verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when the residents tests execute, then all CRUD operations pass.
- AC-2: Given a test creates a resident linked to a unit, when the unit is queried, then the resident appears in the unit's resident list.
- AC-3: Given a test tries to create a resident for a unit in another tenant, when tenant isolation is enforced, then the request is rejected.

Edge cases:

- EC-1: Create resident with missing required fields → 400 with validation errors.
- EC-2: Create resident with invalid CPF → 400 with CPF validation error.
- EC-3: Create resident for non-existent unit → 404.
- EC-4: Delete resident that has dependents → cascade behavior (dependents soft deleted or blocked).
- EC-5: Soft delete resident → resident's dependents are also soft deleted.
- EC-6: Restore soft-deleted resident → dependents remain soft deleted (not restored automatically).

## Frontend Critical Tests

### US-016: Test Auth Provider Session Lifecycle

**As a** Developer, **I want** tests for the auth-provider covering session restore, login, logout, and token management, **so that** the authentication system's correctness is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when auth-provider tests execute, then session restore on app boot is tested (valid token in localStorage → user loaded).
- AC-2: Given a login attempt, when credentials are valid, then the user is authenticated and tokens are stored.
- AC-3: Given a logout attempt, when the user clicks logout, then tokens are removed and user is set to null.
- AC-4: Given an expired access token, when a request is made, then the refresh token is used to obtain a new access token.

Edge cases:

- EC-1: localStorage has invalid/corrupted token → session is not restored, user is null.
- EC-2: Refresh token is expired → user is logged out.
- EC-3: Multiple rapid login/logout cycles → no state corruption.
- EC-4: `session-expired` event is received → user is logged out and redirected.
- EC-5: `updateUser` is called → user object is updated in context.

### US-017: Test Permissions Authorization Logic

**As a** Developer, **I want** tests for `permissions.ts` covering `hasPermission()` and `hasAnyPermission()`, **so that** the authorization logic is verified for all edge cases.

Acceptance criteria:

- AC-1: Given the test suite runs, when permissions tests execute, then `hasPermission()` is tested with: matching permission, missing permission, wildcard `*`, `resource:manage` wildcard, empty permissions array.
- AC-2: Given `hasAnyPermission()`, when tested with multiple permissions, then it returns true if ANY of the permissions match.
- AC-3: Given a user with `*` wildcard permission, when `hasPermission()` is called for any resource/action, then it returns true.

Edge cases:

- EC-1: Permission string with invalid format (no colon) → handled gracefully.
- EC-2: Empty permissions array → `hasPermission()` returns false.
- EC-3: `undefined` role → `hasPermission()` returns false.
- EC-4: `resource:manage` should match `resource:create`, `resource:read`, `resource:update`, `resource:delete`.
- EC-5: `*` should match any resource and any action.

### US-018: Test ProtectedRoute Guard Behavior

**As a** Developer, **I want** tests for `ProtectedRoute` covering all three branches (initializing, unauthenticated, unauthorized), **so that** the route guard is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when ProtectedRoute tests execute, then the initializing state shows a loader.
- AC-2: Given an unauthenticated user, when they access a protected route, then they are redirected to `/login`.
- AC-3: Given an authenticated user without the required permission, when they access a guarded route, then `ForbiddenPage` is rendered.
- AC-4: Given an authenticated user with the required permission, when they access a guarded route, then the child content is rendered.

Edge cases:

- EC-1: User session is loading (token exists but user not yet fetched) → loader shown.
- EC-2: User session fails to load (invalid token) → redirect to login.
- EC-3: Route has no `permission` prop → only session check, no permission check.
- EC-4: User has `*` wildcard permission → access granted to any guarded route.

### US-019: Test Theme Provider Persistence

**As a** Developer, **I want** tests for `theme-provider` covering localStorage persistence and system theme detection, **so that** the theme system's correctness is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when theme-provider tests execute, then theme persistence in localStorage is tested.
- AC-2: Given a user changes theme to dark, when the page is refreshed, then the dark theme is restored from localStorage.
- AC-3: Given no theme preference in localStorage, when the page loads, then the system preference is used.

Edge cases:

- EC-1: localStorage has invalid theme value → falls back to system preference.
- EC-2: `prefers-color-scheme` media query changes → theme updates (if no user choice).
- EC-3: `toggleTheme` is called → theme switches between light and dark.
- EC-4: `setTheme('dark')` is called → theme is set to dark regardless of current state.

### US-020: Test use-account-theme Hook

**As a** Developer, **I want** tests for `use-account-theme` covering the theme adoption logic, **so that** the hook's behavior is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when use-account-theme tests execute, then the hook adopts the account theme on first mount.
- AC-2: Given a device choice exists in localStorage, when the hook runs, then the device choice is respected over the account theme.

Edge cases:

- EC-1: User has no account theme → no theme change.
- EC-2: Device choice and account theme conflict → device choice wins.
- EC-3: Hook re-mounts → theme is not re-applied (ref latch prevents double application).

## Frontend High-Value Tests

### US-021: Test Utils Pure Functions

**As a** Developer, **I want** tests for `utils.ts` covering `cn()`, `initials()`, and `sleep()`, **so that** utility function correctness is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when utils tests execute, then `cn()` merges Tailwind classes correctly.
- AC-2: Given `initials()`, when called with a full name, then the first letter of the first and last name are returned.
- AC-3: Given `sleep()`, when called with a duration, then the promise resolves after the specified time.

Edge cases:

- EC-1: `cn()` with conflicting classes → last class wins.
- EC-2: `initials()` with single name → two letters from that name.
- EC-3: `initials()` with empty string → empty string.
- EC-4: `sleep(0)` → resolves immediately.

### US-022: Test Query Provider Error Handling

**As a** Developer, **I want** tests for `query-provider` covering error handling and retry configuration, **so that** the error handling behavior is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when query-provider tests execute, then 401 errors are skipped (not retried).
- AC-2: Given a mutation error, when the error handler runs, then a toast message is displayed.

Edge cases:

- EC-1: Non-401 error → retry policy is applied.
- EC-2: Network error → appropriate error handling.
- EC-3: Multiple simultaneous errors → each triggers its own toast.

### US-023: Test Financial Module Components

**As a** Developer, **I want** tests for the financial module's 13 untested components, **so that** the financial UI's correctness is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when financial component tests execute, then `categories-section`, `charges-section`, `expenses-section`, and `financial-summary` render correctly.
- AC-2: Given the `generate-charges-dialog`, when a valid period is submitted, then the generation API is called.
- AC-3: Given the `register-payment-dialog`, when a payment is registered, then the payment API is called with correct data.

Edge cases:

- EC-1: Financial summary with zero charges → "Nenhuma cobrança" message.
- EC-2: Charges section with overdue charges → late fee indicator shown.
- EC-3: Expense form with invalid amount → validation error displayed.
- EC-4: Category form with duplicate name → error message.

### US-024: Test Dashboard Components

**As a** Developer, **I want** tests for the dashboard's untested components, **so that** the dashboard UI's correctness is verified.

Acceptance criteria:

- AC-1: Given the test suite runs, when dashboard component tests execute, then `stat-card`, `activity-feed`, `financial-chart`, `expenses-chart`, and `chart-tooltip` render correctly.
- AC-2: Given the `stat-card`, when a value is provided, then it is formatted correctly.
- AC-3: Given the `activity-feed`, when activities are provided, then they are displayed in reverse chronological order.

Edge cases:

- EC-1: Stat card with null value → "N/A" displayed.
- EC-2: Activity feed with zero activities → empty state message.
- EC-3: Financial chart with no data → "Sem dados" message.
- EC-4: Chart tooltip with missing data points → handled gracefully.

### US-025: Configure DPO Contact and Retention Policy

**As a** Admin, **I want** to configure the DPO (Data Protection Officer) contact information and data retention policy, **so that** the platform displays compliant privacy information.

Acceptance criteria:

- AC-1: Given I am authenticated as an ADMIN or TENANT admin, when I access the tenant settings, then I see a "LGPD" section with DPO name, email, and data retention period fields.
- AC-2: Given I save the LGPD settings, when the settings are stored, then the DPO contact is displayed in the resident's profile and privacy policy page.
- AC-3: Given the retention period is set, when data older than the retention period exists, then the system can flag it for review.

Edge cases:

- EC-1: DPO email is invalid → validation error.
- EC-2: Retention period is set to 0 → system warns that this may cause data loss.
- EC-3: DPO contact is not configured → privacy policy page shows a generic message.
- EC-4: Only admins with `tenant:update` permission can modify LGPD settings.

## Edge-Case Sweep

| Class | Probe |
| --- | --- |
| Invalid input | Malformed CPF/CNPJ in deletion requests, invalid JSON in export, invalid email in DPO config. |
| Empty / missing | No residents to delete, no data to export, no consent records, no pending requests. |
| Limits | Very large exports (>10MB), many pending deletion requests, bulk operations. |
| Permissions | Resident trying to execute deletion (should be denied), admin accessing another tenant's data. |
| Concurrency | Two admins executing the same deletion request simultaneously, concurrent consent updates. |
| Interruption | Network failure during deletion anonymization, partial export download. |
| Repetition | Double-click on delete button, retry after timeout. |
| Ordering | Export before any data exists, consent update before initial consent. |
| State transitions | Executing an already-cancelled deletion request, exporting data for an anonymized resident. |
| Scale | Export for a resident with 1000+ charges, deletion request list with 100+ entries. |
