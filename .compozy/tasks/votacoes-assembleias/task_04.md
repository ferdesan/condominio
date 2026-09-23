---
status: completed
title: "Deliberações: Votar e gestão por unidade"
type: frontend
complexity: high
---

# Task 4: Deliberações: Votar e gestão por unidade

## Overview

Fecha as duas entradas de produto sobre a dialog de Deliberações: o botão **Votar** que leva o morador à VotePage, e o diálogo de gestão (`poll-proxy-votes-dialog`) que lista unidades com status VOTED/PENDING/NOT_ELIGIBLE e registra voto proxy para pendentes sob `vote:manage` — sem nunca exibir a opção escolhida. Depende da base de tipos/hooks da task_02; o contrato do endpoint de status é o da task_01/TechSpec, testado aqui via transporte simulado.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- `assembly-polls-dialog` MUST offer **Votar** when `can('vote:create')` and navigate to `/votacoes/{pollId}` (ADR-001); MUST offer **Gestão** when `can('vote:manage')` and open the proxy dialog; actions MUST be gated by permission, not by status (existing dialog doc) — server decides OPEN/window.
- **Votar** MUST NOT render when the user lacks `vote:create`; MUST NOT render enabled for non-OPEN in a way that contradicts US-002 EC-1 (absent or disabled-with-reason consistent with closed).
- `poll-proxy-votes-dialog` MUST load `useVoteStatus`, render one row per unit with number + status label only (never `optionId`), provide a status filter (all/pending) for large lists (US-005 EC-5).
- Pending eligible rows MUST allow selecting an option and submitting via `useCastProxyVote`; NOT_ELIGIBLE rows MUST block submit client-side; server remains authority (403/409 surfaced without corrupting the list).
- Poll not OPEN MUST show a clear non-submittable state (US-005 EC-1).
- Empty/invalid option MUST disable submit or show validation (US-005 EC-3).
- 409 on proxy MUST show conflict and refetch status so the list reconciles (US-005 EC-4).
- Dialog MUST NOT display the chosen option for any row, secret or not (ADR-003).
- Transport mocks MUST serve `GET /polls/:id/vote-status` and POST proxy in tests; unknown URLs must not throw.
- All assigned test cases MUST pass under `npm --prefix frontend run test`; typecheck and lint MUST be green.

</requirements>

## Subtasks

- [x] 4.1 Adicionar botão **Votar** em `assembly-polls-dialog` com gate `vote:create` e navegação para a rota de voto
- [x] 4.2 Adicionar botão **Gestão** com gate `vote:manage` abrindo o diálogo de proxy
- [x] 4.3 Criar `poll-proxy-votes-dialog.tsx`: lista de status, filtro, estados de carga/erro
- [x] 4.4 Implementar mini-form por linha pendente: seleção de opção + submit proxy + refetch
- [x] 4.5 Tratar NOT_ELIGIBLE (bloqueio), poll não-OPEN (mensagem), 409 (conflito + refetch), option vazia
- [x] 4.6 Estender fixtures/transport para `vote-status` e POST `/votes`
- [x] 4.7 Escrever testes de entrada Deliberações (IT-358–IT-361, IT-376)
- [x] 4.8 Escrever testes do diálogo de gestão (IT-373–IT-375, IT-378, IT-379, IT-381–IT-384)
- [x] 4.9 Rodar `npm --prefix frontend run typecheck && npm run lint && npm test` e deixar verde

## Implementation Details

Criar:

- `frontend/src/features/assemblies/components/poll-proxy-votes-dialog.tsx`
- (se necessário) casos novos em `assemblies-page.test.tsx` ou arquivo de teste dedicado do diálogo

Modificar:

- `frontend/src/features/assemblies/components/assembly-polls-dialog.tsx` — ações de linha (~146–198)
- `frontend/src/features/assemblies/test-utils.ts` — world + `apiGet`/`apiPost` para status e proxy
- `frontend/src/features/assemblies/assembly-labels.ts` — já fornecido pela task_02; consumir aqui

Ver "Data flow — manager registration" e "Build Order" 8–10 no [`_techspec.md`](_techspec.md).

### Relevant Files

- `frontend/src/features/assemblies/components/assembly-polls-dialog.tsx:146-209` — fileira de ações onde Votar/Gestão entram; gates em 54–56
- `frontend/src/features/assemblies/components/assembly-finish-dialog.tsx` — molde de diálogo de ação com corpo
- `frontend/src/features/assemblies/components/poll-form-dialog.tsx` — diálogo de formulário aninhado (stacking)
- `frontend/src/features/assemblies/assembly-hooks.ts` — `useVoteStatus`/`useCastProxyVote` (task_02)
- `frontend/src/features/assemblies/assembly-labels.ts` — `UNIT_VOTE_STATUS_LABELS` (task_02)
- `frontend/src/features/assemblies/test-utils.ts` — estender `serveAssemblies`
- `frontend/src/features/assemblies/assemblies-page.test.tsx:351-494` — molde de testes do painel de Deliberações e `topDialog()`
- `frontend/src/hooks/use-auth.ts` — `can('vote:create'|'vote:manage')`

### Dependent Files

- `vote-page.tsx` (task_03) — destino do **Votar**; sem dependência de código para compilar
- `types/assembly.ts` / hooks (task_02) — pré-requisito de graph edge

### Related ADRs

- [ADR-001: Deep-link vote route as primary vote UX](adrs/adr-001.md) — Votar navega para a rota
- [ADR-003: Manual vote registration is per unit, with a status list](adrs/adr-003.md) — lista de status sem opção, `vote:manage`
- [ADR-005: Dedicated vote-status summary endpoint](adrs/adr-005.md) — consumidor do read model
- [ADR-007: Server enforces OWNER eligibility on manager registration](adrs/adr-007.md) — NOT_ELIGIBLE no cliente espelha o 403

## Deliverables

- **Votar** e **Gestão** nas Deliberações com gates de permissão corretos
- `poll-proxy-votes-dialog` completo: status, filtro, registro, erros
- Fixtures de transporte cobrindo status e proxy
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's full definition there before writing tests.

- [x] IT-358–IT-361 — Votar navega; não-OPEN sem Votar ativo; sem `vote:create` oculto; refetch ao reabrir
- [x] IT-376 — sem `vote:manage`, Gestão oculto
- [x] IT-373–IT-375 — lista status sem opção; registrar pendente; 409 em já-votou
- [x] IT-378, IT-379 — poll não-OPEN; NOT_ELIGIBLE bloqueia submit
- [x] IT-381–IT-384 — option vazia; 409 reconcilia; filtro em lista grande; VOTED sem expor opção

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck && npm run lint && npm test` exits 0
- Nenhum payload/`render` de status contém `optionId`
- Votar/Gestão somem conforme as permissões; servidor continua autoridade nos 403/409
