---
status: pending
title: "Frontend Infrastructure Tests"
type: test
complexity: medium
---

# Frontend Infrastructure Tests

## Overview

Create dedicated unit tests for the 3 most security-critical frontend infrastructure modules (auth-provider, permissions.ts, ProtectedRoute) and high-value untested modules (theme-provider, use-account-theme, utils, query-provider, financial components, dashboard components). These tests use the existing Vitest + Testing Library setup with `renderWithProviders` harness and mock patterns.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `frontend/src/providers/__tests__/auth-provider.test.tsx` testing session lifecycle (restore, login, logout, refresh, session-expired)
- MUST create `frontend/src/lib/__tests__/permissions.test.ts` testing hasPermission() and hasAnyPermission() with all edge cases
- MUST create `frontend/src/routes/__tests__/protected-route.test.tsx` testing initializing, unauthenticated, unauthorized, authorized states
- MUST create `frontend/src/providers/__tests__/theme-provider.test.tsx` testing localStorage persistence, system detection, toggle
- MUST create `frontend/src/hooks/__tests__/use-account-theme.test.ts` testing theme adoption and device choice override
- MUST create `frontend/src/lib/__tests__/utils.test.ts` testing cn(), initials(), sleep()
- MUST create `frontend/src/providers/__tests__/query-provider.test.tsx` testing 401 skip, error toasts
- MUST create `frontend/src/features/financial/__tests__/financial-components.test.tsx` testing financial summary, categories, charges, expenses sections
- MUST create `frontend/src/features/dashboard/__tests__/dashboard-components.test.tsx` testing stat-card, activity-feed, charts
- MUST use `renderWithProviders` from `frontend/src/test/render.tsx` for all component tests
- MUST use `vi.mock('@/lib/api')` pattern for transport-layer doubles
- MUST implement all assigned UT cases (UT-024 to UT-032)
</requirements>

## Subtasks

- [ ] 5.1 Create `auth-provider.test.tsx` — session restore, login, logout, token refresh, session-expired event
- [ ] 5.2 Create `permissions.test.ts` — hasPermission, hasAnyPermission, wildcard, manage, edge cases
- [ ] 5.3 Create `protected-route.test.tsx` — initializing loader, redirect to login, ForbiddenPage, children rendered
- [ ] 5.4 Create `theme-provider.test.tsx` — localStorage, system preference, toggleTheme, setTheme
- [ ] 5.5 Create `use-account-theme.test.ts` — account adoption, device choice override, re-mount latch
- [ ] 5.6 Create `utils.test.ts` — cn(), initials(), sleep()
- [ ] 5.7 Create `query-provider.test.tsx` — 401 skip, mutation error toast
- [ ] 5.8 Create `financial-components.test.tsx` — summary, categories, charges, expenses, forms
- [ ] 5.9 Create `dashboard-components.test.tsx` — stat-card, activity-feed, charts, tooltip
- [ ] 5.10 Verify all tests pass

## Implementation Details

### Relevant Files
- `frontend/src/test/setup.ts` — Test setup (jsdom polyfills, cleanup)
- `frontend/src/test/render.tsx` — `renderWithProviders` harness with role injection
- `frontend/src/test/fixtures.ts` — Factory functions (makeAuthUser, makeCondominium, etc.)
- `frontend/src/providers/auth-provider.tsx` — Module under test
- `frontend/src/lib/permissions.ts` — Module under test
- `frontend/src/routes/protected-route.tsx` — Module under test
- `frontend/src/providers/theme-provider.tsx` — Module under test
- `frontend/src/hooks/use-account-theme.ts` — Module under test
- `frontend/src/lib/utils.ts` — Module under test
- `frontend/src/providers/query-provider.tsx` — Module under test
- `frontend/src/features/financial/` — Components under test
- `frontend/src/features/dashboard/` — Components under test
- `frontend/src/lib/api.ts` — Mock target for all tests

### Dependent Files
- None (tests are standalone, do not modify source code)

### Related ADRs
- [ADR-003: Testing Priority Strategy](../adrs/adr-003.md) — Risk-based prioritization

## Deliverables
- 9 new test files covering infrastructure and high-value modules
- All assigned unit test cases implemented and passing
- No regressions in existing test suite

## Tests

Cases assigned from `_tests.md`:

- [ ] UT-024 (all sub-cases) — auth-provider session lifecycle
- [ ] UT-025 (all sub-cases) — permissions.ts authorization logic
- [ ] UT-026 (all sub-cases) — ProtectedRoute guard behavior
- [ ] UT-027 (all sub-cases) — theme-provider persistence
- [ ] UT-028 (all sub-cases) — use-account-theme hook
- [ ] UT-029 (all sub-cases) — utils.ts pure functions
- [ ] UT-030 (all sub-cases) — query-provider error handling
- [ ] UT-031 (all sub-cases) — financial module components
- [ ] UT-032 (all sub-cases) — dashboard components

## Success Criteria
- All 9 test files created and passing
- auth-provider tests cover: session restore, login, logout, refresh, session-expired
- permissions tests cover: exact match, wildcard, manage, empty, undefined
- ProtectedRoute tests cover: initializing, unauthenticated, unauthorized, authorized
- No regressions in existing test suite
