---
status: completed
title: Condomínios — reference implementation
type: frontend
complexity: high
---

# Task 3: Condomínios — reference implementation

## Overview

Delivers the first working screen of the product and, in doing so, fixes the patterns the
remaining three modules follow: how a listing is composed, how a form dialog handles both
field-level and form-level server errors, how destructive actions confirm and report
blocked deletions, how deleted records are surfaced and restored, and how permissions gate
what renders. Condominiums is the smallest of the four modules and the only one without a
complication of its own, which is what makes it the right place to set the pattern.

It is also the module most coupled to the rest of the application: the shell's condominium
selector reads the same collection, so every mutation here must refresh it.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST present a paginated listing with name, document, síndico, city and status, searchable across name, document, city and district, and filterable by status and type — the server's whitelist, and nothing outside it.
- MUST offer sorting only on columns the server can sort by; an unsortable column offered as sortable is silently ignored by the API and appears broken.
- MUST create and edit in a dialog over the list so filters, search and page survive the action, per ADR-004.
- MUST distinguish the two server error classes: a response carrying field detail renders against the field; a response without it — conflicts and business-rule violations alike — renders as a form-level message. Status code alone does not distinguish them.
- MUST surface the plan-limit refusal and the duplicate-document conflict with the server's own message, not a generic one.
- MUST refuse deletion gracefully when the server reports existing units, keeping the record listed.
- MUST invalidate the application shell's selector query on every create, update, delete and restore, or the selector goes stale.
- MUST provide a detail route at `/condominios/:id` showing the full record and the seven counters from the statistics endpoint, with the record still rendering if the counters fail.
- MUST offer a deleted-records toggle and a restore action, gated on the update permission rather than the delete permission.
- MUST hide create, edit, delete and restore actions from roles lacking the corresponding permission.
- MUST register the route and remove its path from the placeholder set in the router.
- MUST ask for confirmation before discarding a dirty form.
- SHOULD keep the feature's internal imports relative and everything outside it aliased, matching the existing convention.
</requirements>

## Subtasks

- [ ] 3.1 Instantiate the resource hooks for this resource, including the shell-selector invalidation target.
- [ ] 3.2 Build the listing: columns, search, sort, status and type filters, pagination, empty states.
- [ ] 3.3 Build the form dialog covering the full record, with the schema and the two-class error handling.
- [ ] 3.4 Build the delete confirmation, including the blocked-deletion path.
- [ ] 3.5 Add the deleted-records toggle and the restore action.
- [ ] 3.6 Build the detail page with the record and its counters, each loading independently.
- [ ] 3.7 Gate every action on its permission.
- [ ] 3.8 Register both routes and remove the path from the placeholder set.
- [ ] 3.9 Verify the shell selector reflects every mutation.
- [ ] 3.10 Implement every assigned unit and integration case.

## Implementation Details

Create `frontend/src/features/condominiums/` with the list page, the detail page, the form
dialog, and a small hooks module instantiating the factory from task 1. Follow the
dashboard feature's layout: sub-components under a `components/` subdirectory, no barrel
file, kebab-case filenames, named function exports.

Modify `frontend/src/routes/app-router.tsx` (46 lines). Routes are generated from the
navigation entries for every path **not** in the implemented set, so registering a real
screen means adding its path to that set and declaring the route. The navigation entry and
its permission already exist and need no change.

The form is the largest in this workflow — roughly twenty fields — and the dialog content
carries a fixed maximum width, so it needs a wider variant.

Compose the screen from the existing layout components rather than new ones: the page
header, the CRUD layout, the filter panel, the confirmation dialog and the empty state all
exist. The filter panel requires children — it renders the active-filter chips itself and
expects the actual controls to be supplied.

Indicator counts elsewhere in this workflow come from `meta.total`; here the statistics
endpoint provides them directly.

### Relevant Files

- `frontend/src/routes/app-router.tsx` (46 lines) — the placeholder set and the route table.
- `frontend/src/routes/navigation.ts` (126 lines) — the entry and permission already declared for this path.
- `frontend/src/routes/protected-route.tsx` (24 lines) — the permission guard to wrap routes with.
- `frontend/src/features/dashboard/dashboard-page.tsx` (162 lines) — the only real screen; the source of the data-fetching, loading, empty-state and header conventions.
- `frontend/src/features/auth/login-page.tsx` (174 lines) — the only real form; the source of the error-mapping and accessibility conventions.
- `frontend/src/providers/condominium-provider.tsx` (68 lines) — the selector whose query must be invalidated.
- `frontend/src/hooks/use-auth.ts` — exposes the permission predicate; there is no permission-gate component, so gating is a conditional render.
- `frontend/src/components/common/` — page header, CRUD layout, filter panel, confirm dialog, empty state, and the table repaired in task 2.
- `backend/src/modules/condominiums/condominium.schema.ts` — field-level validation the client schema should mirror.
- `backend/src/modules/condominiums/condominium.service.ts` — the plan-limit, duplicate-document and blocked-deletion rules and their exact messages.
- `backend/tests/integration/condominium-structure.spec.ts` (196 lines) — executable contract for this resource.

### Dependent Files

- `frontend/src/routes/app-router.tsx` — gains two routes.
- Tasks 4, 5 and 6 — they copy the patterns this task establishes; divergence here propagates.
- `frontend/src/providers/condominium-provider.tsx` — its cached collection is invalidated by this screen.

### Related ADRs

- [ADR-004: Dialog-Based Create and Edit, With a Detail Route Only for Condominiums](adrs/adr-004.md) — why the dialog preserves list context and why this module alone earns a page.
- [ADR-006: Soft-Deleted Records Remain Reachable and Restorable](adrs/adr-006.md) — the deleted toggle and restore, and the restore-conflict remedy.
- [ADR-002: Back-Office Personas Only for the Initial Release](adrs/adr-002.md) — which roles see which actions.
- [ADR-008: Resource-Hook Factory as the Data-Access Layer](adrs/adr-008.md) — the hooks this screen consumes and the extra-invalidation option it needs.

## Deliverables

- A working condominiums listing with search, sort, filters, pagination and empty states.
- A create-and-edit dialog covering the full record, handling both server error classes.
- Delete with confirmation and a graceful blocked-deletion path.
- A deleted-records toggle and a restore action.
- A detail page with the record and its seven counters.
- Two registered routes, removed from the placeholder set.
- A shell selector that stays current across every mutation.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-002, UT-003, UT-004 — the condominium schema: name minimum, document length, state upper-casing
- [ ] IT-001 – IT-009 — listing: the journey through search, sort and paging, plus both empty states, debounce, unsortable columns, full-page rendering, page overrun, session expiry, null cells
- [ ] IT-010 – IT-019 — registration: the journey, duplicate document, deleted-record document, plan limit, inline validation, double submit, dirty dismissal, network failure, state normalisation
- [ ] IT-020 – IT-025 — editing: the journey, conflict, record gone, concurrent edit, clearing an optional field, missing record by link
- [ ] IT-026 – IT-031 — detail page: the journey, missing and malformed identifiers, all-zero counters, counters failing independently, out-of-scope access
- [ ] IT-032 – IT-038 — deletion: the journey, blocked by units, deleting the selected condominium, deleting the last one, already deleted, dismissal, double confirmation
- [ ] IT-039 – IT-043 — restoration: the journey, no deleted records, marking deleted rows, restore conflict, toggle persistence across pages
- [ ] IT-207, IT-208, IT-209 — data-layer boundary: a create refreshing a rendered list, a condominium create refreshing the shell selector, and the repaired table wired to the data layer paging and translating sort direction

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` exits zero
- `/condominios` and `/condominios/:id` render real screens; neither reaches the placeholder
- A blocked deletion shows the server's explanation and leaves the record listed
- Creating a condominium makes it selectable in the shell without a reload
- An operator sees the listing and the detail page with no create, edit, delete or restore action
- The patterns established here are documented well enough by the code itself that tasks 4 to 6 can follow them without re-deciding
