# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `cadastros.spec.ts` with four sub-describes (dependentes, funcionários, prestadores, áreas comuns) covering 20 test cases (IT-237 to IT-256).

## Important Decisions

- All four modules are `createCrudRouter` instances with identical route surfaces
- `morador` has `dependent:create` and `dependent:update` but NOT `dependent:delete`
- `porteiro` has read-only access to all four resources
- `admin` has full access to all resources
- `common-area` create has two refinements (time range, duration range) that are bypassed on update via `.partial()` of un-refined base
- Service-layer rejections produce 409; schema rejections produce 422
- Seed creates zero dependents; must create via API
- `common-area.beforeRemove` is deliberately uncovered (ADR-004)

## Learnings

- `DependentService.prepareUpdate` only re-checks consistency when `residentId` is present AND different
- `EmployeeService` auto-fills `terminationDate` with today when status is TERMINATED and no date provided
- `ServiceProviderService.assertDocument` checks length first (11=CPF, 14=CNPJ) then validates checksum
- `createCommonAreaSchema` has two refinements; `updateCommonAreaSchema` is `.partial()` of un-refined base

## Files / Surfaces

- `backend/tests/integration/cadastros.spec.ts` (NEW - creating)
- `backend/src/modules/dependents/dependent.service.ts`
- `backend/src/modules/employees/employee.service.ts`
- `backend/src/modules/service-providers/service-provider.service.ts`
- `backend/src/modules/service-providers/service-provider.schema.ts`
- `backend/src/modules/common-areas/common-area.schema.ts`
- `backend/src/shared/http/crud-router.ts`
- `backend/src/shared/constants/roles.ts`
- `backend/src/database/seeds/seed.ts`
- `backend/tests/integration/operations.spec.ts` (convention reference)

## Errors / Corrections

- IT-248: Schema validation error message is generic ("Falha na validacao dos dados enviados."), specific message is in `error.details[].message`. Fixed by asserting `error.code` instead of message regex.
- IT-252, IT-254: Error details use `field` property, not `path`. Fixed by using `d.field === 'closesAt'` instead of `d.path?.includes('closesAt')`.

## Ready for Next Run

All 20 tests pass. Lint and typecheck clean. File created: `backend/tests/integration/cadastros.spec.ts`.
