# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Deliberações: botão **Votar** (gate `vote:create`, navega `/votacoes/{pollId}`) e **Gestão** (gate `vote:manage`, abre `poll-proxy-votes-dialog`); dialog de proxy com status por unidade, filtro Todas/Pendente, registro de pendente, erros 409/403 — nunca `optionId`.
- 14 casos atribuídos: IT-358–IT-361, IT-373–IT-376, IT-378, IT-379, IT-381–IT-384.
- Gate: `npm --prefix frontend run typecheck && npm --prefix frontend run lint && npm --prefix frontend test` exit 0.

## Important Decisions

- C1 (conflito task vs US-002 EC-1): presença dos botões só por permissão; **Votar** fica `disabled` + `title="Votação não está aberta"` quando `status !== 'OPEN'` (IT-359 "disabled-with-reason"; janela fica por conta do servidor/VotePage).
- C2: `staleTime: 30_000` do QueryProvider impede refetch no remount — `assembly-polls-dialog` invalida `[POLLS_KEY,'list']` no unmount e o proxy dialog invalida `[POLLS_KEY,'vote-status']` no unmount (IT-361 / US-002 EC-3).
- Mini-form por linha: radios nativos com `aria-label` por unidade (`{label} da unidade {n}`) + botão `Registrar voto` com `aria-label` por unidade; `disabled` só quando sem escolha (IT-381), não durante pending (mesmo precedente do VotePage).
- 409/403 no proxy: `onError` próprio (substitui toast global) grava erro por `unitId` em `role=alert`; refetch de `vote-status` só no 409.
- `serveAssemblies` passa a instalar também `apiPost`: POST `/polls/:id/votes` happy-path (marca unidade VOTED + `world.results.totalVotes+1`); URL desconhecida devolve `undefined` (não lança — req. do task).
- Testes de dialog: IT-373/IT-374 pelo percurso real (AssembliesPage → Deliberações → Gestão); demais com render direto de `PollProxyVotesDialog`.
- Filtro: Radix Select, label visível `Exibir`, opções `Todas`/`Pendente` (IT-383).

## Learnings

- `hasPermission` usa wildcard por recurso: `vote:manage` implica `vote:create` (e o inverso). Fixture de IT-360 não pode usar só `vote:manage` para esconder Votar — usar `assembly:read,poll:read,poll:update,poll:delete` e afirmar Editar.
- Radix Dialog aninhado: X-close e footer compartilham nome acessível `Fechar` — `getAllByRole('button', {name:'Fechar'})[0]` pega o footer (raiz). `getByRole` respeita `aria-hidden`; `getByText`/`getByLabelText` ignoram.
- Mock de 409 deve mutar o **mesmo** `unitId` em `world.voteStatus` (swap para outra unidade orfa a `role=alert` da linha após refetch); toast global permanece quieto.

## Files / Surfaces

- Criar: `frontend/src/features/assemblies/components/poll-proxy-votes-dialog.tsx`, `frontend/src/features/assemblies/poll-proxy-votes-dialog.test.tsx` (IT-373–375, 378, 379, 381–384).
- Modificar: `assembly-polls-dialog.tsx` (Votar/Gestão, unmount invalidation, nested render), `test-utils.ts` (`apiPost` router), `assemblies-page.test.tsx` (IT-358–361, IT-376).

## Errors / Corrections

- Primeira rodada do gate: 5 falhas — IT-360 (wildcard perms), IT-361 (dois `Fechar`), IT-374 (radio clicado durante skeleton), IT-375/IT-382 (unitId trocado no mock 409). Todos corrigidos; re-run verde.

## Ready for Next Run

- Task complete: gate verde (typecheck 0, lint 0 errors / 5 warnings, 100 files / 1175 tests); checkboxes e `status: completed` aplicados.
