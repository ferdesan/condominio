# Test Specification: Votações em Assembleias

Canonical test contract for resident voting and manual unit vote registration.
Companion to [`_techspec.md`](_techspec.md).
Derived from [`_user_stories.md`](_user_stories.md) (behavior) and the TechSpec
components.

## Strategy

- **Frameworks and harnesses.** Backend: Jest + `ts-jest`, `testEnvironment:
  node`, `--runInBand`, 30 s timeout; `supertest` against the real app from
  `createApp()`. **No fake at any boundary** — in-memory sql.js, real services,
  real repositories, schema from `synchronize: true`. Harness:
  `setupTestContext`, `login`, `seedUsers`, `teardownTestContext`
  (`tests/helpers/test-context.ts`). Frontend: Vitest + Testing Library,
  `renderWithProviders` (`src/test/render.tsx`), `@/lib/api` doubled at the
  transport seam only (ADR-010), through `serveAssemblies` and friends in
  `features/assemblies/test-utils.ts`.
- **Execution.** `npm --prefix backend run test` and `npm --prefix frontend run
  test`. No MySQL, no Redis, no Docker, no network. Gate commands:
  backend `npm run typecheck && npm run lint && npm test`; frontend
  `npm run typecheck && npm run lint && npm test`.
- **Conventions.** Case names in Portuguese, third person, no accents, no
  "should" / "deve"; each name prefixed with its id. `expect(response.status)`
  first on HTTP cases; assert `error.code` / message matchers on failures.
  Frontend uses `screen.findBy*` / `getByRole` with accessible names.
- **State model.** Seed runs once per file; no `beforeEach` reset. Cases share
  rows; new poll flows that must not collide with the closed main poll use a
  **second poll** created inside the case (or run while the main poll is still
  OPEN). Order-dependent file stays `--runInBand` friendly.
- **Numbering.** Continues the repository sequence: highest ids in use are
  **UT-134** (`closing-csv.test.ts`) and **IT-346** (`routes.test.tsx` /
  balancete-detalhe). This contract starts at **UT-135** and **IT-347**.
  Shared single sequences across backend and frontend (repo convention).
- **E2E.** No browser harness exists (PRD Non-Goals; ADR of prior work).
  Journeys are covered start-to-finish by backend HTTP integration + frontend
  page tests through the public surface. E2E column is `—` throughout; that is
  the annotation, not a hole.
- **Migration.** `1758100000000-VoteRegisteredBy` is never loaded in the suite
  (tests use synchronize). Verification is manual `npm run migration:run` on
  MySQL — a task acceptance step, not a test id.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001 | deep-link vote page: open poll context + submit | — | IT-347 | — |
| US-001.AC-3 | no vote:create / no unit → forbidden state | — | IT-349 | — |
| US-001.EC-1 | poll id unknown → not-found + back to assembleias | — | IT-350 | — |
| US-001.EC-2 | DRAFT/CLOSED → not open, no submit | — | IT-351 | — |
| US-001.EC-3 | outside startsAt/endsAt → not-open message | — | IT-352 | — |
| US-001.EC-4 | session expired mid-flow → auth redirect | — | IT-353 | — |
| US-001.EC-5 | unit already voted → already-voted state | — | IT-354 | — |
| US-001.EC-6 | OWNERS and not owner → forbidden readable reason | — | IT-355 | — |
| US-001.EC-7 | double submit → conflict handled as already voted | — | IT-356 | — |
| US-001.EC-8 | mobile viewport → controls reachable (jsdom layout proxy: submit control present in votable state) | — | IT-357 | — |
| US-002 | Votar from Deliberações reaches vote route | — | IT-358 | — |
| US-002.EC-1 | poll not OPEN → no enabled Votar | — | IT-359 | — |
| US-002.EC-2 | without vote:create → Votar hidden | — | IT-360 | — |
| US-002.EC-3 | vote completed elsewhere → dialog reopen shows fresh status/actions | — | IT-361 | — |
| US-003 | confirmation "Voto registrado" after success | — | IT-362 | — |
| US-003.AC-2 | results (participation/quorum/options) after vote when poll:read | — | IT-363 | — |
| US-003.AC-3 | secret poll confirmation does not require showing choice | — | IT-364 | — |
| US-003.EC-1 | results fetch fails → confirmation remains; results error | — | IT-365 | — |
| US-003.EC-2 | poll closes while viewing → refetch shows CLOSED results | — | IT-366 | — |
| US-003.EC-3 | cannot read results → confirmation only, no results block | — | IT-367 | — |
| US-004 | return visit already-voted | — | IT-354, IT-368 | — |
| US-004.AC-2 | non-secret + vote:read → my-vote exposes optionId | — | IT-369 | — |
| US-004.AC-3 | secret my-vote → voted flag only | — | IT-370 | — |
| US-004.EC-1 | my-vote says not voted but POST 409 → treat as already voted | — | IT-371 | — |
| US-004.EC-2 | poll gone after vote → not-found, no crash | — | IT-372 | — |
| US-005 | manager sees status list and registers pending unit | — | IT-373, IT-374 | — |
| US-005.AC-3 | unit already voted → conflict, list stays accurate | — | IT-375 | — |
| US-005.AC-4 | no vote:manage → action hidden + backend 403 | — | IT-376, IT-377 | — |
| US-005.EC-1 | poll not OPEN → management disabled / clear message | — | IT-378 | — |
| US-005.EC-2 | unit not eligible → NOT_ELIGIBLE; client blocks; server 403 | — | IT-379, IT-380 | — |
| US-005.EC-3 | empty/invalid option → submit disabled or validation | — | IT-381 | — |
| US-005.EC-4 | concurrent proxy same unit → one 200, one 409 | — | IT-382 | — |
| US-005.EC-5 | large list → status filter remains usable | — | IT-383 | — |
| US-005.EC-6 | resident already voted → Already voted without option | — | IT-384 | — |
| US-006 | secret: option never in new surfaces | — | IT-370, IT-385, IT-386 | — |
| US-006.EC-1 | manager opens management on secret → status only | — | IT-385 | — |
| US-006.EC-2 | non-secret may store identity (ADR-002) | — | IT-387 | — |
| US-007 | notification actionUrl resolves to /votacoes/:id | UT-135, UT-136 | IT-388 | — |
| US-007.EC-1 | not logged in → login then return when auth allows | — | IT-389 | — |
| US-007.EC-2 | poll closed by click time → US-001 closed state | — | IT-390 | — |
| US-007.EC-3 | unknown/other-tenant poll → not-found/forbidden, no leak | — | IT-350, IT-377 | — |
| ADR-001 | route registered, guarded vote:read, outside menu | UT-137 | IT-391, IT-392 | — |
| ADR-002 | open proxy stores identity; secret forces null | — | IT-387, IT-386 | — |
| ADR-003 | status list shape VOTED/PENDING/NOT_ELIGIBLE, no option field | — | IT-373, IT-384, IT-385 | — |
| ADR-004 | post-vote confirmation then results panel | — | IT-362, IT-363 | — |
| ADR-005 | GET /vote-status contract + failures | — | IT-373, IT-377, IT-393, IT-394 | — |
| ADR-006 | DETAIL_PREFIXES returns full path; walk unchanged otherwise | UT-135, UT-136, UT-138, UT-139 | IT-388 | — |
| ADR-007 | proxy OWNERS eligibility 403; ALL_RESIDENTS allowed | — | IT-380, IT-395 | — |
| Fase1 cleanup | typecheck clean (TS6133); no void residue | — | IT-396 (typecheck gate in task, not a runtime case — see note) | — |
| `persistVote` / identity helpers | non-secret proxy identity from resident; secret null | UT-140 | IT-387 | — |
| `assembly-hooks` new hooks | keys, endpoints, invalidation | UT-141–UT-144 | — | — |
| `assembly-labels` | status + confirmation labels unique | UT-145 | — | — |
| VotePage states | loading / not-found / forbidden / not-open / votable / voted | — | IT-347, IT-350, IT-349, IT-351, IT-354 | — |
| PollProxyVotesDialog | list, filter, register, errors | — | IT-373–IT-383 | — |
| assembly-polls-dialog actions | Votar + Gestão gates | — | IT-358–IT-361, IT-376 | — |
| Permission matrix | vote:create/read/manage vs routes | UT-137 | IT-349, IT-377, IT-391, IT-392 | — |

**Fase1 cleanup note:** `typecheck` is a command gate on task_01, not a
runtime test id. IT-396 is reserved for the integration assertion that proxy
vote still succeeds after the cleanup refactor (guards against behavioral
regression while fixing TS6133).

## Unit Tests

### `resolveActionUrl` DETAIL_PREFIXES (TechSpec: Core Interfaces — notification resolution)

- **UT-135** (happy): `resolveActionUrl('/votacoes/poll-abc')` — returns
  `'/votacoes/poll-abc'` unchanged (full path, not truncated to `/votacoes`).
- **UT-136** (happy): `resolveActionUrl('/votacoes/poll-abc?from=push')` —
  strips query first, returns `'/votacoes/poll-abc'`.
- **UT-138** (boundary): `resolveActionUrl('/votacoes')` — no id segment —
  returns `null` (prefix alone is not a navigable destination).
- **UT-139** (error): `resolveActionUrl('/reservas/res-1')` — not in
  DETAIL_PREFIXES — still walks up and returns `'/reservas'` when that module
  is in KNOWN_PATHS (existing fallback preserved).

### Route registration / guards (TechSpec: Route Permission Matrix)

- **UT-137** (state): route table inspection or render helper — `/votacoes/:pollId`
  is absent from `NAV_ITEMS` and from `IMPLEMENTED`, and its guard is
  `vote:read` (assert via `renderWithProviders({ permissions: ['assembly:read'] })`
  → "Acesso negado" on the vote route, or equivalent pure assertion if the
  router exports the guard list).

### Hook construction (TechSpec: Core Interfaces — frontend hooks)

- **UT-141** (happy): `useMyVote('poll-1')` — issues `GET /polls/poll-1/my-vote`
  with query key `['polls', 'my-vote', 'poll-1']`, disabled when id empty.
- **UT-142** (happy): `useCastVote('poll-1')` — `POST /polls/poll-1/vote` with
  `{ optionId }`, invalidates `['polls']` on success.
- **UT-143** (happy): `useVoteStatus('poll-1')` — `GET /polls/poll-1/vote-status`,
  key `['polls', 'vote-status', 'poll-1']`.
- **UT-144** (happy): `useCastProxyVote('poll-1')` — `POST /polls/poll-1/votes`
  with `{ unitId, optionId }`, invalidates `['polls']`.

### Labels (TechSpec: assembly-labels)

- **UT-145** (boundary): `UNIT_VOTE_STATUS_LABELS` + confirmation copy — every
  `UnitVoteStatusValue` has a label; labels do not collide with existing
  column/filter label vocabulary used in assemblies tests (assert distinct
  from `POLL_STATUS_LABELS` values and from "Situação" filter headers where
  applicable).

### Proxy identity helper (TechSpec: Fase 1 — ADR-002)

- **UT-140** (happy): identity selection for non-secret proxy — given a unit
  with primary ACTIVE resident `{ userId, name }`, the helper returns those
  fields; given secret poll, returns `{ voterId: null, voterName: null }`;
  given no resident, returns nulls (registeredByUserId still set by caller).

## Integration Tests

### VotePage — deep link and states (US-001, ADR-001)

- **IT-347**: VotePage on an OPEN poll with `vote:create` — serves poll +
  my-vote `{ voted: false }`; shows title, options, submit; selecting an option
  and submitting POSTs `/polls/:id/vote` and enters confirmation.
- **IT-349**: without `vote:read` on the route (permissions without
  `vote:read`) — route renders "Acesso negado", not the vote form.
- **IT-350**: `GET /polls/:id` returns 404 — page shows not-found state with
  link back to `/assembleias`.
- **IT-351**: poll `status: 'CLOSED'` (or DRAFT) — not-open message, no submit
  control.
- **IT-352**: poll OPEN but `endsAt` in the past — not-open/window message,
  no submit.
- **IT-353**: API returns 401 on boot reads — auth handling redirects toward
  login (assert redirect or session-expired path per existing harness).
- **IT-354**: `my-vote` returns `{ voted: true }` — already-voted state; no
  second submit control; results block when `poll:read`.
- **IT-355**: poll `voterType: 'OWNERS'` and backend rejects vote with 403
  proprietários — page shows readable forbidden reason (or route-level forbidden
  when pre-checked), not a broken form.
- **IT-356**: first POST succeeds, immediate second POST returns 409 — UI
  treats as already voted/conflict, does not duplicate; stays on confirmation.
- **IT-357**: votable state — submit control is a `button` with accessible
  name (reachable control proxy for mobile; full viewport is manual).
- **IT-368**: return visit with my-vote voted + non-secret optionId —
  already-voted reflects chosen option when API provides it (AC-2 of US-004).

### VotePage — confirmation and results (US-003, ADR-004)

- **IT-362**: successful vote — confirmation copy "Voto registrado" (or
  equivalent from labels) visible after response.
- **IT-363**: confirmation + `poll:read` — results region shows participation,
  quorum, per-option bars (reuses `PollResultsPanel` / results transport).
- **IT-364**: secret poll after vote — confirmation shown; no UI path requires
  displaying the chosen option to others; aggregate results only.
- **IT-365**: vote succeeds, `GET results` fails — confirmation remains;
  results area shows error/retry, confirmation not undone.
- **IT-366**: results refetched after status becomes CLOSED — CLOSED results
  rendered (world mutated between reads).
- **IT-367**: permissions without `poll:read` after vote — confirmation only;
  no results block; no error spam.

### my-vote contract (US-004, ADR-002)

- **IT-369**: non-secret poll after vote — `GET /polls/:id/my-vote` returns
  `{ voted: true, optionId, votedAt }`.
- **IT-370**: secret poll after vote — `my-vote` returns `{ voted: true }`
  with **no** `optionId` / `votedAt` leak (or undefined).
- **IT-371**: force `my-vote` to `{ voted: false }` while POST returns 409 —
  UI converges to already-voted (trust server conflict).
- **IT-372**: after vote, poll detail returns 404 — not-found state, no crash.

### Deliberações entry (US-002)

- **IT-358**: OPEN poll + `vote:create` — **Votar** present; click navigates
  to `/votacoes/{pollId}` (MemoryRouter location assert).
- **IT-359**: poll DRAFT/CLOSED — no enabled Votar (absent or disabled with
  reason consistent with closed state).
- **IT-360**: permissions without `vote:create` — Votar not rendered.
- **IT-361**: dialog closed and reopened after external vote — actions/status
  reflect fresh data (list refetch on mount).

### Manager status list + registration (US-005, ADR-003, ADR-005, ADR-007)

- **IT-373**: `vote:manage` + OPEN poll — open Gestão dialog; `GET
  /polls/:id/vote-status` called; rows show unit number and status labels
  without any option field in the payload/UI.
- **IT-374**: pending eligible row + selected option — POST `/polls/:id/votes`
  200; row becomes Already voted after refetch; results totals increment.
- **IT-375**: unit already voted — second POST returns 409; conflict message;
  list still shows Already voted.
- **IT-376**: permissions without `vote:manage` — Gestão action hidden in
  Deliberações.
- **IT-377**: `GET /vote-status` and `POST /votes` without `vote:manage` (API
  with insufficient token) — 403.
- **IT-378**: poll not OPEN — dialog disabled or clear message; submit not
  available (or server 409 surfaced without corrupting list).
- **IT-379**: status shows NOT_ELIGIBLE for OWNERS unit without owner — submit
  control blocked client-side for that row.
- **IT-380**: `POST /votes` for OWNERS unit without active OWNER — 403
  (ADR-007); message about proprietários/elegibilidade.
- **IT-381**: no option selected (empty `optionId`) — submit disabled or 422
  validation; no partial write.
- **IT-382**: two sequential proxy submits for same unit — first 200, second
  409; list reconciles on refresh.
- **IT-383**: fixture with many units — status filter (Pendente/Todas) reduces
  rendered rows without refetch error.
- **IT-384**: unit where resident already voted in app — status VOTED /
  Already voted; response contains no `optionId` for that unit.
- **IT-395**: `voterType: 'ALL_RESIDENTS'` — proxy for unit without OWNER
  resident succeeds 200 (eligibility only bites OWNERS).

### vote-status endpoint contract (ADR-005)

- **IT-393**: happy path — 200; array covers all condominium units; each row
  `{ unitId, unitNumber, status }`; statuses only in
  `VOTED|PENDING|NOT_ELIGIBLE`; no `optionId`/`voterId` keys.
- **IT-394**: unknown poll id / malformed id — 404 or 422 as per `idParamSchema`
  + `findById`.
- **IT-385**: secret poll — `vote-status` 200 (unlike `GET /votes` which is
  403); still status-only (US-006 EC-1).
- **IT-386**: `GET /polls/:id/votes` on secret poll remains 403; vote-status
  is the only list surface (privacy invariant).

### Identity storage (ADR-002, US-006 EC-2)

- **IT-387**: non-secret proxy vote — stored vote has `registeredByUserId` =
  manager and `voterId`/`voterName` from unit resident when known (or null if
  none); secret proxy — `voterId` and `voterName` null in DB.

### Backend regression after Fase 1 cleanup

- **IT-396**: resident self-vote + proxy vote + results after refactor —
  same status codes and counters as before cleanup (guards TS6133 / void
  removal).

### Notification deep link (US-007, ADR-006)

- **IT-388**: notification with `actionUrl: /votacoes/{id}` — row offers link
  with `href` exactly `/votacoes/{id}` (not `/votacoes`, not null).
- **IT-389**: unauthenticated click → login flow; after login return to vote
  route when `state.from` preserved (align with existing ProtectedRoute
  behavior; if harness cannot complete full auth round-trip, assert redirect
  target contains `/votacoes/`).
- **IT-390**: link to poll that is CLOSED by click time — lands on VotePage
  closed state (US-001 EC-2), not a crash.

### Route registration (ADR-001)

- **IT-391**: `AppRouter` renders `/votacoes/{id}` for user with `vote:read` —
  VotePage (or its loading/not-found shell), not placeholder; route absent from
  sidebar `NAV_ITEMS`.
- **IT-392**: user with `assembly:read` only — `/votacoes/{id}` renders
  "Acesso negado" (guard is `vote:read`, not inherited `assembly:read`).

### Optional pure-backend eligibility matrix

- **IT-397** (if not covered by IT-380/IT-395): OWNERS poll + unit with only
  TENANT/OCCUPANT active residents — `vote-status` marks NOT_ELIGIBLE and
  proxy POST 403; flipping resident to OWNER makes unit PENDING and proxy 200.

---

### Case index (quick)

| Band | IDs | Home |
|---|---|---|
| UT-135–UT-140 | resolveActionUrl, route purity, identity helper | frontend unit / pure |
| UT-141–UT-145 | hooks + labels | frontend unit |
| IT-347–IT-367 | VotePage + confirmation/results + my-vote + Deliberações | frontend page tests + backend my-vote |
| IT-368–IT-372 | return visit / conflict / missing poll | frontend + backend |
| IT-373–IT-385, IT-393–IT-395, IT-397 | proxy dialog + vote-status + eligibility | frontend dialog + backend |
| IT-386–IT-387 | secret privacy + identity storage | backend |
| IT-388–IT-392 | notification + route registration | frontend |
| IT-396 | post-cleanup proxy regression | backend |

IDs are permanent once tasks reference them: never renumber. Mark a dropped
case `(withdrawn)` in place.
