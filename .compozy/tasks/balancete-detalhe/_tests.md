# Test Specification: Balancete Detalhado

Canonical test contract. Companion to [`_techspec.md`](_techspec.md).

No `_user_stories.md` exists — this workflow extends `balancete-mensal` from a
direct request plus two product decisions, recorded in [`adrs/`](adrs/). The
matrix below is organised by ADR and by component for that reason.

## Strategy

- **Frameworks and harnesses.** Unchanged from `balancete-mensal`: Jest +
  `supertest` over in-memory SQLite (`sqljs`) with `setupTestContext` / `login` /
  `seedUsers`, no fake at any boundary; Vitest + Testing Library with `@/lib/api`
  doubled at the transport seam (ADR-010 of `frontend-cruds`).
- **Execution.** `npm --prefix backend run test`, `npm --prefix frontend run test`.
  No MySQL, no Redis, no network.
- **Conventions.** Case names in Portuguese, third person, no accents, no
  "should" / "deve", each prefixed with its id. Assert `error.code` rather than
  the message on 422.
- **The detail route in tests.** Two harnesses, on purpose. Component-level cases
  mount a local `<Routes>` carrying the parameter and pass the concrete URL in
  `route`, as `condominium-detail-page.test.tsx:68-75` does. The route's
  existence inside the real router is asserted once in `routes.test.tsx`, the way
  `/perfil` is (`:344`) — outside `REGISTERED`, so the
  `toHaveLength(NAV_ITEMS.length)` invariant keeps its meaning.
- **Numbering.** `UT-125` and `IT-318` continue the repository's sequence;
  `UT-124` and `IT-317` are the highest ids in use.
- **One case moves rather than being written twice.** `balancete-mensal` IT-314
  asserted the CSV export from the section. ADR-005 moves the export to the
  detail route, so **IT-314 moves with it** — its definition in that workflow's
  `_tests.md` is marked as relocated, and the behavior is re-asserted here as
  IT-345 against the new screen. The section gains IT-341 for the link that
  replaced the buttons.
- **What no case covers, deliberately.** Whether the printed page looks right —
  `jsdom` computes no layout. The marker classes the CSS keys on are asserted
  (IT-344); the visual check stays a human step, as `balancete-mensal` task_05
  already records.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| ADR-001 | the route exists, guarded, outside the menu | — | IT-342, IT-346 | — |
| ADR-001 | an open month is served by the same screen | — | IT-326, IT-338 | — |
| ADR-002 | the movements are frozen, not recomputed | — | IT-324, IT-325 | — |
| ADR-002 | the frozen row keeps name and counterpart | UT-125, UT-128 | IT-319 | — |
| ADR-002 | null category is a line, not a discard | UT-126, UT-127 | — | — |
| ADR-003 | closing writes atomically | — | IT-318, IT-322 | — |
| ADR-003 | a re-close replaces, never duplicates | — | IT-320, IT-321 | — |
| ADR-003 | reopen keeps the stored movements | — | IT-323 | — |
| ADR-004 | the whole month arrives, unpaginated | — | IT-329, IT-337 | — |
| ADR-005 | export and print live on the route | UT-131–UT-134 | IT-344, IT-345 | — |
| ADR-005 | the section links instead of exporting | — | IT-341 | — |
| `StatementEntry` assembly | one raw row becomes one entry | UT-125–UT-128 | — | — |
| ordering | total order, stable across reads | UT-129, UT-130 | IT-329 | — |
| `GET /entries` | success shape and each documented failure | — | IT-324, IT-328, IT-330–IT-333 | — |
| `frozen` flag | tells a pre-feature document from an empty month | — | IT-334, IT-340 | — |
| consistency | the list sums to the summary | — | IT-327 | — |
| `BalancetePage` | states, filter, paging, not-found | — | IT-335–IT-337, IT-339, IT-343 | — |

## Unit Tests

### `toStatementEntry` (TechSpec: Core Interfaces; ADR-002)

- **UT-125** (happy): a raw income row — payment joined to its charge and unit —
  produces `kind: 'INCOME'`, `counterpart` equal to the unit number, `categoryName`
  resolved from the map, and `amount` as a number.
- **UT-126** (boundary): a row whose `categoryId` is null — `categoryName` is
  `Sem categoria` and `categoryId` stays null; nothing is dropped.
- **UT-127** (error): a row whose `categoryId` matches no known category —
  `categoryName` is `Categoria removida`, and the id is preserved.
- **UT-128** (boundary): an expense row with no service provider — `counterpart`
  is null and `kind` is `'EXPENSE'`; the entry is still complete.

### Ordering (TechSpec: Core Interfaces)

- **UT-129** (ordering): three entries with different dates — sorted ascending by
  `occurredAt`, regardless of the order they arrived in.
- **UT-130** (ordering): two entries with the same `occurredAt` and the same
  `amount` — ordered by `sourceId`, so two reads of the same closed month return
  the same sequence.

### `buildClosingCsv` with movements (ADR-005)

- **UT-131** (happy): a statement plus three movements — the file carries the
  summary block first, then a header naming the movements, then one row per
  movement with date, section, category, description, counterpart and value.
- **UT-132** (boundary): called with the statement alone, no movements — produces
  exactly the file the previous workflow produced; the second argument is
  optional and its absence is a valid export.
- **UT-133** (boundary): a movement described as `Taxa; extra` — the field is
  quoted, and the row keeps its column count.
- **UT-134** (state): income and expense movements carry distinct section labels,
  so a reader sorting the spreadsheet by that column separates the two sides.

## Integration Tests

### Closing writes the movements (ADR-003)

- **IT-318**: a month with two payments and one paid expense, closed — the
  closing has exactly three `financial_closing_entries` rows, two `INCOME` and one
  `EXPENSE`, and their amounts sum to the closing's `total_income` and
  `total_expense` respectively.
- **IT-319**: the income row carries the unit number of the charge it came from,
  and the expense row carries the service provider's name.
- **IT-320**: closing, reopening and closing again — the month still has exactly
  three movement rows, not six.
- **IT-321**: after a reopen, a payment is registered inside the month and the
  month is closed again — the movements now number four, and the new payment is
  among them.
- **IT-322** (atomicity): forcing the entry insert to fail — neither the movements
  nor the `financial_closings` row exist afterwards, and the month reads as open.
- **IT-323**: reopening a closed month — the stored movements are still in the
  table; reopening records the reopen and destroys nothing.

### Reading the movements (`GET /financial/closings/:mes/entries`)

- **IT-324**: a closed month — the response carries `frozen: true` and the rows
  that were stored, in order.
- **IT-325** (canary): after closing, a payment dated inside the month is inserted
  straight through `paymentRepository` — the entries response is unchanged. The
  list is as frozen as the total above it.
- **IT-326**: an open month — `frozen: false`, and a payment registered a moment
  earlier is present.
- **IT-327**: an open month — the sum of the `INCOME` entries equals
  `totalIncome` of `GET /financial/closings/:mes`, and the same for the expense
  side. The two endpoints describe one month.
- **IT-328**: a month with no movement — `200` with `entries: []` and
  `frozen: false`; not a 404.
- **IT-329**: a month with movements on three different days — the entries come
  ordered by date ascending.
- **IT-330**: `GET /financial/closings/2026-13/entries` — 422, `error.code` set.
- **IT-331**: the same route without `condominiumId` — 422.
- **IT-332**: a síndico asking for a condominium outside their scope — 403.
- **IT-333**: a role holding `charge:read` but not `financial-closing:read` — 403.
- **IT-334**: a closing row written without movements (the state of any document
  closed before this feature), with `total_income` above zero — the response is
  `frozen: true` with `entries: []`, which is what lets the screen tell it from a
  month that had no movement.

### The screen (ADR-001, ADR-004)

- **IT-335**: rendering `/financeiro/balancete/2026-08` — the summary appears
  above and the movements table below, with one row per movement.
- **IT-336**: choosing a category in the filter — only that category's movements
  remain, and clearing it brings the rest back.
- **IT-337**: a month with more movements than one page — the table pages on the
  client, and page two shows the remainder **without a second request**.
- **IT-338**: an open month — the screen says so, and offers no claim of being a
  closed document.
- **IT-339**: a closed month — the closed badge and the closing date appear, and
  the movements shown are the ones the response marked `frozen`.
- **IT-340**: `frozen: true` with `entries: []` and totals above zero — the screen
  says the document predates the recording of movements, and does **not** render
  an empty table that would read as "a month with no movement".
- **IT-341**: the section in `/financeiro` — offers a link to the full document
  and no longer offers `Exportar CSV`.
- **IT-342**: a reader without `financial-closing:read` — the route renders the
  forbidden state.
- **IT-343**: a malformed month in the URL — the route renders the not-found
  state with a link back to `/financeiro`, as the condominium detail route does.
- **IT-344**: the route's root carries `print-document` and its control cluster
  carries `print-hide` — the structure the print sheet keys on.
- **IT-345** (relocated from `balancete-mensal` IT-314): exporting from the route —
  `URL.createObjectURL` receives a `Blob`, the anchor is clicked once, no request
  is made, and the file contains the movements.
- **IT-346**: rendering the route through the real `AppRouter` — the screen
  appears, and the sidebar contains no link to it.
