# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- VotePage at `/votacoes/:pollId` with all US-001/003/004/006 states; route registered with `ProtectedRoute permission="vote:read"` outside `NAV_ITEMS`/`IMPLEMENTED`.
- Assigned cases green: UT-137; IT-347, IT-349–IT-357, IT-362–IT-368, IT-371, IT-372, IT-389–IT-392 (24 total).
- Gate: `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend test` → typecheck 0, lint 0 errors (5 pre-existing warnings), **99 files / 1161 tests passed**.

## Important Decisions

- **State priority:** loading → poll error (403→ForbiddenPage, else not-found) → myVote 403→ForbiddenPage → confirmation (`phase==='confirmation'`) → already-voted (`phase==='conflict' || myVote.voted`) → not-open → `!can('vote:create')`→ForbiddenPage → votable. Confirmation/already-voted outrank not-open (IT-366); poll 404 outranks confirmation (IT-372).
- **`VotePhase = 'form' | 'confirmation' | 'conflict'`** — 409 uses functional update so it never leaves confirmation and otherwise converges to conflict (IT-356/IT-371); no duplicate writes.
- **`useCastVote` with our `onError`** replaces the global toast (RQ v5 merge-by-key) → inline `role="alert"` for non-409, silent convergence for 409, no error spam (IT-367).
- **Submit button NOT disabled during pending** so double `fireEvent.submit(form)` reaches the server as 409 (US-004 EC-1); disabled only when `!optionId`.
- **Not-open title by status first:** `status !== 'OPEN'` → "Votação não está aberta"; OPEN outside window → "Votação fora do período de votação" (IT-351 vs IT-352).
- **Results only when `can('poll:read')`** and only in confirmation/already-voted; wrapped in `ResultsCard` h2 "Apuração" reusing `PollResultsPanel`.
- **Confirmation never shows chosen option**; already-voted shows `Opção escolhida: {label}` only when `myVote.optionId` found in `poll.options` (secret → generic description).
- **UT-137 behavioral:** `IMPLEMENTED` is module-private; assert `NAV_ITEMS` has no `/votacoes` path + render with `assembly:read`→"Acesso negado" + with `vote:read`→real page, never `PLACEHOLDER_MARKER`.
- **`makeOpenPoll()`** helper (OPEN + window 2020→2035) added to `test-utils.ts`; base `makePoll` default window (Apr 2026) is past relative to suite clock — do not change shared defaults.

## Learnings

- `renderVote` wraps local `<Routes>` with the same `ProtectedRoute permission="vote:read"` as production for page tests; route existence is asserted once in `routes.test.tsx`.
- IT-353 follows `authorization.test.tsx` IT-179: real AuthProvider + token + `/auth/me` OK + boot reads dispatch `auth:session-expired` + throw 401.
- IT-389 uses `resolveActionUrl` then unauthenticated render with `LoginProbe` asserting `location.state.from === '/votacoes/poll-1'`.
- Results failure test wraps `serveAssemblies`' `apiGet` implementation (client 400 skips QueryProvider retry).
- Pre-existing routes.test nav double-match (sidebar + bottom bar) was already fixed in task_02; `within(...navigation)` disambiguates.

## Files / Surfaces

- Created: `frontend/src/features/assemblies/vote-page.tsx`, `frontend/src/features/assemblies/vote-page.test.tsx`.
- Modified: `frontend/src/routes/app-router.tsx` (route after assemblies block), `frontend/src/test/routes.test.tsx` (`AUXILIARY_READS` poll-1/my-vote + describe "A rota de votacao"), `frontend/src/features/assemblies/test-utils.ts` (`makeOpenPoll`).

## Errors / Corrections

- Initial typecheck: stray `});` in routes.test.tsx after describe insert — removed.
- IT-357 first failed asserting `toBeEnabled()` before selecting an option — test now clicks option first, then asserts enabled button (contract is accessible name, not always-enabled).

## Ready for Next Run

- task_04 can navigate to `/votacoes/{pollId}` from Deliberações **Votar**; no code coupling — route + guard already registered.
- Shared MEMORY: VotePage state priority + `makeOpenPoll` pattern reusable for dialog tests.
