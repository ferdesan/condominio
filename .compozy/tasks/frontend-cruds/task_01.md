---
status: completed
title: Data foundation and test harness
type: frontend
complexity: high
---

# Task 1: Data foundation and test harness

## Overview

Builds the layer every screen in this workflow stands on: the domain types for the five
entities the API already serves, a resource-hook factory that turns the backend's uniform
CRUD surface into typed React Query hooks, and the shared view-state hook that owns
pagination, search, sort and filters. It also makes the frontend testable at all — the
harness exists but has never run a test, and the browser APIs the Radix primitives need
are absent from the test environment.

Nothing renders in this task. It delivers the contract that tasks 3 through 7 consume.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST extend `frontend/src/types/api.ts` with `Unit`, `Resident`, `Reservation`, `Block`, `CommonArea` and `AvailabilityEntry`, following that file's existing conventions: type aliases rather than interfaces, `T | null` for optional server fields, and const-array-plus-index for enums.
- MUST complete the existing `Condominium` type with the eight fields it omits (`zipCode`, `complement`, `phone`, `email`, `syndicPhone`, `syndicTermEndsAt`, `notes`, timestamps) and narrow its `type` and `status` from `string` to their unions.
- MUST NOT break existing consumers when narrowing those unions — `npm --prefix frontend run typecheck` MUST pass, because it is a blocking CI gate while lint is not.
- MUST create `frontend/src/lib/crud/` containing the query-parameter builder, the resource-hook factory and the list-state hook, per the Core Interfaces section of the TechSpec.
- MUST clamp `perPage` to the server maximum of 200 and serialise array filter values as comma-separated strings, matching the backend's query parser.
- MUST reset the page to 1 on every change to search, filters, or the deleted-record toggle, because the table component holds no state and will not reset it.
- MUST expose an extra-invalidation option on the factory so condominium mutations can also refresh the application shell's selector query.
- MUST extend `frontend/src/test/setup.ts` with the layout observer, intersection observer, scroll-into-view and pointer-capture APIs that Radix requires and jsdom lacks.
- MUST provide a render helper that mounts a component inside the query provider, a memory router, and the auth and condominium contexts, accepting the role and selected condominium per call.
- MUST add the coverage provider as a dev dependency and configure it, so the coverage command runs.
- MUST NOT add any runtime dependency.
</requirements>

## Subtasks

- [ ] 1.1 Extend the domain types with the five new entities and the availability entry shape, which differs from the reservation entity.
- [ ] 1.2 Complete and narrow the existing condominium type, then verify no existing consumer breaks.
- [ ] 1.3 Build the query-parameter module: reserved parameters, filter serialisation, per-resource filter and sort whitelists.
- [ ] 1.4 Build the resource-hook factory covering list, get, create, update, remove and restore, with query-key composition and invalidation.
- [ ] 1.5 Build the list-state hook, including debounced search and the page-reset rules.
- [ ] 1.6 Add a count helper that reads `meta.total` from a single-record request, since no aggregate endpoints exist.
- [ ] 1.7 Extend the test setup with the missing browser APIs.
- [ ] 1.8 Write the render helper and the typed fixture module.
- [ ] 1.9 Add and configure the coverage provider.
- [ ] 1.10 Implement every assigned unit case.

## Implementation Details

Create `frontend/src/lib/crud/query-params.ts`, `resource-hooks.ts` and `list-state.ts`.
The TechSpec's **Core Interfaces** section carries the exact shapes for `ListParams`,
`ResourceHooks` and `ListState`; build to those signatures, since tasks 3 to 6 are
written against them.

Modify `frontend/src/types/api.ts` in place — it is the single central type module and
there is no per-feature type convention to follow.

Create `frontend/src/test/render.tsx` and `frontend/src/test/fixtures.ts` beside the
existing setup file. The query client is already constructed per mount, so cache
isolation between cases is inherent and needs no extra work.

Integration points: the transport helpers in `frontend/src/lib/api.ts` already unwrap the
response envelope and normalise every failure into `ApiError` — build on them and do not
reimplement either. The application shell's selector query key is `['condominiums',
'options']`; the factory's extra-invalidation option exists for it.

### Relevant Files

- `frontend/src/types/api.ts` (92 lines) — the central type module to extend; shows the conventions to follow.
- `frontend/src/lib/api.ts` (197 lines) — transport helpers and `ApiError`; note there is no `apiPut`, and `apiPatch` takes no config argument.
- `frontend/src/providers/query-provider.tsx` (43 lines) — client defaults: 30s stale time, no retry on 4xx, and the global mutation error handler that a mutation's own `onError` overrides.
- `frontend/src/providers/condominium-provider.tsx` (68 lines) — the selector query whose key must be invalidated by condominium mutations.
- `frontend/src/providers/auth-context.ts`, `condominium-context.ts` — exported separately from their providers, which is what lets the render helper inject them directly.
- `frontend/src/test/setup.ts` (17 lines) — currently polyfills only the media-query API.
- `frontend/vite.config.ts` (42 lines) — the test block; coverage is unconfigured.
- `backend/src/shared/http/query-parser.ts` — the authoritative reserved-parameter and filter-parsing rules.
- `backend/src/shared/repositories/base.repository.ts` — where unwhitelisted filters and sort columns are dropped silently.
- `backend/tests/unit/query-parser.spec.ts`, `pagination.spec.ts` — executable specification of the parameter contract.

### Dependent Files

- Every file created by tasks 3 through 7 — they consume these hooks and types.
- `frontend/src/features/dashboard/dashboard-page.tsx` — reads condominium fields; affected by the union narrowing.
- `frontend/package.json`, `frontend/vite.config.ts` — coverage dependency and configuration.

### Related ADRs

- [ADR-008: Resource-Hook Factory as the Data-Access Layer](adrs/adr-008.md) — the reason this layer exists and the boundary it must not cross: it owns data access, never rendering, and resource-specific endpoints stay with their feature.
- [ADR-010: The Transport Module as the Test Seam](adrs/adr-010.md) — why the transport module is doubled in screen tests and gets its own unit coverage here.
- [ADR-001: Frontend-Only Scope Over the Existing API Contract](adrs/adr-001.md) — no backend change; the API contract is fixed input.

## Deliverables

- Five new entity types plus the availability entry shape, and a completed condominium type, all type-checking clean.
- `frontend/src/lib/crud/` with the parameter builder, hook factory, list-state hook and count helper.
- An extended test setup that lets Radix components render under test.
- A render helper and typed fixtures that tasks 3 to 7 build their tests on.
- A working coverage command.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-001, UT-005, UT-006, UT-007 — query-parameter assembly, filter serialisation, empty-value handling, page-size clamping
- [ ] UT-016, UT-017, UT-018, UT-019, UT-020, UT-021, UT-022 — list-state initial values, debounce, page clamping, sort storage, deleted-toggle and clear-filter page resets
- [ ] UT-026, UT-027 — filter composition and key removal
- [ ] UT-029, UT-030, UT-031, UT-032, UT-033, UT-034, UT-035, UT-036, UT-037, UT-038, UT-039, UT-040 — resource-hook query keys, enabled guard, invalidation including the extra target, error surfacing, count via `meta.total`
- [ ] UT-041, UT-042, UT-043, UT-044, UT-045, UT-046, UT-047, UT-048, UT-049, UT-050, UT-051, UT-052 — transport: envelope unwrapping, error normalisation for 422/409/500/network, 204 with no body, single refresh per burst, session-expired event, bearer injection, replay idempotency

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` exits zero — the blocking CI gate
- `npm --prefix frontend run test` exits zero and reports a non-empty suite
- `npm --prefix frontend run test:cov` completes and writes a coverage report
- No runtime dependency added
- The hook factory's public signatures match the TechSpec's Core Interfaces exactly, so tasks 3 to 6 need no adaptation
