---
status: completed
title: Cross-cutting hardening and pipeline gate
type: frontend
complexity: medium
---

# Task 7: Cross-cutting hardening and pipeline gate

## Overview

Closes the workflow by verifying the behaviors that span every screen and cannot be
checked from inside any one of them: that a role sees only what it may act on across all
four modules, and that every screen follows the condominium selected in the application
shell — including the awkward cases, like switching condominium with a dialog open or
deleting the condominium currently selected. It then confirms the pipeline gate this
workflow set out to repair actually holds.

This is not a testing-only task. The cross-screen behaviors it verifies are where the
integration defects live, and fixing what it finds is part of the slice.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST verify every screen under each back-office role and correct any action offered to a role that cannot perform it. An action the server will refuse MUST NOT be rendered.
- MUST verify that a server refusal of an action the interface offered is surfaced rather than failing silently, and correct the gating that allowed it to be offered.
- MUST verify that session expiry mid-action routes to sign-in without presenting a request error, on every screen.
- MUST verify that a record outside the user's scope, reached by a direct link, renders a refusal or a not-found state and never partial data.
- MUST verify that all four scoped screens carry the selected condominium on every request, and that switching it reloads the screen and clears filters that no longer apply.
- MUST resolve the dialog-open-during-condominium-switch case: either the dialog closes with confirmation or it completes against the condominium it was opened for. It MUST NOT save against the newly selected one.
- MUST verify that deleting the currently selected condominium moves the selection and that dependent screens recover.
- MUST confirm the pipeline passes end to end: lint, type check, tests and build, in the order the workflow runs them.
- MUST confirm the coverage command completes and writes the report the pipeline references.
- MUST confirm no state — stored session data in particular — leaks between test cases.
- SHOULD record any PRD open question resolved during implementation, so the decision is not lost.
</requirements>

## Subtasks

- [x] 7.1 Audit every screen under each back-office role and correct mis-gated actions.
- [x] 7.2 Verify and correct the handling of server refusals for actions the interface offered.
- [x] 7.3 Verify session-expiry behavior across all four screens.
- [x] 7.4 Verify out-of-scope access by direct link on the routes that accept an identifier.
- [x] 7.5 Verify condominium scoping and filter clearing across the four scoped screens.
- [x] 7.6 Resolve the dialog-open-during-condominium-switch case.
- [x] 7.7 Verify recovery when the selected condominium is deleted or becomes inaccessible.
- [x] 7.8 Run the full pipeline sequence and confirm it passes.
- [x] 7.9 Confirm the coverage command and check for state leaking between cases.
- [x] 7.10 Record resolved open questions.
- [x] 7.11 Implement every assigned integration case.

## Implementation Details

This task writes tests that mount screens from tasks 3 through 6 and fixes what they
expose. Expect the fixes to be small and to land in the feature directories those tasks
created — a missing permission guard, a filter not cleared on condominium switch, a dialog
that does not react to a shell change.

The render helper from task 1 takes the role and the selected condominium per call, which
is what makes the role matrix testable without four separate harnesses.

Permission facts that the audit checks against: administrators and síndicos manage all
four resources including reservation decisions; operators hold read on all four plus
reservation update, which is enough to cancel a reservation but not to approve or reject
one; restoring a record requires the update permission rather than the delete permission.

The pipeline's test job has no failure tolerance, unlike its lint steps — so a failing
test blocks the build and the gate, which is the behavior this workflow wanted. Verify by
running the same commands the workflow runs, in order.

The PRD carries five open questions. Several will have been resolved in passing by tasks 3
to 6 — whether the auto-managed unit statuses are offered in the form, and what scope the
indicators describe, in particular. Record the resolutions rather than leaving the
questions open against shipped behavior.

### Relevant Files

- `frontend/src/features/condominiums/`, `units/`, `residents/`, `reservations/` — the screens under audit; fixes land here.
- `frontend/src/test/render.tsx` — from task 1; supplies the role and condominium per mount.
- `frontend/src/lib/permissions.ts` (19 lines) — mirrors the server's resolution, including that a resource-level manage grant covers every action on it.
- `frontend/src/providers/auth-provider.tsx` (74 lines) — exposes the permission predicate.
- `frontend/src/providers/condominium-provider.tsx` (68 lines) — selection, persistence and the reconciliation that picks another condominium when the stored one is not visible.
- `frontend/src/routes/protected-route.tsx` (24 lines) — the route guard and its three states.
- `frontend/src/lib/api.ts` (197 lines) — the session-expiry event that screens must not treat as a request error.
- `backend/src/shared/constants/roles.ts` — the authoritative role-to-permission mapping.
- `backend/tests/integration/security.spec.ts` (217 lines) — the server-side contract for tenant isolation and role enforcement.
- `.github/workflows/ci-cd.yml` (259 lines) — the job graph; note lint carries failure tolerance and type check does not.

### Dependent Files

- The four feature directories — corrections land in them.
- `.compozy/tasks/frontend-cruds/_prd.md` — open questions resolved in passing should be recorded.

### Related ADRs

- [ADR-002: Back-Office Personas Only for the Initial Release](adrs/adr-002.md) — the role matrix this task audits against, including that operators may cancel but not decide.
- [ADR-001: Frontend-Only Scope Over the Existing API Contract](adrs/adr-001.md) — the pipeline repair is in scope; no backend or workflow change is.
- [ADR-006: Soft-Deleted Records Remain Reachable and Restorable](adrs/adr-006.md) — restore is gated on update, which is a common place to get the gating wrong.

## Deliverables

- A verified role matrix across all four screens, with any mis-gated action corrected.
- Verified condominium scoping, including filter clearing and the dialog-open-during-switch case.
- Verified session-expiry and out-of-scope access behavior.
- A green pipeline across lint, type check, tests and build.
- A working coverage command with no state leaking between cases.
- Resolved PRD open questions recorded.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] IT-177, IT-178, IT-179, IT-180, IT-181 — role-driven visibility: every screen as an operator, a refusal of an offered action, session expiry mid-action, a reduced permission set on remount, out-of-scope access by direct link
- [x] IT-182, IT-183, IT-184, IT-185, IT-186, IT-187 — condominium scoping: every scoped request carrying the selection, a single-condominium user, an inaccessible stored selection, switching with a dialog open, a new condominium becoming selectable, the selected condominium deleted
- [x] IT-188, IT-189, IT-190, IT-191, IT-192, IT-193 — the pipeline gate: the suite running to completion, a non-empty suite, a failing case producing a non-zero exit, the coverage command, Radix components rendering under test, and no stored state leaking between cases

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run lint`, `typecheck`, `test` and `build` all exit zero
- `npm --prefix frontend run test:cov` completes and writes the coverage report
- No action is rendered for a role the server would refuse, on any of the four screens
- Switching condominium never causes a save against the wrong one
- Deleting the selected condominium leaves the application usable
- Every PRD open question is either resolved and recorded, or explicitly still open with a reason
