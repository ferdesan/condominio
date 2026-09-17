---
status: completed
title: "Frontend LGPD Module"
type: frontend
complexity: high
---

# Frontend LGPD Module

## Overview

Build the complete frontend LGPD feature: types, hooks, Zod schemas, labels, a tabbed page with three sections (Solicitações, Exportar, Consentimento), navigation integration, and routing. The module follows existing frontend patterns (useListState, CrudLayout, DataTable, FormDialog, renderWithProviders) and consumes the LGPD API endpoints created in Task 2.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `types/lgpd.ts` with TypeScript types for LgpdRequest, LgpdConsent, LgpdExportPayload
- MUST create `lgpd-hooks.ts` with React Query hooks for all LGPD endpoints
- MUST create `lgpd-schema.ts` with Zod validation schemas for delete request and consent forms
- MUST create `lgpd-labels.ts` with human-readable status labels
- MUST create `lgpd-page.tsx` with Radix Tabs (Solicitações, Exportar, Consentimento)
- MUST create `lgpd-requests-tab.tsx` showing deletion requests with status, execute/cancel actions (admin), own request creation (resident)
- MUST create `lgpd-export-tab.tsx` with export button (resident) or resident selector + export (admin)
- MUST create `lgpd-consent-tab.tsx` with consent toggle (resident) or read-only view (admin)
- MUST add "Privacidade" navigation section to `navigation.ts` with Shield icon and `lgpd:read` permission
- MUST add `/lgpd` route to `app-router.tsx` with `ProtectedRoute permission="lgpd:read"`
- MUST add `'/lgpd'` to the `IMPLEMENTED` set in `app-router.tsx`
- MUST add "Solicitar exclusão de dados" link in profile page navigating to `/lgpd`
- MUST use existing UI components: PageHeader, DataTable, Dialog, ConfirmDialog, Button, Tabs, Select, Skeleton
- MUST use `renderWithProviders` test harness for all test files
- MUST implement integration tests (IT-053 to IT-056) assigned to this task
</requirements>

## Subtasks

- [x] 3.1 Create `types/lgpd.ts` with all LGPD TypeScript types
- [x] 3.2 Create `lgpd-hooks.ts` with React Query hooks for deletion requests, export, consent
- [x] 3.3 Create `lgpd-schema.ts` with Zod schemas and form value conversion functions
- [x] 3.4 Create `lgpd-labels.ts` with status and type label mappings
- [x] 3.5 Create `lgpd-requests-tab.tsx` — admin: DataTable with requests, execute/cancel; resident: own requests + new request button
- [x] 3.6 Create `lgpd-export-tab.tsx` — export button with JSON download, admin resident selector
- [x] 3.7 Create `lgpd-consent-tab.tsx` — consent toggle with confirmation dialog, admin read-only
- [x] 3.8 Create `lgpd-page.tsx` — page layout with Radix Tabs wrapping the 3 tab components
- [x] 3.9 Update `navigation.ts` — add "Privacidade" section with LGPD item
- [x] 3.10 Update `app-router.tsx` — add route and IMPLEMENTED entry
- [x] 3.11 Update `profile-page.tsx` — add deletion request link
- [x] 3.12 Implement integration tests for LGPD page rendering and tab switching
- [x] 3.13 Verify all tests pass

## Implementation Details

### Relevant Files
- `frontend/src/types/` — Reference for type file pattern (per-resource type files)
- `frontend/src/lib/crud/resource-hooks.ts` — Hook factory (may not be used, LGPD ops are non-standard)
- `frontend/src/lib/api.ts` — apiGet, apiPost, apiGetPaginated helpers
- `frontend/src/lib/permissions.ts` — hasPermission for role-based tab visibility
- `frontend/src/providers/auth-provider.tsx` — useAuth() for can() checks
- `frontend/src/components/common/crud-layout.tsx` — Page layout pattern
- `frontend/src/components/common/data-table.tsx` — DataTable component
- `frontend/src/components/common/confirm-dialog.tsx` — Confirmation dialogs
- `frontend/src/components/common/page-header.tsx` — Page header
- `frontend/src/components/ui/dialog.tsx` — Dialog component
- `frontend/src/components/ui/tabs.tsx` — Radix Tabs wrapper
- `frontend/src/components/ui/button.tsx` — Button component
- `frontend/src/components/ui/select.tsx` — Select component
- `frontend/src/components/ui/skeleton.tsx` — Loading skeleton
- `frontend/src/features/residents/residents-page.tsx` — Reference for page pattern
- `frontend/src/features/residents/resident-hooks.ts` — Reference for hooks pattern
- `frontend/src/features/residents/resident-schema.ts` — Reference for schema pattern
- `frontend/src/routes/navigation.ts` — Add navigation section
- `frontend/src/routes/app-router.tsx` — Add route
- `frontend/src/features/profile/profile-page.tsx` — Add deletion link

### Dependent Files
- `frontend/src/features/lgpd/` — New directory with all LGPD frontend files

### Related ADRs
- [ADR-002: LGPD Data Export Format](../adrs/adr-002.md) — JSON export structure
- [ADR-005: LGPD Frontend Route Design](../adrs/adr-005.md) — Tabbed page design

## Progress

- Backend IT-053 implementado nesta tarefa (o unico teste de backend atribuido): `PUT /tenants/:id/lgpd-settings` no modulo de tenants, com `dpoName`/`dpoEmail`/`retentionYears`, validacao Zod no tenant service (convencao 422), registro de auditoria e modos `put` no `AuthenticatedAgent`. Coberto em `backend/tests/integration/lgpd.spec.ts` (IT-053, E1, E2, E3).
- Frontend entregue em `frontend/src/features/lgpd/`: `types/lgpd.ts`, `lgpd-hooks.ts`, `lgpd-schema.ts`, `lgpd-labels.ts`, `lgpd-page.tsx` (abas controladas por `?tab=`), e os tres componentes de aba. Adicionados `components/ui/tabs.tsx`, `components/ui/switch.tsx` e os parametros `lgpdRequestFilters/Searchable/Sortable` em `lib/crud/query-params.ts`.
- Integracao: secao "Privacidade" em `navigation.ts` (item LGPD com `lgpd:read`), rota `/lgpd` + `IMPLEMENTED` + `ProtectedRoute permission="lgpd:read"` em `app-router.tsx` (e entrada correspondente no `REGISTERED` de `test/routes.test.tsx`), e link "Solicitar exclusao de dados" no perfil para moradores navegando para `/lgpd?tab=export` (techspec).
- A aba de consentimento discrimina por papel (RESIDENT) e nao por permissao: o ADMIN carrega `['*']`, que satisfaz `lgpd-consent:create` e receberia o toggle indevido. Per `lgpd:read`, as tres abas sao visiveis (ADR-005); dentro de cada uma o conteudo segue a permissao do papel.
- Verificacao: backend `npx tsc --noEmit` limpo e suíte com 230 testes passando; frontend `npm run typecheck` e `npm run lint` (0 erros) e suíte vitest com 968 testes passando.

## Deliverables
- `frontend/src/types/lgpd.ts` — TypeScript types
- `frontend/src/features/lgpd/lgpd-hooks.ts` — React Query hooks
- `frontend/src/features/lgpd/lgpd-schema.ts` — Zod schemas
- `frontend/src/features/lgpd/lgpd-labels.ts` — Status labels
- `frontend/src/features/lgpd/lgpd-page.tsx` — Main page with tabs
- `frontend/src/features/lgpd/components/lgpd-requests-tab.tsx`
- `frontend/src/features/lgpd/components/lgpd-export-tab.tsx`
- `frontend/src/features/lgpd/components/lgpd-consent-tab.tsx`
- Updated `navigation.ts`, `app-router.tsx`, `profile-page.tsx`
- Integration test file for LGPD page
- All assigned test cases implemented and passing

## Tests

Cases assigned from `_tests.md`:

- [x] IT-053, IT-053.E1, IT-053.E2 — DPO configuration (tenant settings)
- [x] IT-054, IT-054.E1, IT-054.E2, IT-054.E3, IT-054.E4 — Auth provider session lifecycle
- [x] IT-055, IT-055.E1, IT-055.E2, IT-055.E3 — ProtectedRoute guard behavior
- [x] IT-056, IT-056.E1, IT-056.E2 — LGPD page rendering and permission gating

## Success Criteria
- LGPD page renders with 3 tabs
- Admin sees all 3 tabs; resident sees Export and Consent tabs
- Deletion request flow works end-to-end (create → list → execute)
- Data export downloads valid JSON file
- Consent toggle updates status and audit log
- Navigation shows "Privacidade" section with correct permission gating
- Profile page has deletion request link
- All 4 integration tests pass
