# TechSpec: Votações em Assembleias (Resident Vote + Manual Unit Registration)

Companion to [`_prd.md`](_prd.md) and [`_user_stories.md`](_user_stories.md).

## Executive Summary

Condominium polls already exist as a backend capability (`castVote`, `castVoteOnBehalf`, `myVote`, `results`, unique vote per unit). This feature finishes Fase 1 quality (typecheck-breaking unused parameter, inert identity ternary, residual `void` code), adds a secret-safe **vote-status read model** so síndicos can see which units voted without seeing choices (ADR-005), and ships the entire missing product layer: route `/votacoes/:pollId` (VotePage), notification deep-link resolution (ADR-006), a **Votar** entry from Deliberações, and the management dialog that registers proxy votes under `vote:manage`.

The principal trade-offs: status is a one-shot list with client-side filter (no server pagination until ~1k units); manager registration becomes stricter server-side on OWNERS polls (ADR-007); notification resolution gains a narrow `DETAIL_PREFIXES` exception instead of duplicating the router. No new roles, no new tables, no schema migration beyond the already-created `VoteRegisteredBy` (manual MySQL apply).

## System Architecture

### Component Overview

```text
backend/src/modules/assemblies/
  assembly.routes.ts                    MOD  + GET /:id/vote-status (vote:manage)
  services/poll.service.ts              MOD  Fase1 cleanup; voteStatus(); proxy eligibility;
                                                     shared eligibility + owner lookup helpers
  schemas/assembly.schema.ts            (no new body schemas — vote-status is params-only)
  entities/vote.entity.ts               (unchanged; registeredByUserId already migrated)

backend/src/database/migrations/
  1758100000000-VoteRegisteredBy.ts     EXISTS  manual MySQL apply (task acceptance)

frontend/src/
  types/assembly.ts                     MOD  + MyVote, UnitVoteStatus (+ status union)
  features/assemblies/
    assembly-hooks.ts                   MOD  + useCastVote, useMyVote, useCastProxyVote,
                                                     useVoteStatus (POLLS_KEY)
    assembly-labels.ts                  MOD  + UNIT_VOTE_STATUS_LABELS, confirmation copy
    vote-page.tsx                       NEW  VotePage at /votacoes/:pollId
    vote-page.test.tsx                  NEW
    components/poll-vote-dialog.tsx     NEW  (optional inline confirm if kept; primary UX is VotePage)
    components/poll-proxy-votes-dialog.tsx  NEW  manager status list + register form
    components/assembly-polls-dialog.tsx MOD  + Votar / Gestão actions
    test-utils.ts                       MOD  serve /polls/:id, /my-vote, /vote-status, POST vote
    assemblies-page.test.tsx            MOD  new dialog-entry cases
  features/notifications/
    notification-links.ts               MOD  DETAIL_PREFIXES + resolve /votacoes/:id
    notifications-page.test.tsx         MOD  deep-link case
  routes/app-router.tsx                 MOD  + /votacoes/:pollId guarded by vote:read
  test/routes.test.tsx                  MOD  dedicated case (balancete pattern) + AUXILIARY_READS
```

Data flow — resident vote:

```text
Notification / Deliberações ──▶ /votacoes/:pollId (VotePage)
                                      │
                    pollHooks.useOne + useMyVote + usePollResults
                                      │
              ┌───────────────────────┴──────────────────────┐
         not voted, OPEN, eligible                    already voted / closed
              │                                               │
     select option → useCastVote                      confirmation + PollResultsPanel
              │         POST /polls/:id/vote
              └──────────────▶ PollResults (+ invalidate POLLS_KEY)
```

Data flow — manager registration:

```text
Deliberações row ──can('vote:manage')──▶ PollProxyVotesDialog
                                              │
                         GET /polls/:id/vote-status   (vote:manage)
                                              │
                    rows: unitNumber × {VOTED|PENDING|NOT_ELIGIBLE}
                                              │
              pending row + optionId → useCastProxyVote
                                              │
                         POST /polls/:id/votes  { unitId, optionId }
                                              │
                    refetch vote-status + results (invalidate POLLS_KEY)
```

External systems: none beyond existing auth (`authorize`), notifications (`actionUrl` already emitted), realtime (`poll:updated` already emitted on vote).

## Implementation Design

### Core Interfaces

Backend service additions (`poll.service.ts`):

```ts
export type UnitVoteStatusValue = 'VOTED' | 'PENDING' | 'NOT_ELIGIBLE';

export type UnitVoteStatus = {
  unitId: string;
  unitNumber: string;
  status: UnitVoteStatusValue;
};

// GET /polls/:id/vote-status → 200 { success, data: UnitVoteStatus[] }
async voteStatus(ctx: RequestContext, pollId: string): Promise<UnitVoteStatus[]>;
```

Eligibility helper (shared by `castVoteOnBehalf` and `voteStatus`):

```ts
// unit eligible ⇔ ALL_RESIDENTS, or (OWNERS and ≥1 active OWNER on unit)
private async unitIsEligible(
  ctx: RequestContext,
  poll: Poll,
  unitId: string,
  ownerUnitIds: ReadonlySet<string>, // preloaded when OWNERS; ignored otherwise
): Promise<boolean>;
```

Existing contracts consumed by the UI (unchanged shapes):

```ts
// GET /polls/:id/my-vote → 200
type MyVote = { voted: boolean; optionId?: string; votedAt?: string };
// secret: always { voted: true } with no optionId (ADR-002 / US-006)

// POST /polls/:id/vote | POST /polls/:id/votes → 200 PollResults (ok() wrapper — not 201)
// body: CastVoteDTO { optionId } | CastProxyVoteDTO { unitId, optionId }
```

Frontend hooks (`assembly-hooks.ts`), all under `POLLS_KEY`:

```ts
useMyVote(pollId): Query → GET /polls/:id/my-vote
  queryKey: [POLLS_KEY, 'my-vote', pollId]; enabled: Boolean(pollId)

useCastVote(pollId): Mutation { optionId } → PollResults
  POST /polls/:id/vote; invalidate [POLLS_KEY] (results, my-vote, list)

useVoteStatus(pollId): Query → UnitVoteStatus[]
  queryKey: [POLLS_KEY, 'vote-status', pollId]; enabled: Boolean(pollId)

useCastProxyVote(pollId): Mutation { unitId, optionId } → PollResults
  POST /polls/:id/votes; invalidate [POLLS_KEY]
```

Notification resolution (`notification-links.ts`):

```ts
const DETAIL_PREFIXES = ['/votacoes'];
// path === prefix || path.startsWith(prefix + '/') AND ≥2 segments → return full path
// else existing upward walk over KNOWN_PATHS
```

### Data Models

No new tables. Derived read model only.

| Type | Fields | Source |
|---|---|---|
| `UnitVoteStatus` | `unitId`, `unitNumber`, `status` | `units.listByCondominium` × `polls.listVotes` × owners set |
| `MyVote` | `voted`, `optionId?`, `votedAt?` | existing `myVote` |
| `Vote` (entity) | unchanged | `vote.entity.ts` + `registered_by_user_id` migration |

Status derivation (exact order):

1. Vote row exists for `(poll, unit)` → `VOTED`
2. Else if `voterType === 'OWNERS'` and unit has no active OWNER resident → `NOT_ELIGIBLE`
3. Else → `PENDING`

### API Endpoints

| Method | Path | Permission | Request | Success | Failures |
|---|---|---|---|---|---|
| GET | `/polls/:id/vote-status` | `vote:manage` | params `id` uuid | 200 `UnitVoteStatus[]` | 403 no perm; 404 poll; 422 bad id |
| POST | `/polls/:id/vote` | `vote:create` | `{ optionId }` | 200 `PollResults` | 403 no unit / wrong condo / not owner; 409 not open / window / already voted; 404 option |
| GET | `/polls/:id/my-vote` | `vote:read` | — | 200 `MyVote` | 403; 404 |
| POST | `/polls/:id/votes` | `vote:manage` | `{ unitId, optionId }` | 200 `PollResults` | 403 wrong condo / **not eligible (new)**; 409 closed/duplicate; 404 option/poll |
| GET | `/polls/:id/results` | `poll:read` | — | 200 `PollResults` | 403; 404 |

Notes:

- All handlers use shared `handle` → `ok()` → **200** (not 201). Tests assert 200.
- `vote-status` is registered inside `pollRouter` `extend` beside the other `/:id/*` literals.
- Secret polls: `listVotes` still 403; `vote-status` intentionally works and never returns `optionId`/`voterId`.
- Fase 1 fixes in `castVoteOnBehalf` / `persistVote`:
  - Remove unused `unit` parameter and `void unitId; void _` (fixes TS6133 at ~line 256).
  - Non-secret proxy: `voterId`/`voterName` from the unit's active resident when known (prefer `isPrimary`), else null; secret forces null (ADR-002).

### Route / Permission Matrix (frontend)

| Surface | Guard | In-component gates |
|---|---|---|
| `/votacoes/:pollId` | `ProtectedRoute permission="vote:read"` | `can('vote:create')` to submit; `can('poll:read')` to show results |
| Deliberações **Votar** | parent `assembly:read` | `can('vote:create')` (show); server decides OPEN/window |
| Deliberações **Gestão** | parent `assembly:read` | `can('vote:manage')` |
| VotePage not in `NAV_ITEMS` / `IMPLEMENTED` | — | balancete precedent (`app-router.tsx` non-menu detail route) |

## Integration Points

| System | Purpose | Auth | Errors |
|---|---|---|---|
| Existing auth middleware | `authorize('vote:*')` / `poll:read` | Bearer | 403 `ForbiddenError` + audit `PERMISSION_DENIED` |
| Notification service | already writes `actionUrl: /votacoes/${id}` on open | n/a | notify never breaks `open()` |
| Realtime | `poll:updated` after vote/close | n/a | emit best-effort |
| React Query cache | invalidation via `POLLS_KEY` | session | mutation `onError` row/dialog level |

No new external services. No role/permission edits.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `poll.service.ts` | modified | Fase1 cleanup + `voteStatus` + proxy eligibility — **low risk**, fixes broken typecheck | Implement helpers; keep message style (no accents in backend messages) |
| `assembly.routes.ts` | modified | one new GET route — low | register in `extend` |
| `VoteRegisteredBy` migration | exists | manual MySQL — env-only | run `migration:run` on deploy; tests use synchronize |
| `types/assembly.ts` | modified | additive types | add `MyVote`, `UnitVoteStatus` |
| `assembly-hooks.ts` | modified | four new hooks | follow `useOpenPoll` / `usePollResults` patterns |
| `assembly-labels.ts` | modified | status + confirmation labels | no collision with column/filter labels (doc constraint) |
| `vote-page.tsx` | new | primary UX surface | states: loading / not-found / forbidden / not-open / votable / voted |
| `poll-proxy-votes-dialog.tsx` | new | manager list + submit | status filter; never render option |
| `assembly-polls-dialog.tsx` | modified | two action buttons | gate by permission, not status (existing doc) |
| `notification-links.ts` | modified | DETAIL_PREFIXES exception | update module doc; unit tests |
| `app-router.tsx` | modified | new route | not in `IMPLEMENTED`/`NAV_ITEMS` |
| `test-utils.ts` / page tests | modified | transport must serve new URLs or tests throw | extend `serveAssemblies` |
| Integration suite `assemblies.spec.ts` | modified | order-dependent file; new cases after existing flow or isolated poll | keep `--runInBand` friendly |
| Roles / permissions | none | — | — |

## Testing Approach

Strategy only — concrete cases live in [`_tests.md`](_tests.md).

- **Frameworks.** Backend: Jest + supertest + real app (`setupTestContext` / `login` / `seedUsers`), in-memory sqljs, `synchronize` schema, `--runInBand`. Frontend: Vitest + Testing Library, `renderWithProviders`, transport mock of `@/lib/api` only (ADR-010), fixtures in feature `test-utils.ts`.
- **Unit.** Pure logic: `resolveActionUrl` DETAIL_PREFIXES branches; status label maps; any pure derivation helpers on VotePage (e.g. page-state selector from `MyVote` + poll status + permissions). Fake only I/O boundaries.
- **Integration.** Backend: full HTTP for proxy vote, eligibility 403, `my-vote` secret/open, `vote-status` shapes and 403/404. Frontend: component/page tests through mocked transport ( VotePage journeys, proxy dialog, Votar navigation, route guard, notification link).
- **E2E.** Repo has no browser harness (ADR-001 of prior work / PRD Non-Goals). Journeys are covered start-to-finish by backend integration + frontend page tests acting through the public surface. Matrix E2E column is `—` with that annotation.
- **Environment.** No MySQL/Redis/Docker/network. Migration correctness is a manual task acceptance step, never a suite case.

## Development Sequencing

### Build Order

1. **Backend Fase 1 cleanup** — remove TS6133 / `void` residue; fix non-secret proxy identity (ADR-002); no behavior change for secret. Gate: `npm run typecheck && npm run lint && npm test` green baseline.
2. **Eligibility helper + proxy 403** — shared owner set; `castVoteOnBehalf` rejects ineligible units (ADR-007).
3. **`voteStatus` + route** — `GET /polls/:id/vote-status` (ADR-005); swagger entry.
4. **Backend integration tests** — proxy, my-vote, vote-status, eligibility, secret privacy (extend `assemblies.spec.ts` or sibling file).
5. **Frontend types + hooks + labels** — `MyVote`, `UnitVoteStatus`, four hooks, labels.
6. **Notification DETAIL_PREFIXES** — unit tests for resolve (ADR-006).
7. **VotePage + route registration** — `/votacoes/:pollId`, states per US-001/003/004/006; wire `PollResultsPanel`.
8. **Deliberações actions** — Votar (navigate) + Gestão (open proxy dialog) in `assembly-polls-dialog`.
9. **PollProxyVotesDialog** — status list, filter, per-row register form (US-005).
10. **Frontend tests + AUXILIARY_READS / serveAssemblies** — page, dialog, routes, notifications.
11. **Full gates** — backend `typecheck && lint && test`; frontend `typecheck && lint && test`.

### Technical Dependencies

- Migration `1758100000000-VoteRegisteredBy` must be applied on MySQL environments before proxy votes in production (already written; manual run).
- Seed must keep `morador` with `unitId` + OWNER resident (tests rely on it).
- No blocking team deliverables; no new packages.

## Monitoring and Observability

- **Metrics:** none new — vote counts already flow through `Poll.totalVotes` / option counters; status endpoint is read-only.
- **Logs / audit:** proxy and resident votes already `audit.record` (`resource: 'vote'`). Keep secret path anonymous (`auditActor: null`) per ADR-002. Permission denials continue through `authorize` audit.
- **Alerting:** not applicable for this feature slice.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-offs | Rejected |
|---|---|---|---|
| Dedicated `vote-status` endpoint (ADR-005) | secret-safe; computes eligibility + never-voted units in one read | one more route | redacted `/votes`; client-side join |
| `DETAIL_PREFIXES` for notification deep links (ADR-006) | keeps `/votacoes/:id` without a second router | one-line maintenance per new detail family | raw-path-if-module-known; `/votacoes` only (drops id); full pattern list |
| Server enforces OWNER on proxy (ADR-007) | server is authority; matches status list | one resident query on OWNERS proxy | client-only block |
| Route guard `vote:read` | matches `my-vote` backend; residents have it; `manage` implies read | managers reach VotePage too (harmless) | `assembly:read` (too broad); no guard |
| Status list client-side filter | hundreds of rows are tiny; no pagination protocol | revisit above ~1k units | server pagination now |
| VotePage as page file in `features/assemblies` | deep link needs a route; same feature owns polls | not a dialog (intentional ADR-001 exception) | vote-only nested dialog |
| Responses stay 200 via `ok()` | existing envelope; changing to 201 would churn every consumer | plan text said 201 — tests follow **code** (200) | switch to 201 |

### Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `eligibleUnits` snapshot includes non-owner units on OWNERS polls → inflated participation denominator | medium (pre-existing) | out of scope (PRD non-goal to change quorum rules); do not "fix" silently |
| `myVote` loads all poll votes in memory | low for typical polls | accept for now; optimize with `hasVoted`+single row only if profiling demands |
| Order-dependent `assemblies.spec.ts` shared `pollId` | medium | new cases use a **second poll** or run before close; keep `--runInBand` |
| Frontend tests throw on unknown transport URLs | high if forgotten | extend `serveAssemblies` / `AUXILIARY_READS` in the same task as the UI |
| Proxy eligibility false-negative if OWNER resident inactive | low | definition = ACTIVE OWNER only; status uses same rule |
| Two managers concurrent proxy submit | low | unique index → 409; UI shows conflict and refetches (US-005 EC-4) |

## Architecture Decision Records

- [ADR-001: Deep-link vote route as primary vote UX](adrs/adr-001.md) — `/votacoes/:pollId` is canonical; Deliberações links to it.
- [ADR-002: Record voter identity only on non-secret polls](adrs/adr-002.md) — open polls store `voterId`/`voterName`; secret forces null.
- [ADR-003: Manual vote registration is per unit, with a status list](adrs/adr-003.md) — status only, no option leak; `vote:manage`.
- [ADR-004: After voting, show confirmation then results](adrs/adr-004.md) — confirmation always; results when readable.
- [ADR-005: Dedicated vote-status summary endpoint](adrs/adr-005.md) — secret-safe unit status read model under `vote:manage`.
- [ADR-006: DETAIL_PREFIXES preserves deep-link paths](adrs/adr-006.md) — notification resolver returns full `/votacoes/:id`.
- [ADR-007: Server enforces OWNER eligibility on manager registration](adrs/adr-007.md) — proxy path rejects ineligible units with 403.
