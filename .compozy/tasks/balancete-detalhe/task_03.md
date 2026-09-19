---
status: completed
title: "A tela na rota própria"
type: frontend
complexity: high
---

# Task 3: A tela na rota própria

## Overview

Dá endereço ao documento: `/financeiro/balancete/:mes` mostra o resumo em cima e
os lançamentos embaixo, com filtro por categoria e paginação no cliente. É a
segunda rota de detalhe do sistema e a segunda rota fora do menu, e as duas
condições têm precedente — o que ela rompe, e por quê, está no ADR-001.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- A rota MUST ser guardada por `financial-closing:read`, e MUST NOT herdar o `charge:read` que guarda `/financeiro`. Quem lê cobranças sem poder ler a prestação de contas não pode alcançá-la digitando o endereço.
- A rota MUST NOT entrar em `navigation.ts` nem em `IMPLEMENTED`: ela não é item de menu, e aquele conjunto serve ao gerador de placeholders.
- `REGISTERED` de `routes.test.tsx` MUST permanecer com a mesma contagem, e a rota MUST ser exercitada num caso próprio, como `/perfil` já é.
- `AUXILIARY_READS` MUST ganhar as URLs de fechamento, **e a task MUST escrever no lugar por que isso não contradiz a garantia da task_04 anterior** — aquela promessa era sobre o boot de `/financeiro`, e esta rota existe para ler o balancete ao montar.
- A tabela MUST paginar no cliente (`clientPagination`), e a troca de página MUST NOT gerar requisição.
- Um mês fechado cujo documento não tem lançamentos gravados (`frozen: true`, lista vazia, totais acima de zero) MUST dizer que o documento é anterior ao registro dos lançamentos. Renderizar uma tabela vazia ali afirmaria que o mês não teve movimento, o que é falso.
- Um mês aberto MUST ser identificado como tal, e MUST NOT se apresentar como documento fechado.
- Os estados de erro MUST seguir a rota de detalhe que já existe: `ForbiddenPage` no 403, e o estado de não encontrado com link de volta para os demais.
- A seção em `/financeiro` MUST ganhar o link para o documento completo, sem perder nada do que já mostra.
</requirements>

## Subtasks

- [x] 3.1 Espelhar `StatementEntry` e a forma da resposta em `types/financial.ts`
- [x] 3.2 Escrever `useClosingEntries`, com a chave de consulta por condomínio e competência
- [x] 3.3 Escrever a página da rota: cabeçalho, estados de carregando, negado e não encontrado
- [x] 3.4 Escrever a tabela de lançamentos, com as colunas, o filtro por categoria e a paginação no cliente
- [x] 3.5 Tratar o caso do documento anterior ao registro dos lançamentos
- [x] 3.6 Registrar a rota com a sua própria guarda, sem tocar em `navigation.ts`
- [x] 3.7 Acrescentar o link a partir da seção
- [x] 3.8 Acrescentar as entradas em `AUXILIARY_READS`, com o comentário que explica a mudança
- [x] 3.9 Escrever os casos atribuídos, inclusive o da rota dentro do roteador real
- [x] 3.10 Rodar o pipeline do frontend e comparar a contagem

## Implementation Details

Criar:

- `frontend/src/features/financial/balancete-page.tsx`
- `frontend/src/features/financial/closing-entries-table.tsx`

Modificar:

- `frontend/src/features/financial/financial-hooks.ts` — `useClosingEntries`
- `frontend/src/features/financial/financial-labels.ts` — rótulos de tipo de lançamento e forma de pagamento
- `frontend/src/features/financial/components/closing-section.tsx` — o link
- `frontend/src/types/financial.ts`
- `frontend/src/routes/app-router.tsx`
- `frontend/src/test/routes.test.tsx` — `AUXILIARY_READS` e o caso da rota

A página usa `PageHeader` e cards próprios, e **não** `CrudLayout` — que é para
listagens. É a forma da rota de detalhe que já existe.

Ver "API Endpoints" no [`_techspec.md`](_techspec.md) e o [ADR-001](adrs/adr-001.md).

### Relevant Files

- `frontend/src/features/condominiums/condominium-detail-page.tsx` — a rota de detalhe existente, inteira: `useParams` com default `null`, os early returns de carregando / 403 / não encontrado, o `PageHeader`, e o `DetailSkeleton` que segura a posição dos blocos
- `frontend/src/features/condominiums/condominium-detail-page.test.tsx:68-75` — `renderDetail`, que injeta o parâmetro montando um `<Routes>` local e passando a URL concreta em `route`
- `frontend/src/routes/app-router.tsx:97-101` — como a rota de detalhe é registrada sob a guarda; e `:241`, `/perfil`, a rota fora do menu
- `frontend/src/test/routes.test.tsx:71-101` — `AUXILIARY_READS`, e `:128`, o `ApiError 422` para URL não prevista
- `frontend/src/test/routes.test.tsx:344-356` — o caso do `/perfil`: rota fora do menu, exercitada sem entrar em `REGISTERED`
- `frontend/src/components/common/data-table.tsx:39-64` — as props; e `:165-168`, o `clientPagination` que ainda não foi usado em lugar nenhum
- `frontend/src/features/audit/audit-page.tsx:44-196` — o desenho de lista com `useListState`, para comparação: é o caminho que esta tela **não** segue
- `frontend/src/features/audit/components/audit-filters.tsx:64-70` — a ponte do `FilterPanel`, que devolve os filtros que sobraram e não o removido
- `frontend/src/features/financial/financial-hooks.ts:385-410` — `CLOSINGS_KEY` e `useClosing`, ao lado de onde o hook novo entra
- `frontend/src/features/misc/forbidden-page.tsx` — o estado de acesso negado
- `frontend/src/lib/format.ts` — `formatCurrency`, `formatDate`, `formatReferenceMonth`

### Dependent Files

- `frontend/src/features/financial/closing-section.test.tsx` — a seção ganha o link; o caso que afirma a ausência dos botões é da task_04
- `frontend/src/routes/navigation.ts` — **não** deve ser tocado; a contagem de `REGISTERED` depende disso
- `.compozy/tasks/balancete-detalhe/task_04.md` — move a exportação para esta tela

### Related ADRs

- [ADR-001: A Detail Route for the Closed Statement](adrs/adr-001.md) — a rota, a guarda própria e o precedente do `/perfil`
- [ADR-004: The Whole Month in One Response, Paged on the Client](adrs/adr-004.md) — por que a paginação é no cliente

## Deliverables

- `/financeiro/balancete/:mes` renderizando resumo e lançamentos, com filtro e paginação no cliente
- Os estados de carregando, negado, não encontrado, mês aberto e documento anterior ao registro
- O link a partir da seção
- `AUXILIARY_READS` com as entradas novas e o porquê escrito ao lado
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [x] IT-335, IT-336, IT-337 — a tela com resumo e lançamentos, o filtro por categoria, e a paginação no cliente sem segunda requisição
- [x] IT-338, IT-339 — mês aberto identificado como aberto; mês fechado com o selo e os lançamentos do documento
- [x] IT-340 — documento anterior ao registro dos lançamentos diz isso, em vez de mostrar tabela vazia
- [x] IT-342, IT-343 — sem permissão rende acesso negado; competência malformada rende não encontrado com volta
- [x] IT-346 — a rota dentro do roteador real, e ausente da barra lateral

## Notas de execução

- **IT-337 tem uma metade que é fácil esquecer**: além de a segunda página
  mostrar o resto, ela precisa afirmar que **nenhuma requisição nova saiu**. Sem
  isso o caso passaria com paginação no servidor, que é o desenho recusado.
- **`AUXILIARY_READS` lança `ApiError 422` para URL não prevista.** Rode
  `routes.test.tsx` inteiro antes de escrever caso novo, para separar "quebrei"
  de "faltou servir".
- **A justificativa da mudança em `AUXILIARY_READS` vai no código**, ao lado das
  entradas novas, e não só aqui: quem ler aquele arquivo daqui a seis meses
  precisa encontrar a razão no lugar onde a exceção mora.
- O harness de `test/render.tsx` não monta o `ThemeProvider`; `routes.test.tsx`
  monta por conta própria. Tela nova que leia o tema precisa do mesmo cuidado.

## Success Criteria

- Every assigned test case implemented and passing
- `REGISTERED` continua com a mesma contagem de `NAV_ITEMS.length`, sem edição
- Trocar de página na tabela não gera requisição, provado por caso
- `npm --prefix frontend run lint` com os mesmos cinco avisos conhecidos; `typecheck`, `test` e `build` verdes, com a contagem da referência mais os nove desta task
