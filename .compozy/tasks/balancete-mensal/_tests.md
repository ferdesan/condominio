# Test Specification: Balancete Mensal

Canonical test contract. Companion to [`_techspec.md`](_techspec.md).

No `_user_stories.md` exists — this workflow was opened from a survey document
and four product decisions, not from a PRD — so the rows below are derived from
the ADRs and from the components named in the TechSpec rather than from stories.
The coverage matrix is organised that way for the same reason.

## Strategy

- **Frameworks and harnesses.** Backend: Jest with `ts-jest`, `testEnvironment:
  node`, `--runInBand`, 30 s timeout; `supertest` against the real app from
  `createApp()`. **No fake at any boundary** — in-memory SQLite (`sqljs`), real
  services, real repositories. Harness as it stands: `setupTestContext`, `login`,
  `seedUsers`, `teardownTestContext` (`tests/helpers/test-context.ts`). Frontend:
  Vitest with Testing Library, `renderWithProviders` (`src/test/render.tsx`), and
  `@/lib/api` doubled at the transport seam only (ADR-010 of `frontend-cruds`),
  through `serveFinancial` in `features/financial/test-utils.ts`.
- **Execution.** `npm --prefix backend run test` and `npm --prefix frontend run
  test`. No MySQL, no Redis, no Docker, no network.
- **Conventions.** Case names in Portuguese, third person, no accents, no
  "should" / "deve"; each name prefixed with its id, as `backend-integration-specs`
  established. `expect(response.status).toBe(n)` first; assert `error.code` rather
  than the message on 422, because the schema failure carries a generic message
  and the detail lives in `error.details[]` under the key `field`.
- **State model.** The seed runs once per file and there is no `beforeEach`
  reset. Cases inside a file share rows; each sub-describe reads back what it
  created. Cases that close a month must therefore run in an order where a later
  case does not need that month open — the freeze is global to the file. Where a
  case needs a month nobody else touches, it uses a condominium of its own from
  `registerIsolatedTenant` (`tests/helpers/test-data.ts`).
- **Numbering.** `UT-101` and `IT-258` continue the repository's sequence:
  `UT-100` (in `frontend-cruds`) and `IT-257` (in `backend-integration-specs`) are
  the highest ids in use.
- **What no case covers, deliberately.** The migration. Tests never load
  migrations (`data-source.ts:17-24`) — the schema comes from `synchronize: true`
  and the roles from a seed that runs from zero — so the table, the two
  condominium columns and the role permission patch are all present in the suite
  regardless of whether the migration is correct. Verification is
  `npm --prefix backend run migration:run` against MySQL, as a task step with its
  own acceptance (ADR-007).

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| ADR-001 | income is `payment.paid_at`, never charge competence | — | IT-258, IT-259, IT-262 | — |
| ADR-001 | expense is `expense.paid_at` with status PAID | — | IT-261, IT-262 | — |
| ADR-001 | charge-side mutation cannot move a statement | — | IT-290 | — |
| ADR-001 | one source of sums: totals equal their lines | UT-113 | IT-264 | — |
| ADR-002 | inheritance from the previous closed month | UT-105, UT-107 | IT-273 | — |
| ADR-002 | computation from the opening balance and cutoff | UT-106, UT-108, UT-109 | IT-272, IT-274 | — |
| ADR-002 | the two fields on the condominium form | UT-123, UT-124 | IT-316, IT-317 | — |
| ADR-003 | the six guarded write paths | — | IT-281, IT-283–IT-288 | — |
| ADR-003 | what is deliberately not frozen | — | IT-282, IT-289, IT-290 | — |
| ADR-003 | reopening is the way out, and is recorded | — | IT-291, IT-292, IT-293 | — |
| ADR-004 | a PAID expense cannot lack `paid_at` | — | IT-298–IT-302 | — |
| ADR-004 | rows that predate the invariant stay visible | — | IT-267 | — |
| ADR-005 | a closed month is served from the snapshot | — | IT-275, IT-276 | — |
| ADR-005 | re-closing updates one row, never duplicates | — | IT-277, IT-293 | — |
| ADR-005 | a snapshot written by an older shape still reads | UT-116, UT-117 | — | — |
| ADR-006 | the CSV builder | UT-118–UT-122 | IT-314 | — |
| ADR-006 | print: no case — `jsdom` computes no layout | — | — | — |
| ADR-007 | seeded roles carry the new permission | — | IT-304 | — |
| ADR-008 | the section, and the boot surface it must not change | — | IT-305, IT-312, IT-315 | — |
| `monthRange` | month boundaries, shared by guard and aggregation | UT-101–UT-104 | IT-293 | — |
| `toStatementLines` | line assembly, names, null category | UT-110–UT-115 | IT-263 | — |
| `GET /closings/:month` | success shape and each documented failure | — | IT-258, IT-268–IT-271 | — |
| `POST /close` | success and each documented failure | — | IT-275, IT-277–IT-280 | — |
| `POST /reopen` | success and each documented failure | — | IT-291, IT-294, IT-295 | — |
| `GET /closings` | list, order, scope | — | IT-296, IT-297 | — |
| Permission matrix | who reads, who closes, who reopens | — | IT-279, IT-294, IT-303, IT-304 | — |
| `ClosingSection` | month, balances, tables, states, actions | — | IT-305–IT-313 | — |

## Unit Tests

### `monthRange` (TechSpec: Known Risks — month boundaries and timezone)

- **UT-101** (happy): `monthRange('2026-09')` — returns a start of
  `2026-09-01T00:00:00.000` and an exclusive end of `2026-10-01T00:00:00.000`.
- **UT-102** (boundary): `monthRange('2026-12')` — the exclusive end rolls the
  year to `2027-01-01T00:00:00.000`.
- **UT-103** (boundary): `monthRange('2024-02')` — a leap February ends at
  `2024-03-01T00:00:00.000`, so 29/02 is inside the range.
- **UT-104** (error): `monthRange('2026-13')` — throws `RangeError`; the helper
  does not silently normalise an impossible month into January of the next year.

### Opening-balance resolution (TechSpec: Core Interfaces; ADR-002)

- **UT-105** (happy): month `2026-09` whose `2026-08` closing is `CLOSED` with
  `closingBalance` 1234.56 — resolves to
  `{ amount: 1234.56, source: 'INHERITED', from: '2026-08' }`.
- **UT-106** (happy): no closing for `2026-08`, condominium opening balance 1000
  with cutoff `2026-01-01`, movements since the cutoff of +500 and −200 —
  resolves to `{ amount: 1300, source: 'COMPUTED', from: '2026-01-01' }`.
- **UT-107** (state): `2026-08` has a closing row whose status is `OPEN` — it is
  not inherited; the result is `COMPUTED`.
- **UT-108** (boundary): cutoff null — every movement before the month counts,
  with no lower bound applied.
- **UT-109** (boundary): opening balance 0 and no movements — resolves to
  `{ amount: 0, source: 'COMPUTED' }`, and not to a missing value.

### `toStatementLines` (TechSpec: Implementation Design; ADR-005)

- **UT-110** (happy): two grouped rows with known category ids — produces two
  lines carrying the resolved names, ordered by total descending.
- **UT-111** (boundary): a grouped row with `categoryId: null` — produces a line
  named `Sem categoria`; the value is never dropped.
- **UT-112** (state): a row whose category is soft-deleted — the line still
  carries the category name, because names are resolved `withDeleted`.
- **UT-113** (happy): the total returned alongside the lines equals the sum of
  those lines, for a set with a null category and two named ones.
- **UT-114** (boundary): an empty set of rows — produces `[]` and a total of 0,
  not `undefined`.
- **UT-115** (error): a row whose `categoryId` matches no category — the line
  keeps the id and falls back to `Categoria removida`; nothing throws.

### Snapshot deserialization (TechSpec: Known Risks — `breakdown`)

- **UT-116** (boundary): a stored `breakdown` with no `unresolvedPaidExpenses`
  key — reads as `{ count: 0, total: 0 }` instead of throwing.
- **UT-117** (state): a stored `breakdown` carrying an unknown extra key — is
  read without error and the key is ignored.

### `buildClosingCsv` (TechSpec: Implementation Design; ADR-006)

- **UT-118** (happy): a statement with two income lines and one expense line —
  produces a header row, the three lines in screen order, and the totals block,
  semicolon-separated.
- **UT-119** (boundary): a line total of `1234.5` — is written `1234,50`, with
  the decimal comma and two places.
- **UT-120** (boundary): a category named `Água; luz` — is quoted so the embedded
  semicolon does not split the column.
- **UT-121** (state): a statement with a null-category line and a non-zero
  `unresolvedPaidExpenses` — both appear, the second outside the totals block.
- **UT-122** (boundary): the output starts with the UTF-8 BOM and every row ends
  with CRLF.

### Label helpers (TechSpec: Implementation Design)

- **UT-123** (happy): `openingBalanceProvenance({ source: 'INHERITED', from:
  '2026-08' })` — returns `Herdado do fechamento de ago/2026`.
- **UT-124** (happy): `openingBalanceProvenance({ source: 'COMPUTED', from:
  '2026-01-01' })` — returns `Calculado a partir do saldo de abertura de
  01/01/2026`.

## Integration Tests

### The statement of an open month (`GET /financial/closings/:referenceMonth`)

- **IT-258**: seeded condominium, current month — the response `totalIncome`
  equals the sum of `payment.amount` for payments whose `paidAt` falls in the
  month, and differs from `charges/summary.received` for the same month, which
  sums `paid_amount` by charge competence.
- **IT-259**: a charge of 500 with two payments of 200 and 150 inside the month —
  contributes 350, not 500.
- **IT-260**: a charge canceled before any payment — contributes nothing to
  either side, and produces no line.
- **IT-261**: an expense with `status: 'PENDING'` and a `dueDate` inside the month
  — contributes nothing; only `PAID` expenses with a `paidAt` in range count.
- **IT-262**: an expense with `competence` `2026-07` paid on `2026-08-03` —
  appears in the statement of `2026-08` and not in that of `2026-07`.
- **IT-263**: a payment against a charge with `categoryId: null` and an expense
  with `categoryId: null` — each side carries a `Sem categoria` line, and each
  total still equals the sum of its lines.
- **IT-264**: any month with movement — `totalIncome` equals the sum of
  `income[].total` and `totalExpense` equals the sum of `expense[].total`.
- **IT-265**: any month — `closingBalance` equals
  `openingBalance.amount + totalIncome - totalExpense`.
- **IT-266**: a month with overdue charges — `delinquency.amount` is greater than
  zero and is absent from `result` and from `closingBalance`.
- **IT-267**: an expense written straight through `expenseRepository.create` with
  `status: 'PAID'` and `paidAt: null` (the state the service now refuses), with
  `competence` equal to the month — appears in `unresolvedPaidExpenses` with its
  value, and `totalExpense` does not include it.
- **IT-268**: a condominium with no movement in the month — returns
  `totalIncome: 0`, `totalExpense: 0`, empty `income` and `expense`, `status:
  'OPEN'` and `closedAt: null`.
- **IT-269**: `GET /financial/closings/2026-13?condominiumId=…` — 422 with
  `error.code` of validation; no query runs.
- **IT-270**: the same route without `condominiumId` — 422.
- **IT-271**: a síndico asking for a condominium outside their scope — 403.

### Opening balance (ADR-002)

- **IT-272**: an isolated tenant whose condominium has `openingBalance` 1000 and
  `openingBalanceDate` set before its first movement, with nothing ever closed —
  the statement opens at 1000 plus the movements between the cutoff and the month.
- **IT-273**: close month M, then read M+1 — `openingBalance.amount` equals M's
  `closingBalance` exactly, with `source: 'INHERITED'` and `from` equal to M.
- **IT-274**: a movement dated before `openingBalanceDate` — is excluded from the
  computed opening balance.

### Closing a month (`POST /financial/closings/:referenceMonth/close`)

- **IT-275**: read the statement of a finished month, then close it — the
  response carries `status: 'CLOSED'`, a `closedAt`, a `closedBy` with the actor's
  id and name, and every figure equal to the reading taken immediately before.
- **IT-276**: after closing, insert a payment dated inside that month straight
  through `paymentRepository.create`, then read the month again — the statement is
  byte-identical to the closed one; the new payment does not appear.
- **IT-277**: closing an already closed month — 409, and no second row is created
  (the list still reports one closing for that month).
- **IT-278**: closing the current, unfinished month — 409.
- **IT-279**: a role holding `financial-closing:read` only — 403 on close.
- **IT-280**: closing M+1 while M was never closed — 200, with
  `openingBalance.source: 'COMPUTED'`.

### The freeze (ADR-003)

- **IT-281**: `POST /financial/charges/:id/payments` with `paidAt` inside a closed
  month — 409, the message names the month, and no payment row is created.
- **IT-282**: the same route with `paidAt` in an open month while another month is
  closed — 201.
- **IT-283**: `POST /financial/expenses` with `status: 'PAID'` and a `paidAt`
  inside a closed month — 409.
- **IT-284**: `PATCH /financial/expenses/:id` moving `paidAt` from an open month
  into a closed one — 409.
- **IT-285**: `PATCH /financial/expenses/:id` changing the amount of an expense
  whose current `paidAt` is inside a closed month — 409.
- **IT-286**: `POST /financial/expenses/:id/pay` with `paidAt` inside a closed
  month — 409.
- **IT-287**: `DELETE /financial/expenses/:id` on a PAID expense whose `paidAt` is
  inside a closed month — 409, and the row is not soft-deleted.
- **IT-288**: `POST /financial/expenses/:id/restore` on a soft-deleted PAID
  expense whose `paidAt` is inside a closed month — 409.
- **IT-289**: `POST /financial/charges` with `referenceMonth` equal to a closed
  month — 201; charges are not frozen, and the closed statement is unchanged after
  it.
- **IT-290**: `POST /financial/charges/apply-late-fees` touching charges of a
  closed month — 200, and re-reading the closed month returns the same figures.

### Reopening (ADR-003, ADR-005)

- **IT-291**: reopen a closed month — `status: 'OPEN'`, `reopenedAt` set,
  `reopenCount` 1, and the audit trail carries the action.
- **IT-292**: after reopening, a payment dated inside that month — 201.
- **IT-293**: reopen, register a payment inside the month, close again — the list
  still reports a single closing for that month, its `reopenCount` is still 1, and
  `totalIncome` now includes the new payment.
- **IT-294**: a role holding `financial-closing:create` but not `manage` — 403 on
  reopen, after succeeding on close.
- **IT-295**: reopening a month that was never closed — 409.

### Listing (`GET /financial/closings`)

- **IT-296**: two closed months — returns both, newest `referenceMonth` first,
  with `meta.total` of 2.
- **IT-297**: a closing belonging to another condominium of the same tenant — is
  absent from a list filtered by `condominiumId`.

### The paid-expense invariant (ADR-004)

- **IT-298**: `POST /financial/expenses` with `status: 'PAID'` and no `paidAt` —
  409, message naming the payment date.
- **IT-299**: `PATCH` setting `status: 'PAID'` on an expense that has no `paidAt`
  — 409.
- **IT-300**: `PATCH` setting `status: 'PAID'` on an expense that already carries
  a `paidAt` — 200.
- **IT-301**: `PATCH` clearing `paidAt` on an expense whose status is `PAID` —
  409.
- **IT-302**: `POST /financial/expenses/:id/pay` on a pending expense — 200 and
  the row carries both `status: 'PAID'` and the `paidAt` sent; the normal path is
  unaffected by the invariant.

### Permission matrix

- **IT-303**: the seeded `morador` (RESIDENT) reading the statement — 403.
- **IT-304**: the seeded `sindico` — reads the statement, closes a finished month
  and reopens it, all 200, on the permissions the seed grants without any custom
  role.

## Frontend Integration Tests

### The Balancete section (ADR-008)

- **IT-305**: open `/financeiro`, switch to `Balancete` — the month input carries
  the current month, and the screen shows the opening balance with its provenance
  line, both category tables, the result and the closing balance.
- **IT-306**: change the month input to the previous month — a second request is
  made with that month and the figures on screen change.
- **IT-307**: a month with no movement — the screen reads `Nenhum lançamento em
  <mês>`, and does not render a zero-filled statement.
- **IT-308**: a closed month — the closed badge and the closing date are shown,
  the reopen action is offered and the close action is not.
- **IT-309**: a reader without `financial-closing:create` — no close action is
  rendered, for an open month.
- **IT-310**: a reader without `financial-closing:manage` — no reopen action is
  rendered, for a closed month.
- **IT-311**: clicking `Fechar mês` — a confirmation appears naming the month, and
  the endpoint is called only after it is confirmed; dismissing it calls nothing.
- **IT-312**: a reader without `financial-closing:read` — the `Balancete` button
  is absent from the section switcher and the other three sections still work.
- **IT-313**: a close that answers 409 — the refusal from the server is shown in
  the section and the month stays open on screen.
- **IT-314**: clicking `Exportar CSV` — `URL.createObjectURL` receives a `Blob`
  and `HTMLAnchorElement.prototype.click` is called once; no request is made.
- **IT-315**: render `/financeiro` and assert the requests made on mount — none of
  them is a closing URL; the statement is read only after the section is opened.

### Condominium fields (ADR-002)

- **IT-316**: type `1500,50` into the opening balance of the condominium form and
  submit — the request body carries `openingBalance: 1500.5`, not `150050`.
- **IT-317**: a condominium with an opening balance and a cutoff date — both are
  rendered on the record card, formatted as currency and as a date.
