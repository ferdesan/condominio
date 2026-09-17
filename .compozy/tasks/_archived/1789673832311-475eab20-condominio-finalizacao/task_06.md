---
status: completed
title: "Frontend LGPD Tests"
type: test
complexity: low
---

# Frontend LGPD Tests

## Overview

Create integration tests for the LGPD frontend page, verifying correct rendering of tabs, permission-based visibility, and tab switching behavior. This task depends on Task 3 (Frontend LGPD Module) being complete and uses the same test patterns established in Task 5.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `frontend/src/features/lgpd/__tests__/lgpd-page.test.tsx`
- MUST test that admin user sees all 3 tabs (Solicitações, Exportar, Consentimento)
- MUST test that resident user sees Export and Consent tabs, and own requests in Requests tab
- MUST test that user without `lgpd:read` permission is blocked (ForbiddenPage or redirect)
- MUST test tab switching behavior
- MUST use `renderWithProviders` from `frontend/src/test/render.tsx`
- MUST use `vi.mock('@/lib/api')` for API mocking
- MUST implement IT-056 and its sub-cases
</requirements>

## Subtasks

- [x] 6.1 Create `lgpd-page.test.tsx` with test setup (mock API, render with providers)
- [x] 6.2 Test admin view: all 3 tabs visible and rendered
- [x] 6.3 Test resident view: Export and Consent tabs visible, Requests shows own requests
- [x] 6.4 Test permission gating: user without lgpd:read sees ForbiddenPage
- [x] 6.5 Test tab switching: clicking each tab shows correct content
- [x] 6.6 Verify all tests pass

## Implementation Details

### Relevant Files
- `frontend/src/features/lgpd/lgpd-page.tsx` — Main page under test (from Task 3)
- `frontend/src/features/lgpd/components/lgpd-requests-tab.tsx` — Tab component under test
- `frontend/src/features/lgpd/components/lgpd-export-tab.tsx` — Tab component under test
- `frontend/src/features/lgpd/components/lgpd-consent-tab.tsx` — Tab component under test
- `frontend/src/test/render.tsx` — renderWithProviders harness
- `frontend/src/test/fixtures.ts` — makeAuthUser, makeCondominium factories
- `frontend/src/lib/api.ts` — Mock target

### Dependent Files
- Task 3 must be complete (LGPD page and components exist)

### Related ADRs
- [ADR-005: LGPD Frontend Route Design](../adrs/adr-005.md) — Tab-based page design

## Deliverables
- `frontend/src/features/lgpd/__tests__/lgpd-page.test.tsx`
- All assigned test cases implemented and passing

## Tests

Cases assigned from `_tests.md`:

- [x] IT-056 — LGPD page renders tabs for admin user
- [x] IT-056.E1 — LGPD page resident view (Export + Consent tabs, own requests)
- [x] IT-056.E2 — LGPD page permission gating (user without lgpd:read)

## Success Criteria
- LGPD page test file created and passing
- Admin view shows all 3 tabs
- Resident view shows correct tabs with role-appropriate content
- Unauthorized user is blocked
- Tab switching works correctly
