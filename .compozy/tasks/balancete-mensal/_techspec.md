# TechSpec: Balancete Mensal (Monthly Cash Statement)

## Executive Summary

No PRD precedes this document. It was opened from `docs/balancete-mensal-plano.md`,
a survey written on 2026-09-17 against the code as it stands, and from four
product decisions the owner took on 2026-09-18: the statement is computed on a
**cash basis** (ADR-001), the previous balance comes from a **per-condominium
opening balance inherited forward through closings** (ADR-002), closing a month
**refuses only the writes that move cash in it** (ADR-003), and the document
leaves the screen through **browser print and a client-side CSV** (ADR-006).

The financial module already records every movement the statement needs; what it
has never had is a document that opens with the previous balance, lists what came
in and what went out by category, and closes with the balance the next month
inherits. Today that number is produced by opening three screens, applying
equivalent filters to each and adding up by hand, with nothing guaranteeing the
three cuts describe the same period.

The work adds one table, one service, four routes and a fourth section to
`/financeiro`. It also closes one production hole on the way: an expense can
currently be `PAID` with no payment date, and such a row belongs to no month in a
cash statement — it would silently leave the balance (ADR-004). The principal
trade-off is that the statement answers "what moved through the account this
month", not "what did it cost to run the building this month"; the second
question keeps its existing, unconsumed endpoint and no screen.

## System Architecture

### Component Overview

```text
backend/src/
  modules/financial/
    entities/financial-closing.entity.ts          NEW   the stored document (ADR-005)
    repositories/financial-closing.repository.ts  NEW   findMany/findByMonth + the two aggregations
    services/closing.service.ts                   NEW   statement / close / reopen
    closing-guard.ts                              NEW   assertMonthOpen, over the repository only
    closing.routes.ts                             NEW   four routes, mounted at /financial/closings
    schemas/financial.schema.ts                   MOD   closing query/params/body schemas
    services/expense.service.ts                   MOD   PAID⇒paidAt invariant + 4 guard sites + restore override
    services/charge.service.ts                    MOD   guard site inside registerPayment
    financial.routes.ts                           MOD   financialRouter.use('/closings', closingRouter)
  modules/condominiums/
    condominium.entity.ts                         MOD   opening_balance, opening_balance_date
    condominium.schema.ts                         MOD   the two fields
  shared/constants/resources.ts                   MOD   + 'financial-closing'
  shared/utils/date.util.ts                       MOD   + monthRange(referenceMonth)
  database/migrations/<ts>-FinancialClosings.ts   NEW   table + columns + role permission patch

frontend/src/
  features/financial/
    components/closing-section.tsx                NEW   the fourth section
    closing-csv.ts                                NEW   pure builder (ADR-006)
    financial-hooks.ts                            MOD   CLOSINGS_KEY, useClosing/useCloseMonth/useReopenMonth
    financial-labels.ts                           MOD   SECTIONS entry + labels
    financial-page.tsx                            MOD   one branch in the section ternary
    test-utils.ts                                 MOD   serveFinancial answers the closing URLs
  features/condominiums/
    condominium-schema.ts                         MOD   the two fields
    components/condominium-form-dialog.tsx        MOD   the two fields
    components/condominium-record-card.tsx        MOD   display
  types/financial.ts                              MOD   MonthlyStatement and friends
  index.css                                       MOD   the @media print block
```

Data flow for one reading of month M:

```text
ClosingSection ──useClosing──▶ GET /financial/closings/:M
                                      │
                             ClosingService.statement
                                      │
                    ┌─────────────────┴──────────────────┐
              row is CLOSED                       no row, or OPEN
                    │                                    │
        deserialize the snapshot          FinancialClosingRepository
        (one row, no aggregate)             ├─ incomeByCategory(M)   payments.paid_at
                                            ├─ expenseByCategory(M)  expenses.paid_at, status=PAID
                                            ├─ unresolvedPaidExpenses(M)
                                            ├─ delinquency snapshot
                                            └─ openingBalance: previous closing, else
                                               condominium.opening_balance + movements since cutoff
```

Both branches return the same shape. `close` persists exactly the object the
recompute branch produced, which is what makes the two branches comparable at
all (ADR-005).

## Implementation Design

### Core Interfaces

The contract, shared in spirit by `types/financial.ts` on the client:

```ts
export type StatementLine = {
  categoryId: string | null;   // null is a real line, never dropped
  name: string;                // 'Sem categoria' when categoryId is null
  total: number;
};

export type MonthlyStatement = {
  condominiumId: string;
  referenceMonth: string;                       // YYYY-MM
  status: 'OPEN' | 'CLOSED';
  openingBalance: {
    amount: number;
    source: 'INHERITED' | 'COMPUTED';
    from: string | null;                        // 'YYYY-MM' when inherited, cutoff date when computed
  };
  income: StatementLine[];
  expense: StatementLine[];
  totalIncome: number;                          // sum of income lines, in memory
  totalExpense: number;                         // sum of expense lines, in memory
  result: number;                               // totalIncome - totalExpense
  closingBalance: number;                       // openingBalance.amount + result
  unresolvedPaidExpenses: { count: number; total: number };   // ADR-004, outside every total
  delinquency: { amount: number; count: number };             // auxiliary, frozen on close
  closedAt: string | null;
  closedBy: { id: string; name: string } | null;
  reopenedAt: string | null;
  reopenCount: number;
};
```

The service surface:

```ts
export class ClosingService {
  statement(ctx: RequestContext, condominiumId: string, month: string): Promise<MonthlyStatement>;
  close(ctx: RequestContext, condominiumId: string, month: string): Promise<MonthlyStatement>;
  reopen(ctx: RequestContext, condominiumId: string, month: string): Promise<MonthlyStatement>;
  list(ctx: RequestContext, options: QueryOptions): Promise<Paginated<FinancialClosing>>;
}

// closing-guard.ts — a function over the repository, not a service dependency
export function assertMonthOpen(
  scope: TenantScope,
  condominiumId: string,
  when: Date,
): Promise<void>;   // throws BusinessRuleError (409) naming the month
```

Error conventions follow the codebase: `BusinessRuleError` → 409 for a violated
rule, `ValidationError` → 422 from zod at the boundary, `NotFoundError` → 404,
`ForbiddenError` → 403 from `authorize`. `assertCondominiumAccess` guards the
`condominiumId` in every entry point, as `CondominiumScopedService` does for the
CRUD resources.

`ClosingService` does **not** extend `CondominiumScopedService`: there is no
create/update/delete surface to inherit, and mounting the factory would expose six
operations over a resource that has three. This is the reasoning already written
into `features/tenant/tenant-hooks.ts` and `audit-hooks.ts` on the client side,
applied on the server.

### Data Models

`financial_closings`, extending `TenantScopedEntity` (id, created_at, updated_at,
deleted_at, tenant_id):

| Column | Type | Notes |
|---|---|---|
| `condominium_id` | `VARCHAR(36) NOT NULL` | FK → `condominiums(id)` ON DELETE CASCADE |
| `reference_month` | `VARCHAR(7) NOT NULL` | `YYYY-MM` |
| `status` | `VARCHAR(20) NOT NULL DEFAULT 'CLOSED'` | `CLOSED` · `OPEN` (only after a reopen) |
| `opening_balance` | `DECIMAL(12,2) NOT NULL DEFAULT 0` | `numericTransformer` |
| `opening_balance_source` | `VARCHAR(20) NOT NULL DEFAULT 'COMPUTED'` | `INHERITED` · `COMPUTED` |
| `opening_balance_from` | `VARCHAR(10) NULL` | previous month, or the cutoff date |
| `total_income` | `DECIMAL(12,2) NOT NULL DEFAULT 0` | |
| `total_expense` | `DECIMAL(12,2) NOT NULL DEFAULT 0` | |
| `closing_balance` | `DECIMAL(12,2) NOT NULL DEFAULT 0` | |
| `overdue_amount` | `DECIMAL(12,2) NOT NULL DEFAULT 0` | auxiliary, frozen |
| `overdue_count` | `INT NOT NULL DEFAULT 0` | auxiliary, frozen |
| `breakdown` | `TEXT NOT NULL` | `simple-json`: `{ income[], expense[], unresolvedPaidExpenses }` |
| `closed_at` | `DATETIME(6) NULL` | |
| `closed_by_id` / `closed_by_name` | `VARCHAR(36)` / `VARCHAR(160) NULL` | the name is denormalized on purpose: the document keeps it |
| `reopened_at` | `DATETIME(6) NULL` | |
| `reopened_by_id` / `reopened_by_name` | `VARCHAR(36)` / `VARCHAR(160) NULL` | |
| `reopen_count` | `INT NOT NULL DEFAULT 0` | |

Objects, following the naming the two existing migrations fix:
`UQ_financial_closings_month (tenant_id, condominium_id, reference_month)`,
`IDX_financial_closings_tenant (tenant_id)`,
`FK_financial_closings_condominium`.

A row exists **only after a month has been closed**. No row and
`status = 'OPEN'` both mean open; the difference is only that the second has been
closed before. Closing a reopened month updates the same row — the unique index
makes that structural rather than conventional.

On `condominiums`:

| Column | Type | Notes |
|---|---|---|
| `opening_balance` | `DECIMAL(12,2) NOT NULL DEFAULT 0` | `numericTransformer` |
| `opening_balance_date` | `DATE NULL` | typed `string \| null`, as `syndic_term_ends_at` already is |

Zod, in `condominium.schema.ts`, beside `chargeDueDay`:
`openingBalance: moneySchema.default(0)` and
`openingBalanceDate: z.string().date().optional().nullable()`.

### API Endpoints

All under the authenticated `/api/v1` prefix, mounted by
`financialRouter.use('/closings', closingRouter)`. `closingRouter` is a plain
`Router()`, not `createCrudRouter`: there is no CRUD here.

| Method | Path | Permission | Body / Query | Success |
|---|---|---|---|---|
| GET | `/financial/closings` | `financial-closing:read` | query `condominiumId` (uuid, required), `page`, `perPage` | 200, paginated rows, newest month first |
| GET | `/financial/closings/:referenceMonth` | `financial-closing:read` | query `condominiumId` | 200, `MonthlyStatement` |
| POST | `/financial/closings/:referenceMonth/close` | `financial-closing:create` | body `{ condominiumId }` | 200, the closed `MonthlyStatement` |
| POST | `/financial/closings/:referenceMonth/reopen` | `financial-closing:manage` | body `{ condominiumId }` | 200, the reopened `MonthlyStatement` |

`:referenceMonth` is validated by `z.object({ referenceMonth: referenceMonthSchema })`,
reusing the schema already at `financial.schema.ts:7`; a malformed month is 422
before any query runs. That schema is module-private (`const`, not exported),
which is why the closing schemas live in the same file rather than in one of
their own — exporting it to a new module would widen a surface the module has
kept closed.

Documented failures:

- **409** closing a month that is already `CLOSED`; closing a month that has not
  ended yet; reopening a month that is not `CLOSED`.
- **403** `assertCondominiumAccess` refuses a condominium outside the caller's
  scope, and `authorize` refuses a missing permission.
- **422** malformed `referenceMonth`, missing or non-uuid `condominiumId`.

Reopening requires a strictly stronger permission than closing: `manage` is the
wildcard of the resource in `hasPermission`, so a role granted only
`financial-closing:create` can close and cannot reopen. Closing is routine;
undoing a rendered account is not.

**No reopening reason is captured.** Who reopened and when is on the row, and the
act is written to the append-only audit trail like every other mutation. A free
text field would be the only unvalidated narrative in the financial module, and
the audit entry already answers the question it would answer.

**No realtime event is emitted.** `RealtimeEvent` gains nothing: two
administrators closing the same month concurrently are resolved by the unique
index and by the 409, not by a broadcast. Adding an event nobody needs is the
mistake `dashboard:refresh` already records in this repository.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `financial_closings` | new | The stored document. Low risk: nothing reads it yet. | Entity, repository, migration |
| `condominiums` | modified | Two columns, both defaulted. Low risk: existing rows read 0 / null. | Entity, schema, migration, form, card |
| `ExpenseService` | modified | New invariant (409 where 201 was possible) plus four guard sites and a `restore` override. **Medium risk**: it changes the outcome of requests that succeed today. | ADR-004 invariant, ADR-003 guards, tests per site |
| `ChargeService.registerPayment` | modified | One guard before the payment row is created. Medium risk: the busiest financial write. | Inline `assertMonthOpen`, tests |
| `RESOURCES` | modified | 31 → 32 resources; ADMIN and SÍNDICO gain `manage` by derivation. Low risk in code, **high risk in deployed data** (ADR-007). | Constant, data migration |
| `financial.routes.ts` | modified | One `use`. Low risk. | Mount |
| `financial-page.tsx`, `financial-labels.ts` | modified | One section entry, one branch. Low risk. | ADR-008 |
| `serveFinancial` (`test-utils.ts`) | modified | Throws on unknown URLs; without the new entries every financial screen test fails. Low risk, certain failure if forgotten. | Add the closing URLs |
| `routes.test.tsx` | untouched | No menu item, and the section's hook lives in the section component, so `/financeiro` boots with the same reads. | Verify, do not edit |
| `GET /financial/expenses/summary` | untouched | Answers the accrual question; consumed by nothing. Left as is, deliberately. | None |
| `swagger.ts` | modified | The four routes join the hand-written block that already documents `/charges/summary` and `/expenses/{id}/pay`. Low risk. | Document |

## Testing Approach

Every concrete case lives in [`_tests.md`](_tests.md).

- **Backend unit** (`jest`, `backend/tests/unit/`): the pure parts — month range
  arithmetic, the opening-balance resolution rule, the line-assembly that turns
  raw grouped rows into `StatementLine[]` with `Sem categoria` and with totals
  derived from the lines. No database.
- **Backend integration** (`jest` + `supertest`, `backend/tests/integration/`):
  the real Express app over in-memory SQLite (`sqljs`), the existing
  `setupTestContext` / `login` / `seedUsers` harness, no fakes. This is where the
  statement, the freeze, the invariant and the permission matrix are pinned. The
  seed already provides three competences of charges, payments and expenses for
  one condominium, with deliberate delinquency — enough to assert real sums
  without inventing a second seed.
- **Frontend unit** (`vitest`): the CSV builder and the label/derivation helpers,
  as pure functions.
- **Frontend integration** (`vitest` + Testing Library): the section through
  `renderWithProviders`, with `@/lib/api` doubled at the transport seam (ADR-010)
  and `serveFinancial` extended. Permission variants use the `permissions` option
  of the harness.
- **No end-to-end level exists in this repository**, and this feature does not
  introduce one; the integration level goes through the public HTTP surface on
  the backend and through the rendered screen on the frontend, which is the
  substitution the `frontend-cruds` TechSpec already recorded.

Environment: `npm --prefix backend run test` needs no MySQL and no Redis
(`NODE_ENV=test` selects `sqljs` and disables the cache). The migration is the one
artifact no suite exercises — `data-source.ts:17-24` never loads migrations — so
`npm --prefix backend run migration:run` against MySQL is a task step with its own
acceptance, not a test case.

## Development Sequencing

### Build Order

1. **Foundation** — `financial-closing.entity.ts`, the repository skeleton,
   the two `condominiums` columns, `financial-closing` in `RESOURCES`, and the
   migration including the role patch. Depends on nothing. Verifiable alone:
   the schema exists, the permission exists, the seeded roles carry it.
2. **The invariant** — ADR-004 in `ExpenseService`, with its cases. Depends on
   nothing, and comes before the calculation so that the expense side is built
   against data that cannot be silently monthless.
3. **The calculation** — `ClosingService.statement`, the aggregations, the
   opening-balance resolution, `GET /financial/closings/:referenceMonth` and
   `GET /financial/closings`. Depends on 1 and 2.
4. **Close, reopen and the freeze** — `close`, `reopen`, `closing-guard.ts` and
   the six call sites. Depends on 3: a freeze without a stored document has
   nothing to protect.
5. **The screen** — the fourth section, hooks, month picker, the close and
   reopen actions with confirmation, empty state. Depends on 3 and 4.
6. **Export** — the print stylesheet and the CSV builder. Depends on 5.

### Technical Dependencies

None outside the repository. No new runtime dependency, on either side. The
migration must run before the feature is reachable in any deployed environment,
which is the only ordering constraint outside the build.

## Monitoring and Observability

- **Audit trail.** `close` and `reopen` write through `auditService.record` the way
  `ChargeService.registerPayment` does for a write that bypasses the CRUD base —
  action `UPDATE`, resource `financial-closing`, before/after carrying
  `status`, `closingBalance` and `reopenCount`. This is the record that makes
  reopening accountable, and it is append-only by design of the audit module.
- **Logs.** The existing request logger covers the routes; no feature-specific
  log event is added.
- **What to watch, without building anything for it now**: the count of reopenings
  per condominium. A month reopened repeatedly means either the freeze is placed
  wrong or the closing is happening too early.

## Technical Considerations

### Key Decisions

Beyond the eight ADRs, three decisions are recorded here because they are
consequences rather than choices between architectures:

- **One source of sums.** The per-category lines are produced first, and every
  headline total is the sum of those lines in memory. Rationale: two independent
  `SUM` queries over the same table drift the moment one grows a filter the other
  does not — which is exactly how `charges/summary`, `delinquencyByUnit` and
  `monthlySeries` ended up with three different definitions of "the value of a
  charge" (`charge.repository.ts:65-134`). Trade-off: the headline total cannot
  be read without reading the lines, which is fine because the document always
  shows both.
- **A month that has not ended cannot be closed.** Rationale: closing September
  on the 18th freezes a month still receiving money, and then every remaining
  payment of that month is refused by the guard — a foot-gun aimed at the busiest
  write in the module. Trade-off: no partial or provisional close; the statement
  of the running month is always the live computation.
- **Sequential closing is not required.** A month can be closed with its
  predecessor still open; the opening balance simply resolves by computation
  instead of inheritance. Rationale: requiring the chain would make the first
  ever close impossible unless the condominium's whole history were closed first.

### Known Risks

- **Month boundaries and timezone.** `payment.paid_at` and `expense.paid_at` are
  `datetime`. The guard and the aggregation must agree on where a month starts, or
  a payment can be refused as belonging to a closed month and then summed into a
  different one. Mitigation: a single `monthRange(referenceMonth)` helper in
  `date.util.ts`, used by both, with a case pinning a movement at each edge.
  `tenant.settings.timezone` is not consulted — nothing in this codebase reads it,
  and inventing a second time authority here would be worse than server time.
- **Money typed through `input type="number"` swallows the decimal comma.** This
  is recorded in this repository and it is live in the financial screens today:
  `charge-form-dialog.tsx:228-254` and `expense-form-dialog.tsx:229` use
  `type="number"` for five money fields, so `1500,50` becomes `150050`. The
  opening-balance field introduced here uses `inputMode="decimal"` without
  `type="number"`, as `chargeDueDay` already does. **Repairing the five existing
  fields is out of scope for this workflow** and is named here because a wrong
  amount poisons the statement more visibly than it poisons a list.
- **`breakdown` is a serialized shape with no database-level schema.** A later
  change to its fields must tolerate rows written by the previous shape.
  Mitigation: the deserializer fills missing keys with empty defaults rather than
  failing, and a case pins that a snapshot without `unresolvedPaidExpenses` reads
  as zero instead of throwing.
- **The freeze has six call sites and no structural enforcement.** A seventh write
  path added later inherits nothing. Mitigation: `_tests.md` pins each site; the
  guard lives in the financial module next to what it protects.
- **`ExpenseService.pay` creates the next occurrence of a recurring expense.**
  That insert lands in a later, open month and is therefore not refused. It does
  not affect any statement, and is named so it is not mistaken for a hole in the
  freeze.
- **The role data migration is untested by any suite.** See ADR-007; verification
  is a manual `migration:run` against MySQL.

## Architecture Decision Records

- [ADR-001: Cash Basis for the Monthly Statement](adrs/adr-001.md) — the statement sums `payment.paid_at` and `expense.paid_at`; no charge field feeds it.
- [ADR-002: Opening Balance on the Condominium, Inherited Through Closings](adrs/adr-002.md) — two columns on `condominiums`, and each closed month hands its balance forward.
- [ADR-003: The Freeze Covers Only Writes That Move Cash](adrs/adr-003.md) — six guarded call sites; charges stay free, because they cannot change the document.
- [ADR-004: A Paid Expense Must Carry Its Payment Date](adrs/adr-004.md) — a production invariant plus a visible reconciliation line for rows that predate it.
- [ADR-005: A Closed Month Is a Stored Document, Not a Recomputed View](adrs/adr-005.md) — one table holding totals, lines and provenance; a row exists only once closed.
- [ADR-006: Export by Browser Print and Client-Side CSV](adrs/adr-006.md) — no new dependency, no new route, no second layout.
- [ADR-007: The New Permission Reaches Seeded Roles Through a Data Migration](adrs/adr-007.md) — without it the screen 403s in every already-seeded database.
- [ADR-008: A Fourth Section Under /financeiro, Not a Menu Item of Its Own](adrs/adr-008.md) — the statement lives with the ledgers it summarises.
