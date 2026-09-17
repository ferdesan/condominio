---
status: completed
title: "`cadastros.spec.ts` — dependentes, funcionários, prestadores e áreas comuns"
type: test
complexity: medium
---

# Task 3: `cadastros.spec.ts` — dependentes, funcionários, prestadores e áreas comuns

## Overview

Cobre os quatro módulos de cadastro que a suíte de integração nunca tocou. São todos roteadores da fábrica de CRUD, e suas regras são de um mesmo tipo: um documento que precisa fechar o dígito verificador, um par de datas que não pode inverter, e um vínculo com o registro pai que precisa bater. Não depende de nenhuma outra task e pode começar imediatamente.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `backend/tests/integration/cadastros.spec.ts` with four sub-describes named for the modules: dependentes, funcionários, prestadores, áreas comuns.
- Each sub-describe MUST scope its reads by an identifier it created. The seed runs once per file, there is no `beforeEach` reset, and four domains share the same database within this file.
- MUST create the dependents it needs: the seed creates **zero**. The holder's `residentId` comes from the API, not from a hand-built id.
- MUST assert the two-layer document validation on prestadores as a pair: a 12-digit value is rejected by the schema with 422, a 14-digit value that fails the checksum is rejected by the service with 409. The pair is the point — same field, two layers, two status codes.
- MUST document the `common-areas` asymmetry rather than fix it: `POST` rejects an inverted time range and an inverted duration range with 422, while `PATCH` accepts both with 200. Cases MUST state the current behavior (ADR-004).
- MUST NOT write any case for `common-area.beforeRemove`, the future-reservation guard. It is deliberately uncovered; the reason is in ADR-004 and in `_tests.md` under "cases deliberately absent".
- Every case MUST assert `response.status` first, and then either `error.code` or the message with a case-insensitive regex — never both.
- Case names MUST carry the `IT-NNN` id, as the frontend suite does.
- MUST NOT repeat cross-tenant isolation or `PERMISSION_DENIED` auditing — `security.spec.ts` already covers both for every module.
</requirements>

## Subtasks

- [x] 3.1 Read `_tests.md` for all twenty assigned ids before writing anything.
- [x] 3.2 Create the file with the standard skeleton: personas in `beforeAll`, `afterAll(teardownTestContext)` passed by reference.
- [x] 3.3 Resolve the morador's unit and the matching `residentId` through the API, for the dependentes block.
- [x] 3.4 Write the dependentes cases: the happy path, the mismatched holder, the unknown holder, the update path that escapes the check, the eager relation, and the update-allowed/delete-denied pair.
- [x] 3.5 Write the funcionários cases: the CPF checksum, the inverted contract dates, the auto-filled termination date, the numeric salary, and the persona with no access at all.
- [x] 3.6 Write the prestadores cases: the two document layers, the inverted contract period, and the rating bounds.
- [x] 3.7 Write the áreas comuns cases: both refinements enforced on create, both bypassed on update, and the persona boundary.
- [x] 3.8 Run the backend suite and confirm no case interferes with another across the four blocks.

## Implementation Details

All four modules are `createCrudRouter` instances, so the route surface is identical in shape and only the rules differ. The rules and their exact messages are in the TechSpec's "API Endpoints" and in each service.

**Where the status codes come from, and why it matters.** These modules reject in two different places. The Zod schema produces **422** with code `VALIDATION_ERROR`; the service's own assertions produce **409**, as `BusinessRuleError`. `employees` accepts any eleven digits at the schema and only then checks the CPF checksum in the service — which is why an invalid CPF is 409 and not 422. `service-providers` does both: the schema refuses anything that is not 11 or 14 digits, and the service refuses a well-formed value whose checksum fails.

**The dependents gap.** The seed creates residents for every occupied unit but no dependents at all. A case needs a `residentId` that matches the unit it will use; `GET /residents?unitId=<id>` or `GET /residents/my-unit` as the morador both give it. For the mismatch case, pick a resident of a different unit — the seed has about thirty to choose from.

**The update that escapes the check.** `DependentService.prepareUpdate` re-runs the consistency assertion only when `residentId` is present in the body **and** differs from the stored one. A `PATCH` that changes only `unitId` therefore passes, leaving the dependent pointing at a unit its holder does not occupy. IT-240 records that; it is not a fix.

**The common-areas asymmetry.** `createCommonAreaSchema` is an object plus two refinements; `updateCommonAreaSchema` is `.partial()` of the **un-refined** base, so neither refinement applies on update. Both halves get a case, and the update cases assert 200 — the current behavior, stated plainly.

**Persona boundaries worth knowing before writing the denials.** `morador` holds no `employee` or `service-provider` permission at all, so even a read is 403. `porteiro` reads every one of these four resources and writes none of them. `morador` may create and update a dependent but not delete one — that asymmetry is the cleanest allowed-and-denied pair in the file.

### Relevant Files

- `backend/src/modules/dependents/dependent.service.ts` — the holder-consistency assertion and the update path that skips it.
- `backend/src/modules/employees/employee.service.ts` — the CPF check, the contract dates, the auto-termination.
- `backend/src/modules/service-providers/service-provider.service.ts` — the CPF/CNPJ check and the contract period.
- `backend/src/modules/service-providers/service-provider.schema.ts` — the length refinement that fires before the service.
- `backend/src/modules/common-areas/common-area.schema.ts` — the two create refinements and the partial that drops them.
- `backend/src/shared/http/crud-router.ts` — the seven endpoints every one of these modules exposes.
- `backend/src/shared/constants/roles.ts` — what each seeded persona may do on these four resources.
- `backend/src/database/seeds/seed.ts` — the residents, the two employees, the two service providers and the three common areas the cases start from.
- `backend/tests/integration/operations.spec.ts` — the convention for a multi-domain file: sub-describes, naming, how ids flow.

### Dependent Files

- None. This task creates one file and changes no production code.

### Related ADRs

- [ADR-002: Two thematic spec files, not one per module](adrs/adr-002.md) — why these four share a file, and what that costs in shared state.
- [ADR-004: Where a test workflow is allowed to change production code](adrs/adr-004.md) — why the `PATCH` asymmetry is documented instead of fixed, and why the delete guard has no case.

## Deliverables

- `cadastros.spec.ts` with four sub-describes, covering the business rules of all four modules.
- The two-layer document validation on prestadores asserted as an explicit pair.
- The `common-areas` create/update asymmetry recorded by test, with the current behavior stated.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] IT-237, IT-238, IT-239, IT-240, IT-241, IT-242 — dependentes: holder consistency, unknown holder, the update that escapes the check, the eager relation, the update-allowed/delete-denied pair.
- [x] IT-243, IT-244, IT-245, IT-246, IT-247 — funcionários: CPF checksum, contract dates, auto-filled termination, numeric salary, no access for morador.
- [x] IT-248, IT-249, IT-250, IT-251 — prestadores: the two document layers, the contract period, the rating bounds.
- [x] IT-252, IT-253, IT-254, IT-255, IT-256 — áreas comuns: both refinements on create, both bypassed on update, persona boundary.

## Success Criteria

- Every assigned test case implemented and passing.
- No case in one sub-describe depends on or disturbs another; the file passes when run alone and as part of the suite.
- No case exists for `common-area.beforeRemove`.
- `npm --prefix backend run test` green, with the file count up by one and the case count up by 20.
- `npm --prefix backend run lint` and `npm --prefix backend run typecheck` clean.
