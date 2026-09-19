# TechSpec: Balancete Detalhado (Statement Movements)

## Executive Summary

No PRD precedes this document. It extends `balancete-mensal`, delivered and
merged in PR #3, whose TechSpec and eight ADRs are the contract this one builds
on — read them first; nothing they decided is reopened here.

The statement today answers *how much* came in and went out, by category. It does
not answer *which* payments and *which* expenses produced those numbers. This
workflow adds the movements, and puts them where a rendered account belongs: a
route of its own at `/financeiro/balancete/:mes`, with the summary above and the
list below, printable and exportable as one document (ADR-001).

The movements of a closed month are **frozen at close time in a child table**
(ADR-002). They cannot be recomputed: `balancete-mensal` IT-276 proves that a
write made directly to the database after closing does not move the frozen
totals, so a recomputed list would show a row the total above it excludes. Making
the closing write atomic turns `close` into the financial module's first
transaction and forces it to bypass `BaseRepository`, which cannot participate in
one (ADR-003).

The principal trade-off is payload size: the month arrives complete in one
response and pages on the client (ADR-004), so the screen, the print sheet and
the CSV are the same document by construction rather than by discipline.

## System Architecture

### Component Overview

```text
backend/src/
  modules/financial/
    entities/financial-closing-entry.entity.ts     NEW   one frozen movement
    repositories/financial-closing-entry.repository.ts NEW  read by closing; delete by closing
    repositories/payment.repository.ts             MOD   movementsInRange (rows, not SUM)
    repositories/expense.repository.ts             MOD   paidMovementsInRange
    services/closing.service.ts                    MOD   entries(); close() becomes a transaction
    closing.routes.ts                              MOD   GET /:referenceMonth/entries
    schemas/financial.schema.ts                    MOD   (no new input — the month and condominium are the existing ones)
  database/migrations/<ts>-ClosingEntries.ts       NEW   table + two paid_at indexes
  config/swagger.ts                                MOD   the new route

frontend/src/
  features/financial/
    balancete-page.tsx                             NEW   the route's screen
    closing-entries-table.tsx                      NEW   the table, filter and client paging
    closing-csv.ts                                 MOD   second block with the movements
    financial-hooks.ts                             MOD   useClosingEntries
    financial-labels.ts                            MOD   labels for kind, method, empty states
    components/closing-section.tsx                 MOD   loses the two export buttons, gains the link
    closing-section.test.tsx                       MOD   IT-314 moves out; a case for the link moves in
  routes/app-router.tsx                            MOD   the route, guarded by financial-closing:read
  test/routes.test.tsx                             MOD   AUXILIARY_READS gains the closing URLs; a case for the route
  types/financial.ts                               MOD   StatementEntry
```

Reading a month:

```text
BalancetePage (/financeiro/balancete/:mes)
   ├── useClosing(condominiumId, mes) ──────▶ GET /financial/closings/:mes          (summary, already exists)
   └── useClosingEntries(condominiumId, mes) ▶ GET /financial/closings/:mes/entries
                                                        │
                                               ClosingService.entries
                                                        │
                                   ┌────────────────────┴─────────────────────┐
                              row is CLOSED                          no row, or OPEN
                                    │                                        │
                    read financial_closing_entries          payments.movementsInRange
                    (one indexed read, no aggregation)    + expenses.paidMovementsInRange
                                                          + unit numbers / provider names
```

Writing one:

```text
ClosingService.close ──▶ AppDataSource.transaction(manager => {
                            delete entries of this closing      ← unconditional (ADR-003)
                            insert the recomputed movements     ← { chunk: 100 }
                            insert or update financial_closings
                         })
                      ──▶ audit.record(...)                     ← outside, after commit
```

## Implementation Design

### Core Interfaces

```ts
/** Um lancamento do balancete: uma entrada ou uma saida, como ela foi naquele dia. */
export type StatementEntry = {
  kind: 'INCOME' | 'EXPENSE';
  /** Data de caixa: `payment.paid_at` ou `expense.paid_at`. */
  occurredAt: Date;
  categoryId: string | null;
  /** Congelado: a categoria pode ser renomeada ou removida depois. */
  categoryName: string;
  description: string;
  /** A outra parte: numero da unidade na entrada, prestador na saida. */
  counterpart: string | null;
  amount: number;
  method: PaymentMethod | null;
  /** Referencia a origem (`payment.id` ou `expense.id`). Nao e um link. */
  sourceId: string;
};
```

```ts
export class ClosingService {
  // ... statement, list, close, reopen (existentes)

  /**
   * Os lancamentos do mes. Serve o gravado quando `CLOSED`; calcula quando
   * aberto — a mesma regra que `statement` ja segue.
   */
  entries(
    ctx: RequestContext,
    condominiumId: string,
    referenceMonth: string,
  ): Promise<StatementEntry[]>;
}
```

Ordering is the service's, not the caller's: `occurredAt` ascending, then
`amount` descending, then `sourceId` — a total order, so two reads of the same
closed month return the same sequence and a diff of two exports is meaningful.

### Data Models

`financial_closing_entries`, extending `TenantScopedEntity`:

| Column | Type | Notes |
|---|---|---|
| `closing_id` | `VARCHAR(36) NOT NULL` | FK → `financial_closings(id)` ON DELETE CASCADE |
| `kind` | `VARCHAR(20) NOT NULL` | `INCOME` · `EXPENSE` |
| `occurred_at` | `DATETIME(6) NOT NULL` | the cash date |
| `category_id` | `VARCHAR(36) NULL` | null is a real value — "Sem categoria" |
| `category_name` | `VARCHAR(120) NOT NULL` | denormalized, frozen |
| `description` | `VARCHAR(200) NOT NULL` | |
| `counterpart` | `VARCHAR(160) NULL` | unit number or provider name |
| `amount` | `DECIMAL(12,2) NOT NULL` | `numericTransformer` |
| `method` | `VARCHAR(20) NULL` | |
| `source_id` | `VARCHAR(36) NOT NULL` | reference only |

Objects: `KEY IDX_financial_closing_entries_closing (closing_id, kind)`,
`KEY IDX_financial_closing_entries_tenant (tenant_id)`,
`CONSTRAINT FK_financial_closing_entries_closing`.

The same migration adds the two indexes the date-range reads have always lacked:

```sql
CREATE INDEX IDX_payments_paid_at ON payments (tenant_id, condominium_id, paid_at);
CREATE INDEX IDX_expenses_paid_at ON expenses (tenant_id, condominium_id, paid_at);
```

They pay for this feature's live path and for the aggregations that predate it —
`incomeByCategory`, `paidByCategory` and `sumInWindow` all filter on those exact
columns today with no index behind them.

### API Endpoints

| Method | Path | Permission | Query | Success |
|---|---|---|---|---|
| GET | `/financial/closings/:referenceMonth/entries` | `financial-closing:read` | `condominiumId` (uuid, required) | 200, `{ entries: StatementEntry[]; frozen: boolean }` |

`frozen` says where the rows came from: `true` when they were read from storage
(the month is closed), `false` when they were computed. It is what lets the screen
tell a **closed month whose document predates this feature** — `frozen: true`,
`entries: []`, and totals above zero — from a month that simply had no movement.
Rendering the first as the second would be a false statement in a rendered
account.

Unpaginated by decision (ADR-004); `page` and `perPage` are not accepted, because
accepting and ignoring them would invite a caller to believe a page was applied.

Documented failures match the sibling route: **422** for a malformed
`referenceMonth` or a missing `condominiumId`, **403** for a condominium outside
the caller's scope or a missing permission.

The frontend route `/financeiro/balancete/:mes` is guarded by
`financial-closing:read` — **not** the `charge:read` that guards `/financeiro`. A
role that reads charges without reading the rendered account must not reach the
document by typing its address.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `financial_closing_entries` | new | The frozen movements. Low risk: nothing reads it until the screen exists | Entity, repository, migration |
| `ClosingService.close` | modified | Becomes a transaction and bypasses `BaseRepository`. **Highest risk in the workflow**: it is the write that produces every rendered account | ADR-003, with cases for atomicity and replacement |
| `payments` / `expenses` | modified | Two indexes added. Low risk, and it speeds up reads that already exist | Migration |
| `payment.repository` / `expense.repository` | modified | Row-level reads beside the existing aggregations | New methods |
| `closing-section.tsx` | modified | Loses two buttons, gains a link. **The previous workflow's IT-314 moves** | ADR-005; `_tests.md` records the migration of the case |
| `closing-csv.ts` | modified | Second block; signature takes the movements as an optional second argument | Keep the summary-only export representable |
| `routes.test.tsx` | modified | `AUXILIARY_READS` gains the closing URLs — the first change to that list since the statement was built | Add entries; a case for the new route |
| `app-router.tsx` | modified | One route, its own guard, not in `IMPLEMENTED` (that set is for menu paths only) | Register |
| `navigation.ts` | untouched | The route is not a menu item; `REGISTERED` and `NAV_ITEMS.length` stay equal | Verify, do not edit |

## Testing Approach

Every concrete case lives in [`_tests.md`](_tests.md).

- **Backend unit**: the pure parts — assembling a `StatementEntry` from a raw
  joined row, the ordering rule, and the "Sem categoria" / missing-category
  labels that `closing-math.ts` already owns for the lines.
- **Backend integration** (`supertest` over in-memory SQLite, the existing
  `setupTestContext` harness): the endpoint in both modes, the atomicity of
  `close`, the replacement on re-close, the permission matrix, and the frozen
  list refusing to follow a direct database write — the same canary shape as
  `balancete-mensal` IT-276, now aimed at the list.
- **Frontend unit**: the CSV with its second block.
- **Frontend integration**: the route through `renderWithProviders` with a local
  `<Routes>` carrying the parameter, as `condominium-detail-page.test.tsx:68-75`
  does; plus the route rendered through the real `AppRouter` in `routes.test.tsx`,
  as `/perfil` is.

The one thing no case covers remains the same as before: whether the printed page
looks right. `jsdom` computes no layout. What is testable — the marker classes the
CSS looks for, and the CSV content — is tested.

## Development Sequencing

### Build Order

1. **Storage and the write** — entity, repository, migration (table plus the two
   indexes), and `close` rebuilt as a transaction with unconditional replacement.
   Verifiable alone: closing a month twice leaves one set of movements.
2. **The read** — `entries()` in both modes, the row-level repository methods,
   the route, Swagger. Depends on 1.
3. **The screen** — the route, the page, the table with client paging and the
   category filter, the link from the section. Depends on 2.
4. **The exports** — print markers and the CSV's second block; the section loses
   its buttons. Depends on 3.

### Technical Dependencies

None outside the repository. The migration must run before the feature is
reachable in a deployed environment.

## Monitoring and Observability

The audit entry `close` already writes gains the movement count in `after`, so
the trail records not just that a month was closed but how large the document
was. No other event is added: the reads are reads, and the write is already
audited.

## Technical Considerations

### Key Decisions

Beyond the five ADRs:

- **An open month is served by the same route and the same screen**, computed
  live and labelled as open. A document that only existed after closing would be
  unreachable during the month it describes — which is when the síndico is
  working. The cost is that the live path and the frozen path must return the
  same shape, which the cases pin.
- **The frozen row keeps `source_id` and the screen does not link to it.** The id
  is free to store and impossible to add later; a link inside a rendered account
  that leads to a deleted row is a dead end in a document meant to be trusted.
- **A closed month with no stored movements says so.** The closing already in the
  database predates this work. An empty table rendered without explanation would
  read as "a month with no movement", which is a different and false statement.

### Known Risks

- **`close` is the riskiest write in the product** and this workflow rewrites it.
  Every rendered account passes through it. Mitigation: the replacement is
  unconditional, the transaction is one block, and `_tests.md` pins re-close,
  reopen-then-close, and failure atomicity.
- **`BaseRepository` is bypassed inside the transaction**, so `tenantId` is no
  longer injected for the rows written there and must be set explicitly on each —
  the same obligation `charge.service.ts:134` and `unit.service.ts:108` already
  carry.
- **The payload grows with the condominium** (ADR-004). Five hundred movements is
  roughly 60 KB; the prepared answer is the ceiling-and-notice alternative
  recorded in that ADR.
- **`AUXILIARY_READS` changes for the first time.** `balancete-mensal` task_04
  promised it would not, and that promise was about `/financeiro`'s boot. A route
  that reads the statement on mount is a different surface, and the change is
  deliberate rather than a regression of that guarantee.
- **The five money fields with `input type="number"`** remain uncorrected, as
  recorded in the previous TechSpec. Nothing here touches them.

## Architecture Decision Records

- [ADR-001: A Detail Route for the Closed Statement](adrs/adr-001.md) — the second resource to earn a detail route, under ADR-004's own criterion.
- [ADR-002: Frozen Movements in a Child Table, Not in the Document JSON](adrs/adr-002.md) — why the 64 KB `TEXT` ceiling and the query shape overturn `balancete-mensal` ADR-005 for movements only.
- [ADR-003: Closing Becomes One Transaction, and a Re-Close Replaces Its Movements](adrs/adr-003.md) — atomicity, and why `BaseRepository` cannot be used inside it.
- [ADR-004: The Whole Month in One Response, Paged on the Client](adrs/adr-004.md) — the document has to leave the screen complete.
- [ADR-005: Export and Print Move to the Detail Route](adrs/adr-005.md) — one place exports, and it exports everything it shows.
