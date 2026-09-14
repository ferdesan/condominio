---
status: completed
title: Unidades and embedded block management
type: frontend
complexity: high
---

# Task 4: Unidades and embedded block management

## Overview

Delivers the units screen and, inside it, the block management that units cannot exist
without. A unit requires a block, blocks have no screen of their own, and a newly
registered condominium has none — so without this the module would ship unusable in
exactly the onboarding scenario it exists to serve. The screen also carries bulk
generation, which is the only mass-creation path the API offers now that spreadsheet
import is out of scope, and the occupancy indicators the source specification asks for.

The subtlety here is that a unit's status is not fully under the user's control: the
residents module recomputes it.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST follow the screen, form, error-handling, permission-gating and restore patterns established in task 3 rather than inventing new ones.
- MUST scope every request to the condominium selected in the application shell, and explain the requirement rather than listing nothing when none is selected.
- MUST offer only the server's filter whitelist — condominium, block, status, type and floor — and search only by unit number, which is the sole searchable field.
- MUST allow creating a block from inside the unit form's block selector, preserving the unit data already entered, and MUST offer it directly when the condominium has no blocks at all.
- MUST provide management of the condominium's blocks — list, create, edit, delete — scoped to what unit registration needs, and MUST NOT grow it into a standalone module or register a route for it.
- MUST offer only the selected condominium's blocks in the selector, which prevents the cross-condominium mismatch the server refuses.
- MUST present bulk generation showing the projected unit count before confirming, and MUST report the count the server says it created — which may be lower, since existing numbers are skipped.
- MUST present the all-numbers-already-exist refusal as an outcome, not as a system error.
- MUST render occupancy indicators — total, occupied, available — and make their scope unambiguous when list filters are active.
- MUST convey that occupied and vacant are recomputed from residents and override a typed value, while renovation and blocked persist. Whatever the form offers, the status shown after saving MUST be the one the server returned.
- MUST surface the two distinct blocked-deletion reasons — active residents, open charges — with the server's own wording.
- MUST NOT introduce a route for blocks; the reserved navigation entry stays a placeholder.
</requirements>

## Subtasks

- [ ] 4.1 Build block management scoped to the selected condominium, with create, edit and delete.
- [ ] 4.2 Build inline block creation inside the unit form's selector, preserving entered unit data.
- [ ] 4.3 Build the units listing with search, the five whitelisted filters, sort, pagination and empty states.
- [ ] 4.4 Build the unit form dialog with the block selector and the full field set.
- [ ] 4.5 Build bulk generation with the projected count, the shared defaults and the created-count outcome.
- [ ] 4.6 Build the occupancy indicators.
- [ ] 4.7 Add deletion with both blocked-reason paths, plus the deleted toggle and restore.
- [ ] 4.8 Gate every action on its permission, including block creation.
- [ ] 4.9 Register the route and remove its path from the placeholder set.
- [ ] 4.10 Handle the status interaction so the displayed value is always the server's.
- [ ] 4.11 Implement every assigned unit and integration case.

## Implementation Details

Create `frontend/src/features/units/` with the list page, the form dialog, the bulk
generation dialog, the block manager, and the hooks module. Blocks get their hooks from
the same factory — they are a resource on the same uniform CRUD surface — but live inside
this feature directory, since ADR-007 keeps them out of the module structure.

Modify `frontend/src/routes/app-router.tsx` to register the units route and remove its
path from the placeholder set. Do **not** touch the blocks path.

Bulk generation's numbering pattern composes a floor and an index, with the index
zero-padded to two digits. Floors accept 1 to 100 and units per floor 1 to 50, so the
largest permitted grid is 5000 units — the interface must show progress rather than
appearing frozen at that size.

The ideal-fraction endpoint reports whether a condominium's fractions sum to one. It is
available and cheap; use it if it strengthens the screen, but no story requires it.

Occupancy counts come from `meta.total` on filtered single-record requests, using the
count helper from task 1 — there is no aggregate endpoint for units.

### Relevant Files

- `frontend/src/features/condominiums/` — the reference implementation from task 3; follow it.
- `frontend/src/routes/app-router.tsx` (46 lines) — register units only.
- `frontend/src/lib/crud/` — the hook factory and list-state hook from task 1.
- `frontend/src/components/ui/select.tsx` (72 lines) — the block selector; it rejects an empty string as an item value, so an "all blocks" filter needs a sentinel.
- `backend/src/modules/units/unit.schema.ts` — field validation and the bulk-generation payload, including the numbering pattern default.
- `backend/src/modules/units/unit.service.ts` — the block-ownership check, the duplicate-number conflict, the two blocked-deletion reasons, and the silent skip in generation.
- `backend/src/modules/blocks/block.schema.ts` — block fields: name, type, floors, units per floor, elevator.
- `backend/src/modules/residents/resident.service.ts` — the status recomputation that overrides occupied and vacant but not renovation or blocked.
- `backend/tests/integration/condominium-structure.spec.ts` (196 lines) — executable contract covering units, blocks and generation, including the all-exist refusal.

### Dependent Files

- `frontend/src/routes/app-router.tsx` — gains one route.
- Task 5 — the resident form's unit selector depends on units existing to be exercised.
- Task 7 — verifies this screen's permission gating and condominium scoping alongside the others.

### Related ADRs

- [ADR-007: Block Management Embedded in the Units Screen](adrs/adr-007.md) — why blocks live here, and the bound: what unit registration needs, no more, and no route.
- [ADR-005: Bulk Unit Generation as the Onboarding Path](adrs/adr-005.md) — why generation is in scope and how partial success and the all-exist refusal must read.
- [ADR-006: Soft-Deleted Records Remain Reachable and Restorable](adrs/adr-006.md) — the deleted toggle and restore.
- [ADR-004: Dialog-Based Create and Edit, With a Detail Route Only for Condominiums](adrs/adr-004.md) — units gets no detail route.

## Deliverables

- A units listing with search, five filters, sort, pagination and empty states.
- A unit form with a condominium-scoped block selector offering inline block creation.
- Block management covering list, create, edit and delete, without a route of its own.
- Bulk generation with a projected count and a reported created count.
- Occupancy indicators with unambiguous scope.
- Deletion with both blocked-reason paths, plus the deleted toggle and restore.
- One registered route; the blocks path left as a placeholder.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-008, UT-009 — the unit filter whitelist and field-range validation
- [ ] UT-010, UT-011, UT-012, UT-013 — bulk generation: projected count, floor bounds, the maximum grid, over-long numbers
- [ ] UT-028 — the block schema's floor minimum
- [ ] IT-044 – IT-051 — listing: the journey through filters and sort, no condominium selected, no units, no results, stale filters on condominium switch, several hundred units, prefix search, null versus zero cells
- [ ] IT-052 – IT-059 — single registration: the journey, duplicate number, block scoping and the cross-condominium refusal, range validation, double submit, deleted-number conflict, inline creation offered with no blocks
- [ ] IT-060 – IT-067 — bulk generation: the journey, all numbers exist, range rejection, generating into a populated block, the maximum grid, double confirmation, network failure, over-long numbers
- [ ] IT-068 – IT-073 — editing: the journey, number collision, the recomputed status, renovation persisting, the block field, record gone
- [ ] IT-074 – IT-079 — deletion and restoration: the journey, both blocked reasons, sequential blockers, restore conflict, the last unit unblocking its condominium
- [ ] IT-080 – IT-084 — occupancy indicators: the journey, zero state, renovation and blocked reconciling, independent failure, scope under filters
- [ ] IT-194 – IT-199 — inline block creation: the journey, duplicate name, cancellation, block created then unit failing, no permission, range rejection
- [ ] IT-200 – IT-206 — block management: the journey, deletion blocked by units, no blocks, rename collision, block deleted while selected, condominium switch, floor count changed after units exist

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` exits zero
- `/unidades` renders a real screen; `/blocos` still reaches the placeholder
- A condominium with no blocks can be taken to a fully generated building without leaving the screen
- A generation run whose numbers all exist reads as an outcome, not a failure
- The status shown after saving is always the server's, never the submitted one
- Both blocked-deletion reasons are surfaced with the server's wording
