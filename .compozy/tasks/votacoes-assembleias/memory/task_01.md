# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Backend cleanup (TS6133), ADR-002 proxy identity, ADR-007 OWNERS eligibility on proxy path, ADR-005 `GET /polls/:id/vote-status`, swagger entry, and 13 assigned cases (UT-140 + 12 ITs). Gate: `npm --prefix backend run typecheck && npm run lint && npm test` exit 0.

## Important Decisions

- Exported pure helpers `selectProxyVoterIdentity` and `unitIsEligible` from `poll.service.ts` so UT-140 can import them without pulling route wiring.
- Eligibility + owner set loaded once per request when OWNERS; `unitIsEligible` is pure and shared by `castVoteOnBehalf` and `voteStatus`.
- Proxy identity: skip resident query when secret; otherwise `listActiveByUnit` (ordered `isPrimary DESC`) then prefer primary.
- `voteStatus` derivation order VOTED → NOT_ELIGIBLE → PENDING; no OPEN/status gate (read model).
- ITs live in sibling `backend/tests/integration/poll-vote-status.spec.ts`; UT in `backend/tests/unit/poll-proxy-identity.spec.ts`.

## Learnings

- Seed resident typing: `index % 3 === 0 ? 'TENANT' : 'OWNER'`; `unitIds[15]`/`unitIds[31]` are VACANT with no residents — used for OWNERS NOT_ELIGIBLE / 403 cases.
- Only `unitIds[0]` resident carries `userId` (morador) — IT-387 non-secret proxy asserts `voterId === seed.users.morador.id` by proxying that unit.
- Malformed id → 422 from `idParamSchema`; unknown uuid → 404 from `findById`.
- Admin token has `vote:manage`; morador token has `vote:read`/`vote:create` only (IT-377).
- `dropSchema: true` + module isolation means each integration file reseeds; polls created inside cases never collide across files.

## Files / Surfaces

- `backend/src/modules/assemblies/services/poll.service.ts` — cleanup, helpers, `voteStatus`
- `backend/src/modules/residents/resident.repository.ts` — `listActiveOwnersByCondominium`, `listActiveByUnit`
- `backend/src/modules/assemblies/assembly.routes.ts` — `GET /:id/vote-status`
- `backend/src/config/swagger.ts` — `/polls/{id}/vote-status`
- `backend/tests/integration/poll-vote-status.spec.ts` — IT-369/370/377/380/385/386/387/393/394/395/396/397
- `backend/tests/unit/poll-proxy-identity.spec.ts` — UT-140
- `backend/src/database/migrations/1758100000000-VoteRegisteredBy.ts` — pre-existing, included in commit

## Errors / Corrections

- Baseline typecheck failed TS6133 `unit` unused in `persistVote` — fixed by removing the param and `void` residue (callers updated).
- No test/lint failures after first full gate run; no corrections needed.

## Ready for Next Run

- Gate evidence: typecheck clean, lint clean, 33 suites / 395 tests pass (`jest --runInBand`).
- Task file checkboxes + status must be flipped to completed after this memory update; commit only backend src/tests + migration (exclude `.compozy/**`, `PLANO_VOTACOES.md`, `review-final.md`, `package.json` if unrelated).
