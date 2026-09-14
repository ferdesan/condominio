# TechSpec: Back-Office Screens for Condominiums, Units, Residents and Reservations

## Executive Summary

Five feature areas are added to the existing React application — condominiums, units (with embedded block management), residents and reservations — plus a repair of the continuous integration pipeline. No backend change is in scope; every screen consumes endpoints that exist today, whose behavior the backend integration suite already pins down.

The design draws one new horizontal layer and leaves everything above it explicit. Because all five resources are served by one shared CRUD router on the backend, their HTTP surface is identical in shape, so a hook factory in `lib/crud/` produces each resource's list, get, create, update, remove and restore hooks from a path segment and three type parameters (ADR-008). It owns query-key composition, parameter assembly, sort-direction translation and invalidation. Above it, each feature writes its own screen by hand, because the screens diverge sharply — a calendar and an approval queue in reservations, bulk generation and block management in units, a detail route in condominiums, exclusive primary designation in residents.

Three existing pieces change. The shared table component is repaired in place, since it has no consumers and four defects that every listing would otherwise hit (ADR-009). The test setup gains the browser APIs the Radix primitives require, and the transport module becomes the seam for screen tests (ADR-010). The form layer gains a controlled-input pattern that does not yet exist in this codebase, because every Radix control in these forms needs it.

The principal trade-off is accepting one new abstraction in a codebase that has none, in exchange for removing roughly twenty-four near-identical query declarations and the silent query-key drift they invite.

## System Architecture

### Component Overview

```
frontend/src/
  lib/
    crud/
      resource-hooks.ts        NEW  hook factory: list/get/create/update/remove/restore
      query-params.ts          NEW  reserved params, filter serialisation, sort translation
      list-state.ts            NEW  useListState: page, search, sort, filters, deleted toggle
    api.ts                     unchanged  transport; the seam for screen tests
    format.ts                  unchanged  display formatters, all null-safe
  types/
    api.ts                     MODIFIED   add Unit, Resident, Reservation, Block, CommonArea;
                                          complete Condominium; add payload types
  components/
    common/data-table.tsx      MODIFIED   four defects repaired (ADR-009)
    ui/textarea.tsx            NEW        notes fields up to 2000 characters
    ui/date-time-input.tsx     NEW        date+time; reservations need both
    ui/date-picker.tsx         MODIFIED   sync with externally changed value
    ui/form-field.tsx          NEW        label + control + error, wired for aria
  features/
    condominiums/              NEW  list page, detail page, form dialog, hooks
    units/                     NEW  list page, form dialog, bulk-generate dialog,
                                    block manager, hooks
    residents/                 NEW  list page, form dialog, hooks
    reservations/              NEW  list page, calendar, form dialog, decision actions, hooks
  routes/app-router.tsx        MODIFIED   register five real routes
  test/
    setup.ts                   MODIFIED   browser API polyfills for Radix
    render.tsx                 NEW        render helper with providers, role, condominium
    fixtures.ts                NEW        typed domain fixtures
```

**Data flow.** A screen calls `useListState` for its view state, passes it to a resource hook, and renders the result through the table. The hook factory translates view state into the API's query contract, calls the transport helpers, and returns React Query state. Mutations invalidate the resource key; the screen reacts to the refreshed list. Nothing bypasses the factory except the six resource-specific endpoints, which are written as ordinary hooks beside their feature.

**External interaction.** One system: the platform's own REST API under `/api/v1`, reached through the existing transport module, which already handles bearer injection, token refresh and session expiry.

**Existing context consumed.** The authentication context supplies the permission predicate; the condominium context supplies the selected condominium that scopes four of the five resources. Both already wrap every authenticated route.

## Implementation Design

### Core Interfaces

The hook factory is the primary type other components depend on:

```ts
// lib/crud/resource-hooks.ts
export type ListParams = {
  page: number;
  perPage: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  includeDeleted?: boolean;
  filters?: Record<string, string | string[] | undefined>;
};

export type ResourceHooks<T, TCreate, TUpdate> = {
  useList: (params: ListParams, options?: { enabled?: boolean }) =>
    UseQueryResult<Paginated<T>, ApiError>;
  useOne: (id: string | null) => UseQueryResult<T, ApiError>;
  useCreate: () => UseMutationResult<T, ApiError, TCreate>;
  useUpdate: () => UseMutationResult<T, ApiError, { id: string; data: TUpdate }>;
  useRemove: () => UseMutationResult<void, ApiError, string>;
  useRestore: () => UseMutationResult<T, ApiError, string>;
};

export function createResourceHooks<T, TCreate, TUpdate>(
  resource: string,
  options?: { extraInvalidate?: readonly unknown[][] },
): ResourceHooks<T, TCreate, TUpdate>;
```

View state, shared by all five listings:

```ts
// lib/crud/list-state.ts
export type ListState = {
  page: number;
  search: string;          // debounced value, safe to send
  searchInput: string;     // immediate value, bound to the input
  sort: SortState | undefined;
  filters: Record<string, string | string[] | undefined>;
  includeDeleted: boolean;
  setPage: (page: number) => void;
  setSearch: (term: string) => void;
  setSort: (column: string, direction: SortDirection) => void;
  setFilter: (key: string, value: string | string[] | undefined) => void;
  clearFilters: () => void;
  setIncludeDeleted: (include: boolean) => void;
  toListParams: (perPage: number) => ListParams;
};
```

`setSearch`, `setFilter`, `clearFilters` and `setIncludeDeleted` reset `page` to 1, because a changed result set invalidates the current offset. The table component holds no state of its own, so this hook is the only owner of view state.

The form-error convention, applied identically in all five forms:

```ts
// applied in each form's onError
function applyApiError<F extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<F>,
  setFormError: (message: string | null) => void,
  fields: ReadonlySet<string>,
): void;
// Field detail present -> setError per field, for fields the form owns.
// No field detail (409 conflict or business rule) -> setFormError(error.message).
// Unknown fields in the payload fall through to setFormError.
```

### Data Models

New entity types in `types/api.ts`, following its conventions — type aliases, `T | null` for optional server fields, const arrays for enums:

```ts
export const UNIT_STATUSES = ['OCCUPIED', 'VACANT', 'RENOVATION', 'BLOCKED'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export type Unit = {
  id: string;
  condominiumId: string;
  blockId: string;
  number: string;
  floor: number;
  type: UnitType;
  status: UnitStatus;
  area: number | null;
  idealFraction: number | null;
  monthlyFee: number;
  bedrooms: number;
  parkingSpots: number;
  petsAllowed: boolean;
  notes: string | null;
  block?: Block;              // present: the API eager-loads it
  condominium?: Condominium;  // present: the API eager-loads it
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
```

The same shape is defined for `Resident` (with an eager-loaded `unit`), `Reservation` (with eager-loaded `commonArea` and `unit`), `Block` and `CommonArea`. `Condominium` is completed with the eight fields it currently omits, and its `type` and `status` are narrowed from `string` to their unions.

Availability entries have a different shape from the entity and get their own type:

```ts
export type AvailabilityEntry = {
  id: string;
  commonAreaId: string;
  commonAreaName: string | null;
  unitId: string;
  unitNumber: string | null;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  requestedByName: string | null;
};
```

Create and update payload types are derived from the Zod schemas with `z.infer`, colocated with each form, following the precedent in the sign-in page. Update payloads are the partial of create, matching the server.

### API Endpoints

Consumed, not defined. All under `/api/v1`, all requiring a bearer token.

**Uniform surface** for `condominiums`, `blocks`, `units`, `residents`, `reservations`:

| Method | Path | Permission | Success |
|---|---|---|---|
| GET | `/{resource}` | `{resource}:read` | 200 with `meta` |
| POST | `/{resource}` | `{resource}:create` | 201 |
| GET | `/{resource}/:id` | `{resource}:read` | 200 |
| PATCH | `/{resource}/:id` | `{resource}:update` | 200 |
| DELETE | `/{resource}/:id` | `{resource}:delete` | 204, no body |
| POST | `/{resource}/:id/restore` | `{resource}:update` | 200 |

Reserved query parameters: `page` (default 1), `perPage` (default 20, max 200), `sortBy`, `sortOrder` (`ASC`, else `DESC`), `search`, `includeDeleted`. Every other key is a filter; a comma-separated value becomes a set membership test; unwhitelisted filters and unsortable columns are ignored **silently**.

**Resource-specific:**

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/condominiums/:id/stats` | `condominium:read` | seven counters for the detail page |
| POST | `/units/bulk` | `unit:create` | returns `{ created: number }`; skips existing numbers |
| GET | `/units/ideal-fraction?condominiumId=` | `unit:read` | `{ total, isBalanced }` |
| GET | `/reservations/availability` | `reservation:read` | `condominiumId`, `from`, `to`, optional `commonAreaId`; flat array of `AvailabilityEntry`, pending and confirmed only |
| POST | `/reservations/:id/approve` | `reservation:manage` | `{ reason?: string \| null }` |
| POST | `/reservations/:id/reject` | `reservation:manage` | `{ reason?: string \| null }` |
| POST | `/reservations/:id/cancel` | `reservation:update` | `{ reason?: string \| null }` |
| GET | `/common-areas?condominiumId=` | `common-area:read` | read-only; supplies the reservation form's rules |

**Error contract.** 422 carries `details[]` with a field path — render against the field. 409 carries none — render as a form-level or row-level message. 409 covers both uniqueness conflicts and business-rule violations, so status alone does not distinguish them; the presence of field detail does.

Indicator counts are obtained by requesting `perPage=1` with the relevant filters and reading `meta.total`, which avoids aggregate endpoints that do not exist.

## Integration Points

One integration: the platform's REST API, same origin in production and proxied in development.

- **Authentication.** Bearer token injected by the existing request interceptor from local storage. A 401 outside the sign-in and refresh routes triggers one refresh per burst and a replay; a failed refresh dispatches a session-expired event that the auth provider already handles. No screen implements any part of this.
- **Authorisation.** Enforced server-side on every route. Mirrored client-side by the existing permission predicate to decide what is rendered. The two must agree; where they disagree, the server wins and the screen surfaces the refusal.
- **Error handling.** Every failure arrives as the normalised error type. Queries retry twice on 5xx and never on 4xx, per the existing client defaults. Mutations do not retry.
- **Toasts.** The query client's default mutation error handler raises a toast. In React Query v5 a mutation supplying its own `onError` **overrides** that default rather than running alongside it. Form mutations therefore supply `onError` and render inline; row actions omit it and inherit the toast, which is the right presentation for a 409 carrying only a message.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `components/common/data-table.tsx` | modified | Four defects repaired: unconditional slice, uncontrolled search, sort-direction case, column key type; plus keyboard-accessible rows. **Low risk** — zero consumers today. | Repair per ADR-009; update `COMPONENTS.md` in the same change |
| `types/api.ts` | modified | Five entity types added; `Condominium` completed and its enums narrowed from `string`. **Low risk**, but narrowing may surface type errors where `string` was assumed. | Extend; run type check across existing usages |
| `routes/app-router.tsx` | modified | Five routes registered and removed from the placeholder set. **Low risk**, mechanical. | Register as each screen lands |
| `components/ui/date-picker.tsx` | modified | Does not sync with an externally changed value, so form reset does not reach it. **Medium risk** — the fix changes behavior for any future consumer. | Add synchronisation; keep the existing signature |
| `components/ui/index.ts`, `common/index.ts` | modified | Barrels must export the new components. **No risk** — nothing imports the barrels today. | Extend for consistency |
| `test/setup.ts` | modified | Polyfills added for layout observer, intersection observer, scroll-into-view and pointer capture. **Low risk**; without them Radix tests fail for unrelated reasons. | Extend |
| `vite.config.ts` | modified | Coverage provider configured. **Low risk**. | Configure alongside the dependency |
| `frontend/package.json` | modified | Adds the coverage provider as a dev dependency. **Low risk**; no runtime dependency is added by this effort. | Add |
| `.github/workflows/ci-cd.yml` | unchanged | The test job fails only because the suite is empty; real tests resolve it without touching the workflow. | None — verify green |
| `providers/condominium-provider.tsx` | unchanged | Its query key must be invalidated by condominium mutations, handled by the hook factory's extra-invalidation option. | None |
| `COMPONENTS.md` | modified | Documents the repaired table and the four new components. | Update |
| Backend, in any form | unchanged | Out of scope by ADR-001. | None |

## Testing Approach

**Framework.** Vitest in a jsdom environment with globals enabled, Testing Library for rendering and interaction, and the existing setup file extended with the browser APIs Radix requires. Tests live beside the code they cover, inside `src/`, so the type checker includes them.

**Fixtures and fakes.** Fakes sit at one boundary only: the transport module (ADR-010). Screen tests replace it with a typed double and supply typed domain fixtures from `test/fixtures.ts`; error paths construct the real error type with a status and optional field details. Nothing else is faked — the query client, router, providers and components are real, mounted through `test/render.tsx`, which takes the caller's role and selected condominium. Query cache isolation is already guaranteed, because the client is constructed per mount.

**Unit** covers the pieces with logic of their own and no rendering: query-parameter assembly and filter serialisation, sort-direction translation, the list-state reducer including its page-reset rules, the local reservation rule derivation, the transport module's envelope unwrapping and error normalisation, and the API-error-to-form mapping.

**Integration** covers each screen as a mounted component against the transport double: listing with pagination, search, sort and filters; the create and edit dialogs including field-level and form-level error presentation; destructive actions with their confirmations and blocked-deletion messages; the restore path; permission-driven rendering per role; bulk generation; block management; the calendar's month composition; and the approval, rejection and cancellation actions with their refusals.

**End-to-end** is not introduced. No such harness exists in this repository, and adding one is outside ADR-001's boundary. The user journeys in `_user_stories.md` are covered as integration cases at the screen level, and the backend integration suite already covers the server side of each journey. `_tests.md` records this substitution explicitly.

**Environment.** None beyond the test runner — no database, no network, no service container. The pipeline's test job already provisions a database and cache for the backend suite; the frontend suite needs neither and receives no environment variables.

## Development Sequencing

### Build Order

1. **Types and transport groundwork** — extend `types/api.ts` with the five entities and the payload types; add the coverage dependency; extend `test/setup.ts` with the Radix polyfills; write `test/render.tsx` and `test/fixtures.ts`. No dependencies. Unblocks everything.
2. **Data layer** — `lib/crud/query-params.ts`, `resource-hooks.ts`, `list-state.ts`, with unit tests. Depends on step 1.
3. **Table repair and form primitives** — repair the table per ADR-009; add `textarea`, `date-time-input`, `form-field`; fix the date picker's synchronisation; update `COMPONENTS.md`. Depends on step 1; independent of step 2.
4. **Condominiums** — list, form dialog, detail page with statistics, delete and restore, route registration. Depends on steps 2 and 3. **This is the reference implementation**: it establishes the screen pattern, the form pattern and the permission-gating pattern that the remaining three follow.
5. **Units with blocks** — block management and inline creation first, since unit registration requires a block; then the listing, the form, bulk generation, occupancy indicators, delete and restore. Depends on step 4.
6. **Residents** — listing, form, primary designation, delete and restore. Depends on step 4; independent of step 5 except for the unit selector, which needs units to exist to be exercised.
7. **Reservations** — listing with the pending queue, the booking form with derived local rules, the month calendar, and the approve, reject and cancel actions. Depends on step 4. The largest and least uniform screen; sequenced last so the established patterns absorb its scaffolding.
8. **Pipeline verification** — confirm lint, type check, tests and build pass together, and that the coverage command runs.

Steps 5, 6 and 7 are mutually independent once step 4 lands, and may proceed in parallel.

### Technical Dependencies

- **Blocking:** none external. The API, the permission model and the component library all exist.
- **Internal:** step 4 defines the patterns steps 5 to 7 follow; parallelising them before it lands produces three divergent implementations of the same screen.
- **Dependency added:** the coverage provider, dev-only. No runtime dependency is added — the calendar is built from the date library already present, per ADR-003.
- **Open questions** in the PRD do not block: four concern presentation details resolvable at implementation time. The fifth — the notification link pointing at a reservation detail route that will not exist — affects only a screen that is out of scope, and is recorded rather than resolved here.

## Monitoring and Observability

Limited by scope: this is a browser client with no telemetry infrastructure in the repository, and adding one would exceed ADR-001. What exists and must keep working:

- **User-visible failure reporting.** The query client's global handlers raise a toast for query failures (except 401, handled by the interceptor) and for mutation failures that do not handle their own errors. Every new screen must leave one of those two paths intact for every failure, so no failure is silent.
- **Session expiry.** The transport module dispatches a session-expired event on refresh failure. Screens must not present this as a request error.
- **Server-side audit.** Permission denials and record mutations are already logged and audited by the backend, including denials the interface believed it had gated. That trail is the observability surface for these screens and requires no client work.
- **Deliberately not added:** client error reporting, performance instrumentation and usage analytics. Each would need infrastructure this effort cannot introduce.

## Technical Considerations

### Key Decisions

- **Decision:** A resource-hook factory owns data access; screens stay hand-written.
  **Rationale:** The five resources share one backend router, so their HTTP shape is identical while their interfaces are not. Abstracting the identical layer removes roughly twenty-four repetitions; leaving the divergent layer explicit avoids escape hatches.
  **Trade-offs:** Introduces the codebase's first abstraction of this kind, and moves type complexity into the factory.
  **Alternatives rejected:** Inline queries per page (repetition, silent key drift); a configuration-driven CRUD page (abstracts the wrong layer). See ADR-008.

- **Decision:** Repair the shared table in place.
  **Rationale:** Zero consumers, four defects every listing would otherwise work around individually.
  **Trade-offs:** Changes a component documented as complete; its documentation changes with it.
  **Alternatives rejected:** An adapter wrapper (defects survive in shared code); replacement (discards sound work). See ADR-009.

- **Decision:** The transport module is the test seam.
  **Rationale:** It already unwraps envelopes and normalises errors, so fixtures are typed domain objects and error paths are constructed directly. Its own logic gets dedicated unit tests.
  **Trade-offs:** Screen tests do not exercise the real transport; a signature change breaks every double at once, visibly.
  **Alternatives rejected:** A network-level mock (new dependency, refresh-flow complexity, fidelity concentrated where unit tests serve better); pure unit tests only (leaves every screen uncovered, contradicting US-028). See ADR-010.

- **Decision:** Reservation validation is split — eight rules locally, two server-only.
  **Rationale:** The area record carries the parameters for eight rules, so they answer immediately; overlap and interval require server state the client cannot read atomically.
  **Trade-offs:** Eight rules exist in two places, though parameterised from one source.
  **Alternatives rejected:** No local validation (nine constraints found by trial and error); full replication (stale conflict reads the server must re-check anyway). See ADR-011.

- **Decision:** List view state lives in component state, not the URL.
  **Rationale:** The PRD requires filters and page to survive create and edit, which dialogs preserve naturally. ADR-004 already accepted that units, residents and reservations are not deep-linkable.
  **Trade-offs:** A filtered listing cannot be shared as a link or restored by browser history.
  **Alternatives rejected:** URL-synchronised state, which adds serialisation and history handling for a requirement no story states.

- **Decision:** Introduce the controlled-input pattern for Radix controls.
  **Rationale:** Select, checkbox, the date-time input and the currency input all expose value-and-callback APIs incompatible with uncontrolled registration. No precedent exists in this codebase, so one must be set.
  **Trade-offs:** Forms mix registered and controlled fields, which is idiomatic but less uniform than either alone.
  **Alternatives rejected:** Native elements throughout, which would discard the component library delivered in the previous effort.

### Known Risks

- **A filter or sort the API ignores looks like it works.** Unwhitelisted filters and unsortable columns are dropped silently rather than refused, so a mistake presents as a control that does nothing. *Likelihood: high without care.* **Mitigation:** Whitelists per resource are recorded in this spec and asserted in unit tests over the parameter builder; only whitelisted keys may be offered as controls.
- **Page size and requested page size can disagree.** The table's slice drops rows when its page size is below the request's. *Likelihood: moderate.* **Mitigation:** The data layer owns both, threaded from one value; a test asserts a full page renders every row.
- **Global toast and inline form errors can double up.** *Likelihood: low, given v5 override semantics.* **Mitigation:** Form mutations always supply `onError`; a test asserts no toast accompanies a field-level error.
- **The date picker ignores externally changed values.** Editing an existing record would show a stale date. *Likelihood: certain if unaddressed.* **Mitigation:** Fixed in step 3, with a test covering a reset after mount.
- **Unit status appears editable but is recomputed.** Occupied and vacant are derived from residents and override a typed value, while renovation and blocked persist. *Likelihood: certain to confuse without treatment.* **Mitigation:** The interface explains the interaction; the PRD's open question on whether to offer all four values is resolved at implementation time and recorded.
- **Radix components fail in jsdom for environmental reasons.** Missing scroll and pointer-capture methods break any test that opens a select. *Likelihood: certain without polyfills.* **Mitigation:** Added to the shared setup in step 1, before any screen test is written.
- **Type narrowing on `Condominium` may break existing code.** Its `type` and `status` move from `string` to unions. *Likelihood: low — the dashboard reads few fields.* **Mitigation:** Type check immediately after step 1; the check is a blocking pipeline gate, so a regression cannot merge.
- **Approval can fail after acceptance.** A pending reservation may lose its slot before approval. *Likelihood: low but real.* **Mitigation:** The server's message is surfaced verbatim and the list refreshed; covered as an explicit test case.

## Architecture Decision Records

- [ADR-001: Frontend-Only Scope Over the Existing API Contract](adrs/adr-001.md) — every requirement is satisfiable by an endpoint that exists today; the pipeline repair is in scope.
- [ADR-002: Back-Office Personas Only for the Initial Release](adrs/adr-002.md) — administrator, síndico and porteiro; resident self-service deferred.
- [ADR-003: Monthly Calendar With Filterable List and an Inline Approval Queue](adrs/adr-003.md) — a month grid built from the date library already present; no new dependency.
- [ADR-004: Dialog-Based Create and Edit, With a Detail Route Only for Condominiums](adrs/adr-004.md) — list context survives every action; one new route.
- [ADR-005: Bulk Unit Generation as the Onboarding Path](adrs/adr-005.md) — the existing generation endpoint answers the onboarding need.
- [ADR-006: Soft-Deleted Records Remain Reachable and Restorable](adrs/adr-006.md) — a deleted-record toggle and a restore action on every listing.
- [ADR-007: Block Management Embedded in the Units Screen](adrs/adr-007.md) — satisfies the mandatory block dependency without a fifth module.
- [ADR-008: Resource-Hook Factory as the Data-Access Layer](adrs/adr-008.md) — one definition of query keys, parameters and invalidation; screens stay explicit.
- [ADR-009: Repairing the Shared Table Component In Place](adrs/adr-009.md) — four defects fixed where they live, with no consumers to regress.
- [ADR-010: The Transport Module as the Test Seam](adrs/adr-010.md) — typed fixtures at one boundary; the transport module gets its own unit tests.
- [ADR-011: Reservation Validation Split Between Client and Server](adrs/adr-011.md) — eight rules answered locally from the area record, two left to the server.
