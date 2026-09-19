---
status: pending
title: "A exportação migra para a rota"
type: frontend
complexity: medium
---

# Task 4: A exportação migra para a rota

## Overview

Move impressão e CSV da seção para a tela do documento completo, e faz o CSV
carregar os lançamentos além do resumo. Um lugar só exporta, e exporta tudo o que
mostra — a alternativa, exportar dos dois lugares, produziria dois arquivos com o
mesmo nome e conteúdos diferentes.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- As marcações `print-document` e `print-hide` MUST migrar para a tela da rota. O bloco `@media print` de `index.css` MUST NOT precisar de alteração — ele nomeia classes, não telas, e é isso que torna a migração barata.
- `buildClosingCsv` MUST receber os lançamentos como **segundo argumento opcional**. Com o resumo apenas, ele MUST produzir exatamente o arquivo que produz hoje: um mês cujos lançamentos ainda não chegaram continua exportável.
- O CSV MUST manter um arquivo só — resumo e lançamentos no mesmo, porque uma prestação de contas é um documento.
- As linhas de entrada e de saída MUST carregar rótulos de seção distintos, para que ordenar a planilha por essa coluna separe os dois lados.
- O escape, o separador, o CRLF, o BOM e a vírgula decimal MUST valer também para o bloco novo.
- A seção em `/financeiro` MUST perder os dois botões de exportação, mantendo o link criado na task_03.
- `balancete-mensal` IT-314 MUST NOT ser reimplementado na seção: ele foi realocado e vive aqui como IT-345.
</requirements>

## Subtasks

- [ ] 4.1 Mover as marcações de impressão para a tela da rota
- [ ] 4.2 Estender `buildClosingCsv` com o segundo bloco, mantendo o segundo argumento opcional
- [ ] 4.3 Ligar os botões de imprimir e exportar na tela da rota
- [ ] 4.4 Remover os botões de exportação da seção, preservando o link
- [ ] 4.5 Mover o caso estrutural das marcações de impressão para a tela nova
- [ ] 4.6 Escrever os casos atribuídos
- [ ] 4.7 Conferir a impressão a olho, num mês aberto e num fechado, e registrar o que foi visto
- [ ] 4.8 Rodar o pipeline do frontend e comparar a contagem

## Implementation Details

Modificar:

- `frontend/src/features/financial/closing-csv.ts` — o segundo bloco
- `frontend/src/features/financial/balancete-page.tsx` — os botões e as marcações
- `frontend/src/features/financial/components/closing-section.tsx` — a remoção dos botões
- `frontend/src/features/financial/closing-section.test.tsx` — o caso estrutural sai; o do link fica
- `frontend/src/features/financial/closing-csv.test.ts` — os casos do bloco novo

`index.css` **não** é modificado. Se ele precisar mudar, a migração está sendo
feita de um jeito que o ADR-005 não previu, e vale reler a decisão antes de
seguir.

Ver o [ADR-005](adrs/adr-005.md) e "Testing Approach" no [`_techspec.md`](_techspec.md).

### Relevant Files

- `frontend/src/index.css:201-250` — o bloco de impressão, e as duas classes que ele procura
- `frontend/src/features/financial/components/closing-section.tsx:97,108` — onde as marcações estão hoje: a `<section>` raiz e a div única que embrulha os quatro controles
- `frontend/src/features/financial/closing-csv.ts` — `buildClosingCsv`, `closingCsvFileName` e `downloadClosingCsv`, com a mecânica de `Blob` e âncora
- `frontend/src/features/financial/closing-csv.test.ts` — os cinco casos existentes, que continuam valendo para o resumo
- `frontend/src/features/financial/closing-section.test.tsx:230-247` — o caso estrutural das marcações, que migra
- `frontend/src/features/documents/document-hooks.ts:186-219` — o precedente da entrega de arquivo, do qual o CSV herda a mecânica menos a requisição

### Dependent Files

- `frontend/src/features/financial/balancete-page.tsx` — criado na task_03; ganha os dois botões
- `.compozy/tasks/balancete-mensal/_tests.md` — IT-314 já está marcado como realocado; não reimplementar

### Related ADRs

- [ADR-005: Export and Print Move to the Detail Route](adrs/adr-005.md) — a decisão inteira desta task, e por que exportar dos dois lugares foi recusado

## Deliverables

- Impressão e CSV na tela da rota, e só nela
- CSV com resumo e lançamentos no mesmo arquivo, com os dois lados rotulados
- A seção com o link e sem os botões
- Conferência a olho da impressão registrada nas notas
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [ ] UT-131, UT-132 — o arquivo com os dois blocos; e o arquivo só com o resumo, que continua válido
- [ ] UT-133, UT-134 — o escape do separador numa descrição, e os rótulos distintos das duas seções
- [ ] IT-341 — a seção oferece o link e não oferece mais o `Exportar CSV`
- [ ] IT-344 — as marcações de impressão estão na raiz da rota e nos seus controles
- [ ] IT-345 (realocado de `balancete-mensal` IT-314) — exportar da rota entrega um `Blob` pela âncora, sem requisição, e o arquivo contém os lançamentos

## Notas de execução

- **UT-132 é o caso que protege o argumento opcional.** Se ele virar obrigatório,
  um mês cujos lançamentos ainda não carregaram deixa de ser exportável — e o
  caso fica vermelho, que é o que se quer.
- **Nenhum caso prova que a impressão parece certa.** O `jsdom` não calcula
  layout. O item 4.7 é humano: imprimir um mês aberto e um fechado e registrar o
  que apareceu e o que sumiu. **A task não fecha sem isso** — foi o único item que
  deixou a task_05 da esteira anterior em `pending`, e aqui ele vale de novo.
- O `jsdom` não implementa `URL.createObjectURL` nem o download de um link: os
  dois stubs mais o espião em `HTMLAnchorElement.prototype.click` continuam
  necessários, como em IT-314.
- O caractere BOM precisa entrar como sequência de escape no arquivo de teste. Na
  esteira anterior ele entrou literal e o `no-irregular-whitespace` pegou.

## Success Criteria

- Every assigned test case implemented and passing
- `index.css` não foi modificado
- O CSV de um mês fechado abre no Excel em pt-BR com resumo e lançamentos, colunas separadas e valores reconhecidos como número
- A impressão da rota mostra o documento e esconde os controles, conferida a olho nos dois estados e registrada
- `npm --prefix frontend run lint` com os mesmos cinco avisos; `typecheck`, `test` e `build` verdes, com a contagem da referência mais os sete desta task
