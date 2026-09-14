---
status: completed
title: Moradores
type: frontend
complexity: medium
---

# Task 5: Moradores

## Overview

Delivers the residents screen: who occupies which unit, with the tenure dates, contact
details and emergency contact the condominium needs. It is the most conventional of the
four modules, with two behaviors that are not: the primary-resident designation is
exclusive per unit and the server demotes the previous holder as a side effect, and every
change here recomputes the occupancy status of the affected unit. Both are server-driven,
so the interface must reflect what the server did rather than what was typed.

Resident records carry personal data, which shapes what the form may collect.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST follow the screen, form, error-handling, permission-gating and restore patterns established in task 3.
- MUST scope every request to the condominium selected in the application shell, and explain the requirement when none is selected.
- MUST offer only the server's filter whitelist — condominium, unit, type, status and user — and search across name, email, document and phone.
- MUST send a searched document as digits only, since documents are stored unpunctuated; a punctuated search term would otherwise match nothing.
- MUST display documents and phones formatted while submitting them as the server expects.
- MUST offer only the selected condominium's units in the unit selector, preventing the cross-condominium mismatch the server refuses.
- MUST surface the two distinct document refusals separately: an invalid check digit and an already-registered document carry different messages.
- MUST make the primary-resident designation visible in the listing, and MUST refresh the list after designating one so the demoted previous holder is reflected. The server clears the other flags; the client must not assume its local view is still accurate.
- MUST reflect the unit-status recomputation that follows creating, updating or deleting a resident — the units listing shows the consequence.
- MUST NOT collect any field the API does not define. Marital status, profession, income and similar are out of scope by data-protection minimisation.
- MUST NOT present the data-protection consent timestamp as editable; the server records it automatically when a document or email is supplied.
- MUST validate locally that a move-out date is not earlier than a move-in date, and that a birth date is not in the future.
- MUST offer the deleted-records toggle and restore, gated on the update permission.
</requirements>

## Subtasks

- [ ] 5.1 Instantiate the resource hooks for this resource.
- [ ] 5.2 Build the listing with search, the whitelisted filters, sort, pagination and empty states.
- [ ] 5.3 Normalise a searched document to digits before sending it.
- [ ] 5.4 Build the form dialog with the condominium-scoped unit selector and the full field set.
- [ ] 5.5 Implement the primary-resident designation, including the list refresh that reveals the demotion.
- [ ] 5.6 Handle the tenure-date and birth-date validations locally.
- [ ] 5.7 Add deletion with confirmation, plus the deleted toggle and restore.
- [ ] 5.8 Ensure unit-status consequences are visible after residents change.
- [ ] 5.9 Gate every action on its permission.
- [ ] 5.10 Register the route and remove its path from the placeholder set.
- [ ] 5.11 Implement every assigned unit and integration case.

## Implementation Details

Create `frontend/src/features/residents/` with the list page, the form dialog and the
hooks module, following the structure task 3 establishes.

Modify `frontend/src/routes/app-router.tsx` to register the residents route and remove its
path from the placeholder set.

The listing response eager-loads each resident's unit, so the unit number is available for
display without a second request. A resident whose unit has been deleted must still render
— guard the nested access rather than assuming it is present.

The primary designation is a field on the resident, not a separate endpoint: saving a
resident with the flag set causes the server to clear it on every other resident of that
unit in one operation. There is no client-side coordination to write; there is a cache to
invalidate.

Display formatting helpers for documents and phones already exist and return a placeholder
for absent values.

### Relevant Files

- `frontend/src/features/condominiums/` — the reference implementation from task 3.
- `frontend/src/features/units/` — if task 4 has landed, its unit selector pattern is reusable; these tasks are independent, so do not block on it.
- `frontend/src/routes/app-router.tsx` (46 lines) — the placeholder set and route table.
- `frontend/src/lib/crud/` — the hook factory and list-state hook from task 1.
- `frontend/src/lib/format.ts` (99 lines) — document and phone formatting, null-safe.
- `backend/src/modules/residents/resident.schema.ts` — field validation, the three types and three statuses, and the tenure-date fields.
- `backend/src/modules/residents/resident.service.ts` — check-digit validation, the duplicate-document conflict, the exclusive-primary enforcement, the consent timestamp, and the unit-status synchronisation.
- `backend/src/modules/units/unit.entity.ts` — the statuses the synchronisation writes.
- `backend/tests/integration/condominium-structure.spec.ts`, `operations.spec.ts` — residents have no dedicated spec; their contract appears in these two.

### Dependent Files

- `frontend/src/routes/app-router.tsx` — gains one route.
- The units screen from task 4 — it displays occupancy that this screen changes; the coupling is through the server, not through shared code.
- Task 7 — verifies this screen's permission gating and condominium scoping.

### Related ADRs

- [ADR-004: Dialog-Based Create and Edit, With a Detail Route Only for Condominiums](adrs/adr-004.md) — residents gets no detail route.
- [ADR-006: Soft-Deleted Records Remain Reachable and Restorable](adrs/adr-006.md) — the deleted toggle and restore; deletion preserves history rather than destroying it, which is also the data-protection posture for resident records.
- [ADR-002: Back-Office Personas Only for the Initial Release](adrs/adr-002.md) — which roles see which actions.

## Deliverables

- A residents listing with search across four fields, the whitelisted filters, sort, pagination and empty states.
- A form dialog with a condominium-scoped unit selector and local tenure and birth-date validation.
- Primary-resident designation that reflects the server's exclusive enforcement.
- Deletion with confirmation, plus the deleted toggle and restore.
- Visible unit-occupancy consequences after residents change.
- One registered route.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-014, UT-015 — the resident filter whitelist and document normalisation for search
- [ ] UT-023, UT-024, UT-025 — the resident schema: name minimum, move-out before move-in, future birth date
- [ ] IT-085 – IT-090 — listing: the journey through search and filters, null document and phone, punctuated document search, empty list, a resident whose unit is gone, several hundred residents
- [ ] IT-091 – IT-100 — registration: the journey, invalid check digits, duplicate document, unit scoping, short name, neither document nor email, tenure-date inconsistency, future birth date, double submit, no units available
- [ ] IT-101 – IT-106 — editing: the journey, the last active resident moving out, cross-condominium unit, document conflict, record gone, clearing move-out
- [ ] IT-107 – IT-112 — primary designation: the journey, the previous holder demoted, a unit with no primary, concurrent designations, deleting the primary, designating an inactive resident
- [ ] IT-113 – IT-118 — deletion and restoration: the journey, the only active resident, the primary resident, restoring with a deleted unit, restore conflict, reservations retaining the requester
- [ ] IT-119 – IT-123 — filtering: the journey across three filters, no results, a deleted filtered unit, condominium switch clearing the unit filter, unsupported filters not offered

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` exits zero
- `/moradores` renders a real screen; it no longer reaches the placeholder
- Searching a punctuated document returns the matching resident
- Designating a primary resident leaves exactly one primary visible for that unit
- Adding the first active resident to a vacant unit is visible as occupancy on the units screen
- No field outside the API's definition is collected
- An operator sees the listing with no create, edit, delete or restore action
