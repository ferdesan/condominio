---
status: completed
title: Reservas
type: frontend
complexity: critical
---

# Task 6: Reservas

## Overview

Delivers the densest screen in the workflow: two views over the same data — a filterable
list and a month calendar built without a calendar library — plus a booking form governed
by nine server-side slot rules, and an approval workflow that is the only review flow in
the product. It is rated critical for its integration surface rather than its size: it
touches a second read-only resource for its rules, carries four resource-specific
endpoints beyond the uniform CRUD surface, and has a refusal path that fires *after* a
request was already accepted.

Sequenced last so the patterns from tasks 3 to 5 absorb its scaffolding and only its
genuinely novel parts need deciding.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST follow the screen, form, error-handling and permission-gating patterns established in task 3.
- MUST present a filterable list ordered most-recent-first, filterable by common area, status and unit, with each status visually distinguishable without relying on colour alone.
- MUST lead with the count of reservations awaiting a decision, and applying the pending filter MUST take one interaction.
- MUST present a month calendar backed by the availability endpoint, navigable month to month and filterable by common area, distinguishing pending from confirmed.
- MUST NOT add a calendar dependency; build the grid from the date library already present, per ADR-003.
- MUST show only pending and confirmed bookings on the calendar — the availability endpoint returns only those — while the list stays the exhaustive view.
- MUST place a reservation spanning midnight on every day it covers.
- MUST cap the entries shown per day and indicate how many remain.
- MUST guard against a slower earlier month response arriving after a later one and overwriting it.
- MUST surface the chosen area's constraints in the form before submission, read from the common-area record at runtime rather than hard-coded.
- MUST validate locally the eight rules decidable from that record, and MUST NOT attempt overlap or minimum-interval checks locally — both depend on server state the client cannot read atomically. See ADR-011.
- MUST render slot refusals as form-level messages, since they carry no field detail, while schema violations render against their field. The distinction is the presence of field detail, not the status code.
- MUST offer approve and reject only to roles holding the manage permission, and cancel to roles holding update — an operator may cancel but not decide.
- MUST present an approval refused for a slot conflict as a normal outcome with the server's message, leaving the reservation pending and refreshing the view.
- MUST render reservation indicators for the month shown: the month's count, the breakdown by area, and the cancellation count, obtained from `meta.total` with filters.
- MUST treat completed and canceled reservations as immutable, and a started reservation as cancellable only by administration.
- MUST NOT build a detail route for a reservation; see the open question recorded in the PRD about the notification link.
</requirements>

## Subtasks

- [ ] 6.1 Instantiate the resource hooks, plus dedicated hooks for availability, approve, reject and cancel.
- [ ] 6.2 Read common areas for the form's selector and rule parameters.
- [ ] 6.3 Build the listing with filters, status distinction, and the pending count as a one-click entry point.
- [ ] 6.4 Build the month grid from the date library, including adjacent-month days and the per-day cap.
- [ ] 6.5 Wire the calendar to the availability endpoint with month-range requests and stale-response guarding.
- [ ] 6.6 Build the booking form with the area selector and its constraints surfaced.
- [ ] 6.7 Derive the eight local rules from the chosen area at runtime.
- [ ] 6.8 Implement approve and reject with optional reasons and their refusal paths.
- [ ] 6.9 Implement cancel, including the started-reservation restriction.
- [ ] 6.10 Build the month indicators.
- [ ] 6.11 Gate every action on its permission.
- [ ] 6.12 Register the route and remove its path from the placeholder set.
- [ ] 6.13 Implement every assigned unit and integration case.

## Implementation Details

Create `frontend/src/features/reservations/` with the list page, the calendar, the booking
form, the decision actions and the hooks module. The calendar-composition logic should be
a pure module — it carries ten unit cases and is the one piece here with real algorithmic
content.

Modify `frontend/src/routes/app-router.tsx` to register the reservations route and remove
its path from the placeholder set.

Availability entries have a **different shape from the reservation entity** — a flat
projection carrying the area name, unit number and requester name directly. The type for
it comes from task 1; do not reuse the entity type.

The date-and-time input from task 2 is what the form needs; the existing date picker
carries no time.

The nine slot rules and their exact messages are in the reservation service. The eight
parameters they read — opening and closing hours, permitted weekdays, minimum and maximum
hours, advance-booking days, minimum interval, capacity — are fields on the common-area
record, so the form derives its schema once an area is chosen. A closing hour of midnight
means end-of-day.

The backend also emits a realtime event and creates in-app notifications on these
transitions. Neither is consumed here — live refresh is out of scope and there is no
notifications screen.

### Relevant Files

- `frontend/src/features/condominiums/` — the reference implementation from task 3.
- `frontend/src/routes/app-router.tsx` (46 lines) — the placeholder set and route table.
- `frontend/src/lib/crud/` — the hook factory and list-state hook from task 1.
- `frontend/src/components/ui/date-time-input.tsx` — from task 2; the form needs date and time together.
- `frontend/src/components/ui/badge.tsx`, `badge-variants.ts` — status presentation.
- `backend/src/modules/reservations/reservation.service.ts` — the nine slot rules with their exact messages, the state machine, the approval re-validation, and the cancellation restrictions.
- `backend/src/modules/reservations/reservation.routes.ts` — the four resource-specific endpoints and their permissions; note approve and reject require manage while cancel requires update.
- `backend/src/modules/reservations/reservation.schema.ts` — the create refinement on end-after-start and the update schema's status and reason fields.
- `backend/src/modules/common-areas/common-area.entity.ts` — every rule parameter the form reads.
- `backend/tests/integration/reservations.spec.ts` (233 lines) — the executable contract, including ownership enforcement and the refusal paths.
- `frontend/src/hooks/use-chart-colors.ts` (47 lines) — if the area breakdown is charted, this is how theme colours reach a chart; note charts need a layout-observer polyfill under test.

### Dependent Files

- `frontend/src/routes/app-router.tsx` — gains one route.
- Task 7 — verifies this screen's permission gating, including that an operator sees cancel but not approve.

### Related ADRs

- [ADR-003: Monthly Calendar With Filterable List and an Inline Approval Queue](adrs/adr-003.md) — why one view and not three, why no dependency, and why approval lives on the row.
- [ADR-011: Reservation Validation Split Between Client and Server](adrs/adr-011.md) — which eight rules are local, which two are not, and why a locally valid submission may still be refused.
- [ADR-002: Back-Office Personas Only for the Initial Release](adrs/adr-002.md) — the síndico books on a resident's behalf; no resident-facing flow.
- [ADR-004: Dialog-Based Create and Edit, With a Detail Route Only for Condominiums](adrs/adr-004.md) — no reservation detail route.

## Deliverables

- A reservations listing with filters, distinguishable statuses and a one-click pending queue.
- A month calendar built without a new dependency, filterable by area and navigable month to month.
- A booking form surfacing the chosen area's constraints, validating eight rules locally.
- Approve, reject and cancel with optional reasons, correct permission gating and their refusal paths.
- Month indicators: count, area breakdown, cancellations.
- One registered route.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-059 – UT-075 — the local rule set: a fully valid booking, and the boundaries of end-after-start, past start, advance limit, minimum and maximum duration, weekday, opening-hours window, capacity, reason length, midnight closing, no area chosen, area change re-deriving rules, null weekdays, zero duration bounds, the deliberate absence of overlap and interval checks, and a midnight-crossing booking
- [ ] UT-076 – UT-085 — calendar composition: grid shape, empty month, per-day cap and residual, midnight-crossing placement, leap year and month lengths, intra-day ordering, entry mapping, null area name, month range for the request, month isolation
- [ ] IT-124 – IT-129 — listing: the journey through filters and the pending queue, empty list, zero pending shown, deleted area, deleted unit, condominium switch
- [ ] IT-130 – IT-137 — calendar: the journey through month paging and area filtering, empty month, day overflow, midnight crossing, leap year, stale response guarding, excluded statuses, no condominium selected
- [ ] IT-138 – IT-152 — booking: the journey, the eight local refusals, the two server refusals, field versus form error placement, unavailable areas, concurrent submissions for one slot, double submit, no areas registered
- [ ] IT-153 – IT-159 — approval: the journey, the slot taken before approval, no longer pending, double approval, concurrent deciders, operator refused, a past-start reservation
- [ ] IT-160 – IT-164 — rejection: the journey, already decided, no reason supplied, over-long reason, approving after rejecting
- [ ] IT-165 – IT-170 — cancellation: the journey, a started reservation as operator, already canceled, completed, double cancel, cancelling a pending reservation
- [ ] IT-171 – IT-176 — indicators: the journey, empty month, no areas, independent failure, many areas, scope under filters

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` exits zero
- `/reservas` renders a real screen; it no longer reaches the placeholder
- No new runtime dependency appears in `frontend/package.json`
- The calendar renders a correct grid for a leap-year February and for a 31-day month starting on Sunday
- All eight local rules refuse before a request is issued; overlap and interval refusals come from the server and read as normal outcomes
- An approval refused for a conflict leaves the reservation pending with the server's message shown
- An operator sees cancel but neither approve nor reject
