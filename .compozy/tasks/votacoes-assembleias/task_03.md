---
status: complete
title: "VotePage + rota /votacoes/:pollId"
type: frontend
complexity: high
---

# Task 3: VotePage + rota /votacoes/:pollId

## Overview

Entrega a superfície canônica de voto do morador: página em `/votacoes/:pollId` com todos os estados do US-001/003/004/006 (votável, já votou, fechada, não encontrada, proibida, confirmação + apuração), o registro da rota com guarda `vote:read` fora do menu, e os casos de rota/notificação que provam o deep-link de ponta a ponta. Depende só da base de tipos/hooks da task_02.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not by duplicating HOW
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- VotePage MUST load the poll (`pollHooks.useOne`) and `useMyVote`, and MUST implement states: loading, not-found (404 → link back to `/assembleias`), forbidden (no `vote:read` via route guard / 403 body), not-open (DRAFT/CLOSED or outside window), votable, already-voted, confirmation after success (ADR-004).
- Route `/votacoes/:pollId` MUST be registered in `app-router.tsx` with `ProtectedRoute permission="vote:read"`, MUST NOT enter `NAV_ITEMS` or `IMPLEMENTED` (balancete non-menu precedent).
- Submit MUST call `useCastVote`; on success show confirmation then `PollResultsPanel` when `can('poll:read')`; confirmation MUST remain if results fetch fails; without `poll:read` confirmation only (no results block, no error spam).
- Secret poll confirmation MUST NOT require displaying the chosen option; already-voted on secret shows voted flag only (API contract).
- 409 on POST MUST converge to already-voted/conflict without duplicate writes (US-004 EC-1).
- Submit control MUST be a `button` with an accessible name in the votable state (IT-357 proxy for mobile reachability).
- Frontend tests MUST extend transport mocks (`serveAssemblies`, `AUXILIARY_READS`) in the same change so unknown URLs do not throw.
- All assigned test cases MUST pass under `npm --prefix frontend run test`; typecheck and lint MUST be green.

</requirements>

## Subtasks

- [x] 3.1 Criar `vote-page.tsx` com estados de carregamento, 404, proibida, não-aberta, votável e já-votou
- [x] 3.2 Ligar `useMyVote` + `useCastVote` + `pollHooks.useOne` e a transição para confirmação
- [x] 3.3 Exibir `PollResultsPanel` após confirmação quando `poll:read`; sem ela, só confirmação
- [x] 3.4 Tratar 409/erro de voto como já-votou/conflito sem quebrar a página
- [x] 3.5 Registrar a rota em `app-router.tsx` com guarda `vote:read`, fora de menu/IMPLEMENTED
- [x] 3.6 Estender `AUXILIARY_READS` / fixtures de rota para as leituras da VotePage
- [x] 3.7 Escrever testes da página (IT-347,349–357,362–368,371,372)
- [x] 3.8 Escrever casos de rota e notificação (UT-137, IT-389–IT-392)
- [x] 3.9 Rodar `npm --prefix frontend run typecheck && npm run lint && npm test` e deixar verde

## Implementation Details

Criar:

- `frontend/src/features/assemblies/vote-page.tsx`
- `frontend/src/features/assemblies/vote-page.test.tsx`

Modificar:

- `frontend/src/routes/app-router.tsx` — nova `<Route>` após o bloco de assembleias, molde do balancete (~191–208)
- `frontend/src/test/routes.test.tsx` — `AUXILIARY_READS` + describe próprio da rota
- `frontend/src/features/assemblies/test-utils.ts` — servir `GET /polls/:id` e my-vote se necessário

Ver "Data flow — resident vote", "Route / Permission Matrix" e "Build Order" 7 no [`_techspec.md`](_techspec.md).

### Relevant Files

- `frontend/src/features/financial/balancete-page.tsx` — molde de página de detalhe fora do menu com estados
- `frontend/src/routes/app-router.tsx:191-213` — precedente de rota com guarda própria e comentário
- `frontend/src/routes/protected-route.tsx` — `permission` → `ForbiddenPage`
- `frontend/src/features/assemblies/components/poll-results-panel.tsx` — painel de apuração a reutilizar
- `frontend/src/features/assemblies/assembly-hooks.ts` — hooks da task_02
- `frontend/src/features/assemblies/test-utils.ts` — fixtures `makePoll`, `serveAssemblies`
- `frontend/src/test/render.tsx` — `renderWithProviders({ permissions, route })`
- `frontend/src/test/routes.test.tsx:403-439` — molde de caso próprio de rota não-menu

### Dependent Files

- `assembly-polls-dialog.tsx` (task_04) — botão Votar navega para esta rota; sem acoplamento de código
- `notification-links.ts` (task_02) — destino do deep-link resolvido para esta rota

### Related ADRs

- [ADR-001: Deep-link vote route as primary vote UX](adrs/adr-001.md) — rota canônica e guarda `vote:read`
- [ADR-004: After voting, show confirmation then results](adrs/adr-004.md) — pós-envio confirmação + apuração
- [ADR-002: Record voter identity only on non-secret polls](adrs/adr-002.md) — my-vote em poll secreto

## Deliverables

- `vote-page.tsx` com todos os estados do contrato
- Rota registrada fora do menu, guard `vote:read`
- Extensão de fixtures/`AUXILIARY_READS` para a tela
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's full definition there before writing tests.

- [x] UT-137 — rota fora de `NAV_ITEMS`/`IMPLEMENTED` e guarda `vote:read`
- [x] IT-347, IT-349–IT-357 — VotePage: voto feliz, proibida, 404, fechada, janela, auth, já-votou, OWNERS 403, 409, controle acessível
- [x] IT-362–IT-368 — confirmação, apuração, secreto, falha de results, CLOSED, sem `poll:read`, retorno com optionId
- [x] IT-371, IT-372 — 409 com my-vote false → já-votou; poll sumiu → 404 sem crash
- [x] IT-389–IT-392 — login/retorno, clicar com poll fechado, rota no AppRouter real, negada só com `assembly:read`

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck && npm run lint && npm test` exits 0
- `/votacoes/:id` com `vote:read` renderiza a página; sem ela, "Acesso negado"; fora do sidebar
- Confirmação permanece se `GET results` falhar; sem `poll:read` não há bloco de apuração
