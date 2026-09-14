# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Telas de Visitantes e Correspondências: CRUD completo mais um fluxo cada (check-in/check-out; baixa de entrega), cada fluxo com seu contador dedicado. Entregue e verificado.

## Important Decisions

- **Fixtures locais** em `features/<recurso>/test-utils.ts` (`makeVisitor`, `makeCorrespondence`, `serveVisitors`, `serveCorrespondences`) em vez de somar a `src/test/fixtures.ts`. O `_techspec.md` só manda isolar `types/`, mas a razão que ele dá — arquivo compartilhado entre tasks já quebrou duas execuções — vale igual para o harness. `src/test/` ficou intocado.
- **Entrada e saída são oferecidas sem olhar o status** (só `visitor:update`), e o mesmo para a baixa. Sem isso o caso "saída de quem não entrou é recusada" não teria como ser exercido pela interface — e é um caso exigido pelo `## Tests`.
- **Trinco de duplo clique por linha**, não global: `useRef(new Set<string>())` com o id. Um `boolean` único bloquearia registrar duas chegadas simultâneas, que é o caso normal de uma portaria movimentada.
- **Regra do período previsto duplicada no cliente** (`expectedUntil > expectedAt`). O servidor a recusa como `BusinessRuleError`, isto é, 409 sem caminho de campo; dita no campo ela tem conserto óbvio. É a única regra duplicada.
- Contadores apresentados como botão-atalho que aplica o filtro do status correspondente, seguindo a forma de "Aguardando decisão" em Reservas.

## Learnings

- `/visitors/inside-count` e `/correspondences/pending-count` aceitam `condominiumId` por query e devolvem `{ inside }` / `{ pending }`.
- `deliverCorrespondenceSchema` exige `deliveredTo` (mín. 3); `checkInSchema` e `checkOutSchema` aceitam corpo vazio — daí um fluxo com diálogo e dois sem.
- As mensagens de recusa do servidor, usadas verbatim nos testes, estão em `visitor.service.ts` e `correspondence.service.ts`.
- Exportar `correspondenceLabel` do mesmo arquivo do componente gerou um `react-refresh/only-export-components` novo; mover para `correspondence-labels.ts` resolveu e é onde a função pertencia.

## Files / Surfaces

- Criados: `types/visitor.ts`, `types/correspondence.ts`, `features/visitors/**`, `features/correspondences/**` (13 arquivos de código + 4 de teste).
- Intocados, como exigido: `routes/app-router.tsx`, `types/api.ts`, `lib/crud/**`, `components/common/**`, `components/ui/**`, `src/test/**`.

## Errors / Corrections

- Primeira tentativa de escrever os arquivos por heredoc no Bash abortou no parser; os fontes foram escritos pela ferramenta de escrita. Sem efeito no resultado, mas evita repetir a tentativa.

## Ready for Next Run

- Verificação final: `typecheck` 0, `lint` 0 erros / 5 warnings (todos anteriores), `test` 54 arquivos / 555 casos verdes, `build` 0.
- Sem commit: a execução rodou com `--auto-commit=false`. O diff está limpo para revisão manual, e as duas features aparecem como diretórios não rastreados.
- A task_05 registra as rotas; os nomes dos componentes estão no handoff da memória compartilhada.
