---
status: completed
title: Table repair and form primitives
type: frontend
complexity: medium
---

# Task 2: Table repair and form primitives

## Overview

Repairs the shared table component and fills the gaps in the form layer before any screen
consumes them. The table was delivered complete and documented but has never been used,
and reading it against the API contract surfaces four defects that all five listings in
this workflow would otherwise work around individually. The form layer is missing a
multi-line input, a date-and-time input, and a field wrapper, and the existing date picker
ignores externally changed values — which breaks editing an existing record.

Runs in parallel with task 1: disjoint file sets, no shared surface.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST make the table's row slice conditional on client-side pagination being requested. It currently runs unconditionally, so any screen whose page size is below its request size loses rows silently.
- MUST let the table's search input accept a controlled value, so a screen can clear it programmatically. Debouncing stays with the caller, which owns the request.
- MUST widen the column key so a column supplying its own renderer may use a free identifier. An actions column is currently inexpressible — the component's own documentation suggests a key the type system rejects.
- MUST make clickable rows keyboard-operable and expose an activatable role; they currently carry a click handler with no keyboard affordance.
- MUST leave the table's sort vocabulary as it is — lower case — because the data layer from task 1 translates it. Do not change it in two places.
- MUST create a multi-line input for notes fields, a date-and-time input for reservations, and a field wrapper that pairs label, control and error message with the aria wiring the existing sign-in form establishes.
- MUST fix the date picker so it reflects a value changed after mount; without this, form reset does not reach it.
- MUST create the shared API-error-to-form mapper: field detail goes to the named fields, absence of field detail goes to a form-level message, and a field the form does not own falls through to the form-level message rather than being discarded.
- MUST update `frontend/COMPONENTS.md` in the same change; it documents this component as complete and would otherwise become misleading.
- SHOULD extend the barrel exports for consistency, though nothing imports them today.
</requirements>

## Subtasks

- [ ] 2.1 Repair the table's row slice so server-paginated data renders in full.
- [ ] 2.2 Make the table's search input controlled.
- [ ] 2.3 Widen the column key type for renderer-backed columns.
- [ ] 2.4 Make clickable rows keyboard-accessible and correct the sort-state semantics on the header cell.
- [ ] 2.5 Create the multi-line input, honouring the 2000-character server limit on notes fields.
- [ ] 2.6 Create the date-and-time input, since reservations need both and the existing picker offers only a date.
- [ ] 2.7 Create the field wrapper carrying the label, control and error-message wiring.
- [ ] 2.8 Fix the date picker's synchronisation with externally changed values.
- [ ] 2.9 Create the API-error-to-form mapper as a shared helper.
- [ ] 2.10 Update the component documentation and barrels.
- [ ] 2.11 Implement every assigned unit case.

## Implementation Details

Modify `frontend/src/components/common/data-table.tsx` (296 lines). It has **no internal
state at all** — no state hooks, no effects — so every behavior is driven by props. That is
why a screen must own the page reset, and why the slice repair is contained.

Modify `frontend/src/components/ui/date-picker.tsx` (59 lines). Its internal value is
initialised once at mount with no synchronisation effect. Note also that its calendar
button toggles a flag nothing reads — dead code worth removing while the file is open.

Create `frontend/src/components/ui/textarea.tsx`, `date-time-input.tsx` and
`form-field.tsx`. The date-and-time input should build on the native input type rather
than the existing picker, which cannot carry a time.

Create the error mapper under `frontend/src/lib/`. Its signature is in the TechSpec's
Core Interfaces section.

The sign-in page is the only existing form and establishes the conventions the field
wrapper must preserve: explicit ids, invalid marking, the error element linked by
description, a `{field}-error` id convention, and error text in an alert role. Render
conditionals in this codebase end in an explicit null branch rather than using the logical
and operator.

Note for the Radix controls these forms will use: the select, checkbox, currency and
date-time inputs all expose a value-and-callback API incompatible with uncontrolled
registration, and **no controlled-field example exists anywhere in this codebase**. The
field wrapper should make that pattern obvious for task 3 onward.

### Relevant Files

- `frontend/src/components/common/data-table.tsx` (296 lines) — the four defects; fully controlled, zero internal state.
- `frontend/src/components/ui/date-picker.tsx` (59 lines) — no synchronisation effect; a dead open-state toggle.
- `frontend/src/components/ui/select.tsx` (72 lines) — a bare Radix root; note it rejects an empty string as an item value, so "all" filters need a sentinel.
- `frontend/src/components/ui/checkbox.tsx` (29 lines) — its callback emits a tri-state value needing normalisation.
- `frontend/src/components/ui/currency-input.tsx` (92 lines) — emits a number, not an event.
- `frontend/src/components/ui/input.tsx` (21 lines), `button.tsx` (38 lines) — the button already carries a loading prop that disables and shows a spinner.
- `frontend/src/features/auth/login-page.tsx` (174 lines) — the only existing form; the source of the accessibility and error-mapping conventions.
- `frontend/src/lib/format.ts` (99 lines) — null-safe display helpers the table's renderers should use.
- `frontend/src/components/common/index.ts`, `frontend/src/components/ui/index.ts` — barrels to extend.
- `frontend/COMPONENTS.md` (792 lines) — the documentation to update.

### Dependent Files

- Every screen in tasks 3 through 6 — all five listings and all five forms consume these components.
- `frontend/src/components/common/empty-state.tsx` — rendered by the table's empty state; unchanged but coupled.

### Related ADRs

- [ADR-009: Repairing the Shared Table Component In Place](adrs/adr-009.md) — why the defects are fixed here rather than wrapped, and the bound on the change: the four defects and the keyboard affordance, nothing more.
- [ADR-008: Resource-Hook Factory as the Data-Access Layer](adrs/adr-008.md) — establishes that sort translation belongs to the data layer, not to this component.

## Deliverables

- A table that renders a full server-supplied page, accepts a controlled search value, expresses an actions column, and is keyboard-operable.
- A multi-line input, a date-and-time input, and a field wrapper with the project's accessibility conventions.
- A date picker that reflects externally changed values.
- A shared API-error-to-form mapper.
- Updated component documentation and barrels.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] UT-053, UT-054, UT-055, UT-056, UT-057, UT-058 — the error mapper: field detail to fields, no detail to form level, empty detail array, unowned field fallthrough, nested field paths, non-API rejections
- [ ] UT-086, UT-087, UT-088, UT-089, UT-090 — display helper null-safety, including zero rendering as zero and invalid dates not throwing
- [ ] UT-091, UT-092, UT-093, UT-094, UT-095, UT-096, UT-097, UT-098, UT-099, UT-100 — the table repairs: full page renders, null and zero cell rendering, controlled search value and clearing, free-identifier columns, keyboard row activation, pagination visibility at one and two pages, sort state on the header cell

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` exits zero
- A 20-row server page renders 20 rows when the page size is 20
- A clickable row is reachable and activatable by keyboard
- The date picker reflects a value changed after mount
- `frontend/COMPONENTS.md` describes the repaired component accurately
- No behavior change to any component outside the five files named above
