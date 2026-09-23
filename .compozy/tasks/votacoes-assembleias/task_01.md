---
status: completed
title: "Backend: cleanup, elegibilidade e vote-status"
type: backend
complexity: high
---

# Task 1: Backend: cleanup, elegibilidade e vote-status

## Overview

Fecha as pendências da Fase 1 que quebram o typecheck e deixam a identidade do voto proxy inerte, impõe no servidor a regra de elegibilidade OWNERS no caminho do síndico, e entrega o read model `GET /polls/:id/vote-status` que a dialog de gestão consome sem vazar opção em voto secreto. É a base de contrato sobre a qual a UI (tasks 3 e 4) se apoia — aqui o backend fica verde e os 16 casos de servidor do contrato passam.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- `persistVote` MUST lose the unused `unit` parameter and the `void unitId; void _` residue so `npm run typecheck` passes without suppressions (TS6133 at ~line 256 of `poll.service.ts`).
- Non-secret proxy votes MUST persist `voterId`/`voterName` from the unit's active resident when known (prefer `isPrimary`); secret polls MUST force both null; `registeredByUserId` MUST remain the manager (ADR-002).
- `castVoteOnBehalf` MUST reject with `ForbiddenError` (403) when `poll.voterType === 'OWNERS'` and the unit has no active OWNER resident; `ALL_RESIDENTS` polls MUST keep current eligibility (any unit of the condominium) (ADR-007).
- `voteStatus(ctx, pollId)` MUST return `UnitVoteStatus[]` (`unitId`, `unitNumber`, `status ∈ {VOTED, PENDING, NOT_ELIGIBLE}`) derived in order: vote exists → VOTED; else OWNERS without active OWNER → NOT_ELIGIBLE; else PENDING (ADR-005).
- `GET /polls/:id/vote-status` MUST be registered in `pollRouter` `extend` with `authorize('vote:manage')` and `idParamSchema`; success 200 via shared `handle`/`ok`.
- `voteStatus` and proxy path MUST share the same eligibility definition (owner set preloaded once by condominium when OWNERS).
- Secret polls: `listVotes` MUST keep returning 403; `voteStatus` MUST work and MUST NOT return `optionId`, `voterId`, or `voterName` on any row.
- Swagger MUST document `GET /polls/{id}/vote-status` alongside the existing vote routes.
- All assigned test cases MUST pass under `npm --prefix backend run test`; typecheck and lint MUST be green.

</requirements>

## Subtasks

- [x] 1.1 Limpar `persistVote`: remover parâmetro `unit` não usado e os `void` residuais; confirmar typecheck
- [x] 1.2 Implementar seleção de identidade do voto proxy (não-secreto com residente; secreto null) conforme ADR-002
- [x] 1.3 Implementar helper de elegibilidade compartilhado (owner set por condomínio quando OWNERS)
- [x] 1.4 Em `castVoteOnBehalf`, recusar 403 quando OWNERS e unidade sem OWNER ativo
- [x] 1.5 Implementar `voteStatus` com a ordem de derivação VOTED → NOT_ELIGIBLE → PENDING
- [x] 1.6 Registrar `GET /:id/vote-status` com `authorize('vote:manage')` e validação de params
- [x] 1.7 Atualizar swagger para a nova rota
- [x] 1.8 Escrever/estender testes de integração backend: my-vote, identidade, elegibilidade, vote-status, regressão pós-cleanup
- [x] 1.9 Escrever teste unitário do helper de identidade (UT-140)
- [x] 1.10 Rodar `npm --prefix backend run typecheck && npm run lint && npm test` e deixar verde

## Implementation Details

Modificar:

- `backend/src/modules/assemblies/services/poll.service.ts` — cleanup, identidade, elegibilidade, `voteStatus`
- `backend/src/modules/assemblies/assembly.routes.ts` — rota `GET /:id/vote-status`
- `backend/src/config/swagger.ts` — documentação
- `backend/tests/integration/assemblies.spec.ts` (ou arquivo irmão) — casos IT novos
- `backend/tests/unit/…` — UT-140 se o helper for puro/exportado para teste

Não criar tabelas nem migration nova (`VoteRegisteredBy` já existe; suite usa synchronize).

Ver "Core Interfaces", "API Endpoints" e "Build Order" 1–4 no [`_techspec.md`](_techspec.md).

### Relevant Files

- `backend/src/modules/assemblies/services/poll.service.ts` — `castVoteOnBehalf` (~208), `persistVote` (~253), `myVote` (~311), `listVotes` (~364); bugs TS6133 e ternário morto
- `backend/src/modules/assemblies/assembly.routes.ts:104-153` — `extend` das rotas `/:id/*` de poll
- `backend/src/modules/assemblies/entities/vote.entity.ts` — colunas de identidade
- `backend/src/modules/residents/resident.repository.ts` — `findByUser`, filtros `unitId`/`type`/`status`
- `backend/src/modules/units/unit.repository.ts:38-43` — `listByCondominium`
- `backend/src/modules/assemblies/repositories/poll.repository.ts` — `listVotes`, `hasVoted`
- `backend/tests/helpers/test-context.ts` — `login`, `seedUsers`, `setupTestContext`
- `backend/tests/integration/assemblies.spec.ts` — fluxo order-dependent existente
- `backend/src/config/swagger.ts:351-370` — bloco atual de rotas de poll

### Dependent Files

- Frontend `assembly-hooks.ts` / dialogs — consomem o contrato `vote-status` e 403 de elegibilidade (tasks 3–4)
- `backend/src/database/migrations/1758100000000-VoteRegisteredBy.ts` — já criada; aceite manual em MySQL fora da suite

### Related ADRs

- [ADR-002: Record voter identity only on non-secret polls](adrs/adr-002.md) — ternário morto e identidade do proxy
- [ADR-003: Manual vote registration is per unit, with a status list](adrs/adr-003.md) — forma da lista e `vote:manage`
- [ADR-005: Dedicated vote-status summary endpoint](adrs/adr-005.md) — rota nova e derivação de status
- [ADR-007: Server enforces OWNER eligibility on manager registration](adrs/adr-007.md) — 403 no proxy OWNERS

## Deliverables

- Typecheck backend limpo (sem TS6133 / sem `void` residuais em `persistVote`)
- Identidade de voto proxy correta (ADR-002) com secret forçando null
- Elegibilidade OWNERS imposta no servidor no caminho proxy
- `GET /polls/:id/vote-status` documentado no swagger e respondendo o shape do TechSpec
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's full definition there before writing tests.

- [x] UT-140 — helper de identidade do voto proxy (não-secreto com residente; secreto null; sem residente nulls)
- [x] IT-369, IT-370 — `my-vote` não-secreto com `optionId` e secreto só `{ voted: true }`
- [x] IT-377 — `GET /vote-status` e `POST /votes` sem `vote:manage` → 403
- [x] IT-380 — proxy OWNERS em unidade sem OWNER ativo → 403
- [x] IT-385, IT-386 — `vote-status` 200 em secreto; `GET /votes` em secreto continua 403
- [x] IT-387 — armazenamento de identidade: proxy não-secreto com identidade + `registeredByUserId`; secreto null
- [x] IT-393, IT-394 — shape feliz de `vote-status`; poll desconhecido/malformado → 404/422
- [x] IT-395 — proxy `ALL_RESIDENTS` sem OWNER na unidade → 200
- [x] IT-396 — regressão pós-cleanup: self-vote + proxy + results com os mesmos status/contadores
- [x] IT-397 — matriz OWNERS: NOT_ELIGIBLE + 403; virar OWNER → PENDING + 200

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix backend run typecheck && npm run lint && npm test` exits 0
- `GET /polls/:id/vote-status` retorna só `unitId`/`unitNumber`/`status`, inclusive em poll secreto
- Nenhum resíduo `void`/`unit` não usado em `persistVote`
