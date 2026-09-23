# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01 (backend: cleanup, elegibilidade e vote-status) implemented and verified green (typecheck + lint + 395 tests).
- task_02 (frontend base: tipos, hooks, labels, deep-link) implemented and verified green.
- task_03 (VotePage + rota `/votacoes/:pollId`) implemented and verified green (typecheck 0, lint 0 errors / 5 pre-existing warnings, 99 files / 1161 tests).
- Backend surface for `vote-status`, proxy OWNERS eligibility and ADR-002 identity is frozen in the TechSpec; frontend tasks 02–04 consume that contract.
- Branch `feat/tema-verde-e-icones` carries pre-existing Fase-1 WIP (vote.entity, assembly.schema, swagger, assembly.routes, migration `VoteRegisteredBy`) built on top — do not revert.

## Shared Decisions

- ADR-002/003/005/007 are frozen; no reopen during execution.
- Shared eligibility: unit eligible ⇔ ALL_RESIDENTS, or (OWNERS and ≥1 active OWNER); used by both `castVoteOnBehalf` and `voteStatus`.
- `vote-status` rows are only `{unitId, unitNumber, status}` — never option/identity, even on secret polls; `GET /votes` stays 403 on secret.
- Status derivation order: VOTED → NOT_ELIGIBLE → PENDING; works for any poll status (read-only).
- Responses stay 200 via `ok()`; routes use shared `handle` + `idParamSchema`.
- Backend messages without accents; test names Portuguese, no accents, no "should"/"deve", prefixed with case id.
- Frontend: code comments without accents; UI strings with accents; test names Portuguese without accents, id-prefixed.
- VotePage state priority (task_03): loading → poll error (403 forbidden / else not-found) → myVote 403 → confirmation → already-voted → not-open → missing `vote:create` → votable. Confirmation/already-voted outrank not-open; poll 404 outranks confirmation.
- 409 on vote POST converges to already-voted/conflict without toast (own `onError` replaces global handler); submit not disabled during pending so double-submit can 409.
- Fixture `makeOpenPoll()` (OPEN + 2020–2035 window) for votable tests; base `makePoll` window Apr 2026 is past suite clock — do not change defaults.

## Shared Learnings

- Seed: 32 units; VACANT without residents at `unitIds[15]` and `unitIds[31]`; resident type `index % 3 === 0 ? TENANT : OWNER`; only `unitIds[0]` resident has `userId` (morador).
- ADMIN/SINDICO have `vote:manage`; RESIDENT has `vote:create`/`vote:read` only.
- Each integration file gets its own sql.js DB (`dropSchema: true`); seed once per file, no `beforeEach`.
- `residents.listActiveByUnit` orders by `isPrimary DESC` so proxy identity prefers the primary resident.
- Pre-existing typecheck blocker was TS6133 `unit` unused in `persistVote` (~line 256) plus `void unitId; void _` residue — removed with the `unit` param.
- `routes.test.tsx` `getByRole('navigation')` matches sidebar + bottom bar; disambiguate with `within(...)` (fixed in task_02).

## Open Risks

- Migration `1758100000000-VoteRegisteredBy` still needs manual `npm run migration:run` on MySQL (never loaded by the suite).
- Order-dependent `assemblies.spec.ts` shares `pollId`; new cases must keep using separate polls or run before close under `--runInBand`.

## Handoffs

- task_02 can consume: `UnitVoteStatus`/`UnitVoteStatusValue` types, `GET /polls/:id/vote-status` (vote:manage), proxy 403 message `Esta deliberacao e restrita aos proprietarios.`
- task_03 delivers: route `/votacoes/:pollId` guarded by `vote:read` outside menu; task_04 **Votar** navigates there; `makeOpenPoll` in assemblies `test-utils`.
- task_04 must extend `serveAssemblies`/`AUXILIARY_READS` for `/vote-status` or dialog tests will throw on unknown transport URLs.
- Contract sources: `.compozy/tasks/votacoes-assembleias/_techspec.md`, `_tests.md`, ADRs 001–007.
