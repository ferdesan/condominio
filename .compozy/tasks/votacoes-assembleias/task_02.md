---
status: completed
title: "Frontend base: tipos, hooks, labels e deep-link"
type: frontend
complexity: medium
---

# Task 2: Frontend base: tipos, hooks, labels e deep-link

## Overview

Prepara a camada de dados e os utilitários puros que VotePage e o diálogo de gestão compartilham: tipos `MyVote`/`UnitVoteStatus`, os quos hooks sob `POLLS_KEY`, rótulos de status/confirmação, e a exceção `DETAIL_PREFIXES` que faz a notificação de votação abrir o path completo `/votacoes/:id`. Pode correr em paralelo à task_01 — os testes usam transporte simulado (ADR-010) contra o contrato congelado no TechSpec.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- `types/assembly.ts` MUST gain `MyVote` and `UnitVoteStatus` (+ `UnitVoteStatusValue` union `VOTED | PENDING | NOT_ELIGIBLE`) matching the TechSpec Core Interfaces.
- `assembly-hooks.ts` MUST gain `useMyVote`, `useCastVote`, `useVoteStatus`, `useCastProxyVote` with keys/endpoints/invalidations of the TechSpec (all under `POLLS_KEY`); follow `useOpenPoll`/`usePollResults` callback patterns (onError only when provided).
- `assembly-labels.ts` MUST gain `UNIT_VOTE_STATUS_LABELS` for all three statuses and confirmation copy ("Voto registrado" or equivalent); labels MUST NOT collide with existing column/filter vocabulary (module doc constraint).
- `notification-links.ts` MUST implement `DETAIL_PREFIXES = ['/votacoes']`: full path returned when path matches prefix with ≥2 segments; query stripped first; upward walk over `KNOWN_PATHS` unchanged otherwise (ADR-006).
- Module doc of `notification-links.ts` MUST be updated to document the exception.
- `serveAssemblies` (or a sibling helper) MUST be able to serve `GET /polls/:id`, `/my-vote`, `/vote-status` and note that POST helpers may live in task_03/04 test files — at minimum unit tests for resolve/hooks/labels MUST pass without unknown-URL throws.
- All assigned test cases MUST pass under `npm --prefix frontend run test`; typecheck and lint MUST be green.

</requirements>

## Subtasks

- [x] 2.1 Adicionar `MyVote`, `UnitVoteStatus` e o union de status em `types/assembly.ts`
- [x] 2.2 Implementar os quatro hooks em `assembly-hooks.ts` conforme o TechSpec
- [x] 2.3 Acrescentar labels de status de unidade e confirmação em `assembly-labels.ts`
- [x] 2.4 Implementar `DETAIL_PREFIXES` e atualizar o doc de `notification-links.ts`
- [x] 2.5 Estender `test-utils.ts` para servir as novas URLs de leitura de poll (detail/my-vote/vote-status)
- [x] 2.6 Escrever testes unitários: resolveActionUrl (UT-135,136,138,139), hooks (UT-141–144), labels (UT-145)
- [x] 2.7 Escrever caso de integração da central de notificações (IT-388)
- [x] 2.8 Rodar `npm --prefix frontend run typecheck && npm run lint && npm test` e deixar verde

## Implementation Details

Modificar:

- `frontend/src/types/assembly.ts`
- `frontend/src/features/assemblies/assembly-hooks.ts`
- `frontend/src/features/assemblies/assembly-labels.ts`
- `frontend/src/features/notifications/notification-links.ts`
- `frontend/src/features/assemblies/test-utils.ts`
- `frontend/src/features/notifications/notifications-page.test.tsx` — IT-388

Ver "Core Interfaces" e "Build Order" 5–6 no [`_techspec.md`](_techspec.md).

### Relevant Files

- `frontend/src/types/assembly.ts:73-122` — `Poll`, `PollResults`; ponto de acrescentar `MyVote`/`UnitVoteStatus`
- `frontend/src/features/assemblies/assembly-hooks.ts:166-210` — molde `useOpenPoll`/`usePollResults`
- `frontend/src/features/assemblies/assembly-labels.ts` — mapa de rótulos e restrição de colisão
- `frontend/src/features/notifications/notification-links.ts:34-59` — `KNOWN_PATHS` e walk atual
- `frontend/src/features/assemblies/test-utils.ts:122-161` — `serveAssemblies` / `apiGet` switch
- `frontend/src/features/notifications/notifications-page.test.tsx:305-368` — moldes de destino de link
- `frontend/src/lib/crud/resource-hooks.ts` — fábrica usada por `pollHooks.useOne`

### Dependent Files

- `vote-page.tsx` (task_03) — consome `useMyVote`/`useCastVote`/tipos
- `poll-proxy-votes-dialog.tsx` (task_04) — consome `useVoteStatus`/`useCastProxyVote`/labels
- `assembly-polls-dialog.tsx` (task_04) — pode usar labels na navegação

### Related ADRs

- [ADR-002: Record voter identity only on non-secret polls](adrs/adr-002.md) — forma de `MyVote` em secreto
- [ADR-005: Dedicated vote-status summary endpoint](adrs/adr-005.md) — tipo `UnitVoteStatus`
- [ADR-006: DETAIL_PREFIXES preserves deep-link paths](adrs/adr-006.md) — exceção no resolvedor de notificações

## Deliverables

- Tipos, hooks, labels e `DETAIL_PREFIXES` no lugar, alinhados ao TechSpec
- Doc do módulo de notificações atualizado com a exceção
- `serveAssemblies` capaz de servir as leituras novas de poll
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's full definition there before writing tests.

- [x] UT-135, UT-136, UT-138, UT-139 — `resolveActionUrl` com DETAIL_PREFIXES e fallback preservado
- [x] UT-141–UT-144 — construção e endpoints/invalidação dos quatro hooks
- [x] UT-145 — labels de status e confirmação completos e sem colisão
- [x] IT-388 — notificação `/votacoes/{id}` oferece link com href exato

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck && npm run lint && npm test` exits 0
- `resolveActionUrl('/votacoes/poll-abc')` devolve o path completo; `/reservas/res-1` ainda cai em `/reservas`
- Nenhum hook novo mistura chaves fora de `POLLS_KEY`
