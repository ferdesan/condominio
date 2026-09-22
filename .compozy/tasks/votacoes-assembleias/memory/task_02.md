# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Frontend base for voting: types (`MyVote`, `UnitVoteStatus`/`UnitVoteStatusValue`), 4 hooks under `POLLS_KEY`, `UNIT_VOTE_STATUS_LABELS` + confirmation copy, `DETAIL_PREFIXES` in `notification-links.ts`, `serveAssemblies` extended for poll detail/my-vote/vote-status, tests UT-135/136/138/139, UT-141–145, IT-388.
- Gate: `npm --prefix frontend run typecheck && npm run lint && npm test` exit 0.

## Important Decisions

- Labels in PT-BR: `VOTED: 'Já votou'`, `PENDING: 'Pendente'`, `NOT_ELIGIBLE: 'Não elegível'`; confirmation `VOTE_CONFIRMATION = 'Voto registrado'` (ADR-004/IT-362 exact copy). ADR-003 English glosses are descriptive, not literal UI copy.
- `useMyVote`/`useVoteStatus` take `string | null` + `enabled: Boolean(pollId)` (mirror `usePollResults`); mutations take `pollId` as hook argument, variables `{optionId}` / `{unitId, optionId}` per TechSpec Core Interfaces.
- `DETAIL_PREFIXES` stays module-local (not exported); tests assert via `resolveActionUrl`.
- Added `UNIT_VOTE_STATUS_VALUES` const array (file convention, powers UT-145 iteration over the union).
- New callback type `PollVoteCallbacks<TVariables>` for vote mutations (existing `PollActionCallbacks` is hardwired to `{id}` variables).

## Learnings

- Pre-change baseline: typecheck 0, lint 0 (5 pre-existing warnings), tests **exit 1 with 4 pre-existing failures** in `src/test/routes.test.tsx` — `getByRole('navigation')` now matches two navs (sidebar + bottom bar `Navegação rápida`) from mobile-sidebar work on this branch. Must disambiguate those queries to green the gate; not caused by task_02.
- Frontend test naming: id-prefixed Portuguese names per `_tests.md` conventions; file comments written without accents (match `assembly-hooks.ts` style), UI strings with accents.

## Files / Surfaces

- Modified: `frontend/src/types/assembly.ts`, `frontend/src/features/assemblies/assembly-hooks.ts`, `frontend/src/features/assemblies/assembly-labels.ts`, `frontend/src/features/notifications/notification-links.ts`, `frontend/src/features/assemblies/test-utils.ts`, `frontend/src/features/notifications/notifications-page.test.tsx`, `frontend/src/test/routes.test.tsx` (pre-existing nav query fix only).
- Created: `frontend/src/features/notifications/notification-links.test.ts`, `frontend/src/features/assemblies/assembly-hooks.test.tsx`, `frontend/src/features/assemblies/assembly-labels.test.ts`.

## Errors / Corrections

- (pending)

## Ready for Next Run

- (pending)
