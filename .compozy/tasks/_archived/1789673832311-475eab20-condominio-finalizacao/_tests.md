# Test Specification: Condominio SaaS — Finalizacao (LGPD + Testes)

Canonical test contract for LGPD compliance and test coverage finalization. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- **Backend frameworks**: Jest + Supertest + sql.js in-memory database (existing `backend/tests/setup.ts`)
- **Frontend frameworks**: Vitest + Testing Library + jsdom (existing `frontend/src/test/setup.ts`)
- **Execution**: Backend: `npm --prefix backend run test`; Frontend: `npm --prefix frontend run test`
- **Conventions**: Follow existing patterns — `describe` blocks per module, `it` blocks per behavior, Portuguese test descriptions matching existing codebase

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|--------|----------|------|-------------|-----|
| US-001 | Request deletion of personal data | UT-001 | IT-001 | — |
| US-001.EC-1 | No active session → redirect to login | — | IT-002 | — |
| US-001.EC-2 | Active charges → warning displayed | UT-002 | IT-003 | — |
| US-001.EC-3 | Duplicate pending request → rejected | UT-003 | IT-004 | — |
| US-001.EC-4 | No consent recorded → request still allowed | UT-004 | IT-005 | — |
| US-001.EC-5 | Network error → toast error | — | IT-006 | — |
| US-001.EC-6 | Dependent user → redirect to resident profile | — | IT-007 | — |
| US-002 | Execute pending deletion request | UT-005 | IT-008 | — |
| US-002.EC-1 | Already executed → button disabled | — | IT-009 | — |
| US-002.EC-2 | Transaction fails → rollback | UT-006 | IT-010 | — |
| US-002.EC-3 | Linked dependents → cascade anonymize | UT-007 | IT-011 | — |
| US-002.EC-4 | Active reservations → preserved with anon name | UT-008 | IT-012 | — |
| US-002.EC-5 | Financial charges → preserved with anon name | UT-009 | IT-013 | — |
| US-002.EC-6 | Concurrent requests → conflict rejection | UT-010 | IT-014 | — |
| US-002.EC-7 | Non-admin role → 403 Forbidden | — | IT-015 | — |
| US-003 | View deletion request history | — | IT-016 | — |
| US-003.EC-1 | No requests → empty state | — | IT-017 | — |
| US-003.EC-2 | Multiple condominiums → scoped to selection | — | IT-018 | — |
| US-003.EC-3 | Executed request → "Anonimizado" in name | — | IT-019 | — |
| US-004 | Cancel pending deletion request | — | IT-020 | — |
| US-004.EC-1 | Already executed → cancel not available | — | IT-021 | — |
| US-004.EC-2 | Already cancelled → no action | — | IT-022 | — |
| US-004.EC-3 | Network error → toast error | — | IT-023 | — |
| US-005 | Deletion preserves financial records | UT-011 | IT-024 | — |
| US-006 | Export personal data as JSON | UT-012 | IT-025 | — |
| US-006.EC-1 | No dependents → empty array | UT-013 | IT-026 | — |
| US-006.EC-2 | No vehicles → empty array | UT-014 | IT-027 | — |
| US-006.EC-3 | No financial records → empty arrays | UT-015 | IT-028 | — |
| US-006.EC-4 | Documents → metadata only | UT-016 | IT-029 | — |
| US-006.EC-5 | Network error → toast error | — | IT-030 | — |
| US-006.EC-6 | Anonymized account → minimal data | UT-017 | IT-031 | — |
| US-006.EC-7 | Large export → still generated | — | IT-032 | — |
| US-007 | Export resident data on behalf | — | IT-033 | — |
| US-007.EC-1 | Different condominium → 403 | — | IT-034 | — |
| US-007.EC-2 | Anonymized target → minimal data | — | IT-035 | — |
| US-007.EC-3 | SINDICO role → allowed for own condo | — | IT-036 | — |
| US-008 | Export includes all related entities | UT-018 | IT-037 | — |
| US-008.EC-1 | Current condominium scope only | UT-019 | IT-038 | — |
| US-008.EC-2 | Soft-deleted entities excluded | UT-020 | IT-039 | — |
| US-008.EC-3 | Nested relationships flattened | UT-021 | IT-040 | — |
| US-009 | View current consent status | — | IT-041 | — |
| US-009.EC-1 | Consent during registration → date shown | — | IT-042 | — |
| US-009.EC-2 | No consent → warning prompt | — | IT-043 | — |
| US-010 | Update consent preferences | — | IT-044 | — |
| US-010.EC-1 | Revoke with active reservations → warning | UT-022 | IT-045 | — |
| US-010.EC-2 | Revoke with pending charges → warning | UT-023 | IT-046 | — |
| US-010.EC-3 | Network error → toast error | — | IT-047 | — |
| US-011 | Consent changes are audited | — | IT-048 | — |
| US-012 | Integration test: dependents module | — | IT-049 | — |
| US-013 | Integration test: employees module | — | IT-050 | — |
| US-014 | Integration test: service-providers module | — | IT-051 | — |
| US-015 | Integration test: residents module | — | IT-052 | — |
| US-016 | Test auth-provider session lifecycle | UT-024 | — | — |
| US-017 | Test permissions.ts authorization logic | UT-025 | — | — |
| US-018 | Test ProtectedRoute guard behavior | UT-026 | — | — |
| US-019 | Test theme-provider persistence | UT-027 | — | — |
| US-020 | Test use-account-theme hook | UT-028 | — | — |
| US-021 | Test utils.ts pure functions | UT-029 | — | — |
| US-022 | Test query-provider error handling | UT-030 | — | — |
| US-023 | Test financial module components | UT-031 | — | — |
| US-024 | Test dashboard components | UT-032 | — | — |
| US-025 | Configure DPO contact and retention | — | IT-053 | — |

## Unit Tests

### anonymize.ts (TechSpec: Core Interfaces — AnonymizeResult)

- **UT-001** (happy): `anonymizePersonalData` — given a resident with 2 dependents and 1 vehicle, produces `AnonymizeResult` with `residentsAnonymized: 1, dependentsAnonymized: 2, vehiclesAnonymized: 1`.
- **UT-002** (boundary): `anonymizePersonalData` — given a resident with active charges, charges are preserved with anonymized `residentName` field.
- **UT-003** (error): `createDeleteRequest` — given a resident with an existing PENDING request, returns `ConflictError` with code `LGPD_DUPLICATE_REQUEST`.
- **UT-004** (boundary): `createDeleteRequest` — given a resident with `lgpdConsentAt: null`, request is created successfully (consent not required for deletion).
- **UT-005** (happy): `executeDelete` — given a valid PENDING request, status changes to `EXECUTED` and `executedAt` is set.
- **UT-006** (error): `executeDelete` — given a database error during anonymization transaction, transaction is rolled back and status remains `PENDING`.
- **UT-007** (happy): `anonymizePersonalData` — given a resident with dependents, all dependent personal fields are anonymized in the same call.
- **UT-008** (boundary): `anonymizePersonalData` — given a resident with reservations, reservation records are preserved with anonymized resident name.
- **UT-009** (boundary): `anonymizePersonalData` — given a resident with charges, charge amounts and dates are preserved, only `residentName` is anonymized.
- **UT-010** (concurrency): `executeDelete` — given two concurrent execute calls for the same request, the second one receives a `ConflictError`.
- **UT-011** (happy): `anonymizePersonalData` — given a resident with no financial records, anonymization completes without financial impact.

### lgpd.schema.ts (TechSpec: Data Models)

- **UT-012** (happy): `lgpdExportPayload` — given valid resident data, the export structure contains all required top-level keys (`exportDate`, `platform`, `dataSubject`, `resident`, `dependents`, `vehicles`, `reservations`, `financial`, `correspondences`, `documents`).
- **UT-013** (boundary): `lgpdExportPayload` — given a resident with no dependents, `dependents` is an empty array.
- **UT-014** (boundary): `lgpdExportPayload` — given a resident with no vehicles, `vehicles` is an empty array.
- **UT-015** (boundary): `lgpdExportPayload` — given a resident with no financial records, `financial.charges` and `financial.payments` are empty arrays.
- **UT-016** (boundary): `lgpdExportPayload` — given a resident with documents, export contains document metadata but not file contents.
- **UT-017** (boundary): `lgpdExportPayload` — given an anonymized resident, export returns minimal data with `REDACTED` name fields.

### Export data structure (TechSpec: API Endpoints — GET /lgpd/export)

- **UT-018** (happy): `exportResidentData` — given a resident with dependents, vehicles, reservations, charges, payments, correspondences, and documents, the export contains all entities in their correct JSON sections.
- **UT-019** (boundary): `exportResidentData` — given a resident in condominium A, only entities from condominium A are included (not from condominium B).
- **UT-020** (boundary): `exportResidentData` — given a resident with soft-deleted entities, those entities are excluded from the export.
- **UT-021** (boundary): `exportResidentData` — given a charge with payments, the charge contains a `payments` array with the related payment records.

### Consent management (TechSpec: API Endpoints — POST /lgpd/consent)

- **UT-022** (boundary): `updateConsent` — given a resident with active reservations and `granted: false`, the consent is revoked and a warning flag is returned.
- **UT-023** (boundary): `updateConsent` — given a resident with pending charges and `granted: false`, the consent is revoked and a warning flag is returned.

### auth-provider.tsx (TechSpec: Frontend Components)

- **UT-024** (happy): `AuthProvider` — given a valid token in localStorage, session is restored and user object is loaded.
- **UT-024.E1** (error): `AuthProvider` — given an invalid/corrupted token in localStorage, session is not restored and user is null.
- **UT-024.E2** (happy): `AuthProvider` — given a login call with valid credentials, tokens are stored and user is set.
- **UT-024.E3** (happy): `AuthProvider` — given a logout call, tokens are removed and user is set to null.
- **UT-024.E4** (error): `AuthProvider` — given an expired access token, refresh token is used to obtain a new one.
- **UT-024.E5** (error): `AuthProvider` — given an expired refresh token, user is logged out.
- **UT-024.E6** (happy): `AuthProvider` — given `session-expired` event, user is logged out and redirected.
- **UT-024.E7** (happy): `AuthProvider` — given `updateUser` call, user object is updated in context.

### permissions.ts (TechSpec: Frontend Components)

- **UT-025** (happy): `hasPermission` — given `['resident:read']` and required `'resident:read'`, returns `true`.
- **UT-025.E1** (error): `hasPermission` — given `['resident:read']` and required `'resident:delete'`, returns `false`.
- **UT-025.E2** (happy): `hasPermission` — given `['*']` and any required permission, returns `true`.
- **UT-025.E3** (happy): `hasPermission` — given `['resident:manage']` and required `'resident:create'`, returns `true`.
- **UT-025.E4** (happy): `hasPermission` — given `['resident:manage']` and required `'resident:read'`, returns `true`.
- **UT-025.E5** (boundary): `hasPermission` — given `[]` and required `'resident:read'`, returns `false`.
- **UT-025.E6** (boundary): `hasPermission` — given `undefined` and required `'resident:read'`, returns `false`.
- **UT-025.E7** (boundary): `hasPermission` — given `['*']` and no required permission (`undefined`), returns `true`.
- **UT-025.E8** (happy): `hasAnyPermission` — given `['resident:read']` and required `['resident:read', 'resident:delete']`, returns `true`.
- **UT-025.E9** (error): `hasAnyPermission` — given `['vehicle:read']` and required `['resident:read', 'resident:delete']`, returns `false`.
- **UT-025.E10** (boundary): `hasAnyPermission` — given any permissions and empty required array, returns `true`.

### protected-route.tsx (TechSpec: Frontend Components)

- **UT-026** (happy): `ProtectedRoute` — given `initializing: true`, renders `FullPageLoader`.
- **UT-026.E1** (error): `ProtectedRoute` — given `isAuthenticated: false`, redirects to `/login`.
- **UT-026.E2** (error): `ProtectedRoute` — given `isAuthenticated: true` but missing required permission, renders `ForbiddenPage`.
- **UT-026.E3** (happy): `ProtectedRoute` — given `isAuthenticated: true` and required permission present, renders children (Outlet).

### theme-provider.tsx (TechSpec: Frontend Components)

- **UT-027** (happy): `ThemeProvider` — given `localStorage` with `theme: 'dark'`, theme is set to dark.
- **UT-027.E1** (boundary): `ThemeProvider` — given `localStorage` with invalid theme value, falls back to system preference.
- **UT-027.E2** (happy): `ThemeProvider` — given no theme in `localStorage`, uses `prefers-color-scheme` system preference.
- **UT-027.E3** (happy): `ThemeProvider` — given `toggleTheme` called, theme switches between light and dark.
- **UT-027.E4** (happy): `ThemeProvider` — given `setTheme('dark')` called, theme is set to dark.

### use-account-theme.ts (TechSpec: Frontend Components)

- **UT-028** (happy): `use-account-theme` — given an account theme, adopts it on first mount.
- **UT-028.E1** (boundary): `use-account-theme` — given device choice in localStorage, respects device choice over account theme.
- **UT-028.E2** (boundary): `use-account-theme` — given hook re-mounts, theme is not re-applied (ref latch).

### utils.ts (TechSpec: Frontend Components)

- **UT-029** (happy): `cn()` — given `'foo'` and `'bar'`, returns merged Tailwind classes.
- **UT-029.E1** (boundary): `cn()` — given conflicting classes `'p-2'` and `'p-4'`, last class wins.
- **UT-029.E2** (happy): `initials()` — given `'João Silva'`, returns `'JS'`.
- **UT-029.E3** (boundary): `initials()` — given `'João'`, returns `'JO'`.
- **UT-029.E4** (boundary): `initials()` — given `''`, returns `''`.
- **UT-029.E5** (happy): `sleep(0)` — resolves immediately.

### query-provider.tsx (TechSpec: Frontend Components)

- **UT-030** (happy): `QueryProvider` — given a 401 error in a query, the error is skipped (not retried, no toast).
- **UT-030.E1** (error): `QueryProvider` — given a mutation error, a toast message is displayed.
- **UT-030.E2** (happy): `QueryProvider` — given a non-401 error, retry policy is applied.

### Financial module components (TechSpec: Frontend Components)

- **UT-031** (happy): `FinancialSummary` — given charges and expenses data, renders total income, total expenses, and balance.
- **UT-031.E1** (boundary): `FinancialSummary` — given zero charges, renders "Nenhuma cobrança" message.
- **UT-031.E2** (happy): `CategoriesSection` — given categories list, renders each category with name and count.
- **UT-031.E3** (happy): `ChargesSection` — given charges list, renders each charge with amount, status, and due date.
- **UT-031.E4** (boundary): `ChargesSection` — given charges with overdue status, renders late fee indicator.
- **UT-031.E5** (happy): `ExpensesSection` — given expenses list, renders each expense with amount and category.
- **UT-031.E6** (error): `ChargeFormDialog` — given invalid form submission, displays validation errors.
- **UT-031.E7** (error): `ExpenseFormDialog` — given invalid amount, displays validation error.
- **UT-031.E8** (happy): `GenerateChargesDialog` — given valid period, calls generation API.
- **UT-031.E9** (happy): `RegisterPaymentDialog` — given valid payment data, calls payment API.

### Dashboard components (TechSpec: Frontend Components)

- **UT-032** (happy): `StatCard` — given a label and value, renders both correctly.
- **UT-032.E1** (boundary): `StatCard` — given null value, renders "N/A".
- **UT-032.E2** (happy): `ActivityFeed` — given activities, renders in reverse chronological order.
- **UT-032.E3** (boundary): `ActivityFeed` — given zero activities, renders empty state message.
- **UT-032.E4** (happy): `FinancialChart` — given monthly data, renders chart with correct labels.
- **UT-032.E5** (boundary): `FinancialChart` — given no data, renders "Sem dados" message.
- **UT-032.E6** (happy): `ExpensesChart` — given expense categories, renders pie chart.
- **UT-032.E7** (happy): `ChartTooltip` — given data point, renders formatted value.

## Integration Tests

### LGPD Deletion Requests

- **IT-001**: POST /lgpd/delete-request — setup: authenticated resident with condominium; do: create deletion request; expect: 201 with status PENDING.
- **IT-002**: POST /lgpd/delete-request without auth — setup: no token; do: create request; expect: 401 Unauthorized.
- **IT-003**: POST /lgpd/delete-request with active charges — setup: resident with pending charges; do: create request; expect: 201 with warning flag in response.
- **IT-004**: POST /lgpd/delete-request duplicate — setup: resident with existing PENDING request; do: create another request; expect: 409 Conflict with code LGPD_DUPLICATE_REQUEST.
- **IT-005**: POST /lgpd/delete-request without consent — setup: resident with lgpdConsentAt null; do: create request; expect: 201 (consent not required).
- **IT-006**: POST /lgpd/delete-request network error — setup: mock network failure; do: create request; expect: error propagated to caller.
- **IT-007**: POST /lgpd/delete-request as dependent — setup: authenticated dependent (not resident); do: create request; expect: redirect or error.
- **IT-008**: POST /lgpd/delete-request/:id/execute — setup: admin with PENDING request; do: execute; expect: 200 with status EXECUTED, anonymized resident fields.
- **IT-009**: POST /lgpd/delete-request/:id/execute already executed — setup: admin with EXECUTED request; do: execute; expect: 409 Conflict.
- **IT-010**: POST /lgpd/delete-request/:id/execute transaction failure — setup: admin with PENDING request, mock DB error; do: execute; expect: 500, status remains PENDING.
- **IT-011**: POST /lgpd/delete-request/:id/execute with dependents — setup: admin with request for resident having 2 dependents; do: execute; expect: all 3 records anonymized.
- **IT-012**: POST /lgpd/delete-request/:id/execute with reservations — setup: admin with request for resident having active reservations; do: execute; expect: reservations preserved with anonymized name.
- **IT-013**: POST /lgpd/delete-request/:id/execute with charges — setup: admin with request for resident having charges; do: execute; expect: charges preserved with anonymized name, amounts unchanged.
- **IT-014**: POST /lgpd/delete-request/:id/execute concurrent — setup: two admin requests for same deletion; do: execute both simultaneously; expect: one succeeds, one gets 409.
- **IT-015**: POST /lgpd/delete-request/:id/execute as RESIDENT — setup: resident role; do: execute; expect: 403 Forbidden.
- **IT-016**: GET /lgpd/delete-requests — setup: admin with 3 requests (1 PENDING, 1 EXECUTED, 1 CANCELLED); do: list; expect: all 3 returned with correct status.
- **IT-017**: GET /lgpd/delete-requests empty — setup: admin with no requests; do: list; expect: empty array.
- **IT-018**: GET /lgpd/delete-requests scoped — setup: admin with requests in 2 condominiums; do: list with condominium filter; expect: only requests from selected condominium.
- **IT-019**: GET /lgpd/delete-requests/:id executed — setup: admin with EXECUTED request; do: get detail; expect: residentName shows "Anonimizado".
- **IT-020**: POST /lgpd/delete-request/:id/cancel — setup: resident with PENDING request; do: cancel; expect: 200 with status CANCELLED.
- **IT-021**: POST /lgpd/delete-request/:id/cancel executed — setup: resident with EXECUTED request; do: cancel; expect: 409 Conflict.
- **IT-022**: POST /lgpd/delete-request/:id/cancel already cancelled — setup: resident with CANCELLED request; do: cancel; expect: 409 Conflict.
- **IT-023**: POST /lgpd/delete-request/:id/cancel network error — setup: mock network failure; do: cancel; expect: error propagated.

### LGPD Data Export

- **IT-025**: GET /lgpd/export — setup: authenticated resident with full data; do: export; expect: 200 with valid JSON containing all sections.
- **IT-026**: GET /lgpd/export no dependents — setup: resident without dependents; do: export; expect: `dependents` is empty array.
- **IT-027**: GET /lgpd/export no vehicles — setup: resident without vehicles; do: export; expect: `vehicles` is empty array.
- **IT-028**: GET /lgpd/export no financial — setup: resident without charges/payments; do: export; expect: `financial.charges` and `financial.payments` are empty.
- **IT-029**: GET /lgpd/export with documents — setup: resident with uploaded documents; do: export; expect: documents include metadata but not file contents.
- **IT-030**: GET /lgpd/export network error — setup: mock network failure; do: export; expect: error propagated.
- **IT-031**: GET /lgpd/export anonymized resident — setup: anonymized resident; do: export; expect: minimal data with REDACTED fields.
- **IT-032**: GET /lgpd/export large dataset — setup: resident with 100+ charges; do: export; expect: complete JSON generated (may be slow but succeeds).
- **IT-033**: GET /lgpd/export/:residentId as admin — setup: admin exporting for own condominium resident; do: export; expect: 200 with resident data.
- **IT-034**: GET /lgpd/export/:residentId cross-tenant — setup: admin exporting for resident in different condominium; do: export; expect: 403 Forbidden.
- **IT-035**: GET /lgpd/export/:residentId anonymized target — setup: admin exporting for anonymized resident; do: export; expect: minimal data.
- **IT-036**: GET /lgpd/export/:residentId as SINDICO — setup: SINDICO exporting for resident in own condominium; do: export; expect: 200.
- **IT-037**: GET /lgpd/export data completeness — setup: resident with all entity types; do: export; expect: all sections populated with correct data.
- **IT-038**: GET /lgpd/export condominium scope — setup: resident with data in 2 condominiums; do: export; expect: only current condominium data.
- **IT-039**: GET /lgpd/export soft-deleted excluded — setup: resident with soft-deleted entities; do: export; expect: deleted entities not included.
- **IT-040**: GET /lgpd/export nested data — setup: charge with payments; do: export; expect: payments nested under financial.charges.

### LGPD Consent Management

- **IT-041**: GET /lgpd/consent — setup: resident with existing consent; do: get consent; expect: 200 with consent record.
- **IT-042**: GET /lgpd/consent after registration — setup: resident created via registration; do: get consent; expect: grantedAt matches registration timestamp.
- **IT-043**: GET /lgpd/consent no consent — setup: resident without consent record; do: get consent; expect: 200 with null or empty.
- **IT-044**: POST /lgpd/consent — setup: resident; do: update consent (granted: false); expect: 200 with revokedAt set.
- **IT-045**: POST /lgpd/consent with reservations — setup: resident with active reservations; do: revoke consent; expect: 200 with warning flag.
- **IT-046**: POST /lgpd/consent with charges — setup: resident with pending charges; do: revoke consent; expect: 200 with warning flag.
- **IT-047**: POST /lgpd/consent network error — setup: mock network failure; do: update consent; expect: error propagated.
- **IT-048**: POST /lgpd/consent audit trail — setup: resident; do: update consent; expect: audit log entry with action LGPD_CONSENT_GRANTED or LGPD_CONSENT_REVOKED.

### LGPD Configuration

- **IT-053**: PUT /tenants/:id/lgpd-settings — setup: admin; do: update DPO name, email, retention period; expect: 200 with updated settings.
- **IT-053.E1**: PUT /tenants/:id/lgpd-settings invalid email — setup: admin; do: update with invalid DPO email; expect: 400 validation error.
- **IT-053.E2**: PUT /tenants/:id/lgpd-settings as RESIDENT — setup: resident role; do: update settings; expect: 403 Forbidden.

### Backend: Dependents Module (US-012)

- **IT-049**: dependents CRUD — setup: admin with condominium and resident; do: create, read, update, soft delete, restore dependent; expect: all operations succeed with correct data.
- **IT-049.E1**: dependents tenant isolation — setup: two tenants with dependents; do: tenant A queries dependents; expect: only tenant A's dependents returned.
- **IT-049.E2**: dependents validation — setup: admin; do: create with invalid CPF; expect: 400 validation error.
- **IT-049.E3**: dependents cascade delete — setup: dependent linked to resident; do: soft delete resident; expect: dependent is also soft deleted.

### Backend: Employees Module (US-013)

- **IT-050**: employees CRUD — setup: admin with condominium; do: create, read, update, soft delete, restore employee; expect: all operations succeed.
- **IT-050.E1**: employees tenant isolation — setup: two tenants; do: tenant A queries employees; expect: only tenant A's employees.
- **IT-050.E2**: employees validation — setup: admin; do: create with negative salary; expect: 400 validation error.
- **IT-050.E3**: employees duplicate CPF — setup: admin; do: create two employees with same CPF in same condominium; expect: 409 Conflict.

### Backend: Service-Providers Module (US-014)

- **IT-051**: service-providers CRUD — setup: admin with condominium; do: create, read, update, soft delete, restore; expect: all operations succeed.
- **IT-051.E1**: service-providers tenant isolation — setup: two tenants; do: tenant A queries; expect: only tenant A's providers.
- **IT-051.E2**: service-providers validation — setup: admin; do: create with invalid CNPJ; expect: 400 validation error.

### Backend: Residents Module (US-015)

- **IT-052**: residents CRUD — setup: admin with condominium and unit; do: create, read, update, soft delete, restore resident; expect: all operations succeed.
- **IT-052.E1**: residents tenant isolation — setup: two tenants; do: tenant A queries; expect: only tenant A's residents.
- **IT-052.E2**: residents unit linkage — setup: admin; do: create resident linked to unit; expect: resident appears in unit's resident list.
- **IT-052.E3**: residents validation — setup: admin; do: create with invalid CPF; expect: 400 validation error.
- **IT-052.E4**: residents cascade — setup: resident with dependents; do: soft delete resident; expect: dependents are also soft deleted.

### Frontend: Auth Provider (US-016)

- **IT-054**: auth-provider session restore — setup: valid token in localStorage; do: mount AuthProvider; expect: user loaded from /auth/me.
- **IT-054.E1**: auth-provider invalid token — setup: invalid token in localStorage; do: mount AuthProvider; expect: user is null, tokens cleared.
- **IT-054.E2**: auth-provider login flow — setup: AuthProvider mounted; do: call login with valid credentials; expect: user set, tokens stored.
- **IT-054.E3**: auth-provider logout flow — setup: authenticated user; do: call logout; expect: user null, tokens cleared, /auth/logout called.
- **IT-054.E4**: auth-provider token refresh — setup: expired access token; do: make API call; expect: refresh token used, original request retried.

### Frontend: ProtectedRoute (US-018)

- **IT-055**: ProtectedRoute initializing — setup: session loading; do: render; expect: FullPageLoader shown.
- **IT-055.E1**: ProtectedRoute unauthenticated — setup: no session; do: render; expect: redirect to /login.
- **IT-055.E2**: ProtectedRoute unauthorized — setup: authenticated without permission; do: render with permission prop; expect: ForbiddenPage shown.
- **IT-055.E3**: ProtectedRoute authorized — setup: authenticated with permission; do: render; expect: Outlet/children rendered.

### Frontend: LGPD Page (US-001 to US-010)

- **IT-056**: LGPD page renders tabs — setup: admin user; do: navigate to /lgpd; expect: three tabs visible (Solicitações, Exportar, Consentimento).
- **IT-056.E1**: LGPD page resident view — setup: resident user; do: navigate to /lgpd; expect: Export and Consent tabs visible, Requests tab shows own requests only.
- **IT-056.E2**: LGPD page permission gating — setup: user without lgpd:read; do: navigate to /lgpd; expect: ForbiddenPage or redirect.
