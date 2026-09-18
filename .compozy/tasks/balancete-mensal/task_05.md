---
status: pending
title: "Exportação: impressão e CSV"
type: frontend
complexity: medium
---

# Task 5: Exportação: impressão e CSV

## Overview

Tira o balancete da tela: uma folha de impressão que transforma a seção no
documento que a assembleia lê, e um CSV montado no navegador a partir do que já
está carregado, para a contabilidade. Nenhuma dependência nova, nenhuma rota
nova — o payload da tela já é o documento inteiro.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- O construtor do CSV MUST ser uma função pura sobre o payload, em módulo próprio, e MUST NOT viver ao lado do componente — função exportada junto de componente cria aviso de `only-export-components`, e o teto de cinco avisos não sobe.
- O CSV MUST usar ponto e vírgula como separador, CRLF como fim de linha, BOM de UTF-8 no início e vírgula decimal: o consumidor é Excel em pt-BR.
- O CSV MUST carregar as mesmas linhas da tela, na mesma ordem, incluindo "Sem categoria" e a linha de reconciliação.
- Um nome de categoria que contenha o separador MUST ser escapado, de modo que a coluna não se parta.
- A folha de impressão MUST esconder a casca, o menu, o alternador de seções, os filtros e todos os botões, e MUST preservar o mês, o nome do condomínio, a procedência do saldo de abertura e o estado aberto ou fechado.
- O `@media print` MUST ficar fora de qualquer `@layer`, no fim de `index.css`, como irmão do `@media (prefers-reduced-motion: reduce)` que já está lá.
- A entrega do arquivo MUST seguir a mecânica que `downloadDocument` já estabeleceu — `Blob`, `createObjectURL`, âncora, `revokeObjectURL` — **sem requisição alguma**.
- Nenhuma dependência de runtime nova MUST ser acrescentada.

</requirements>

## Subtasks

- [x] 5.1 Escrever `buildClosingCsv` como função pura, com escape, separador, BOM e vírgula decimal
- [x] 5.2 Ligar o botão de exportar, entregando o arquivo pela mecânica de blob e âncora
- [x] 5.3 Escrever o bloco `@media print` no fim de `index.css`
- [x] 5.4 Marcar na seção o que sobrevive à impressão e o que desaparece
- [ ] 5.5 Conferir a impressão a olho, em um mês aberto e um fechado, e registrar o que foi visto
- [x] 5.6 Escrever os casos atribuídos
- [x] 5.7 Rodar o pipeline do frontend e comparar a contagem

## Implementation Details

Criar:

- `frontend/src/features/financial/closing-csv.ts`

Modificar:

- `frontend/src/features/financial/components/closing-section.tsx` — os dois botões e as marcações de impressão
- `frontend/src/index.css` — o bloco `@media print`, após a linha final do arquivo

O `index.css` tem hoje 200 linhas: `@tailwind` (1-3), `@layer base` (15-156),
`@layer components` (158-177), `@layer utilities` (179-187) e um único `@media`,
o de `prefers-reduced-motion` (189-199). Não existe nenhuma classe de impressão no
projeto, e a variante `print:` do Tailwind está disponível e nunca foi usada — as
duas formas são aceitáveis, desde que o bloco global fique onde o arquivo já põe
media queries globais.

Ver [ADR-006](adrs/adr-006.md) para o formato e o que ele recusou.

### Relevant Files

- `frontend/src/index.css:189-199` — o único `@media` do arquivo, e o lugar onde o novo é irmão
- `frontend/src/features/documents/document-hooks.ts:186-219` — `downloadDocument`: a âncora, o `download`, o `revokeObjectURL` no `finally`, e a razão de não ser `<a href>`
- `frontend/src/features/documents/documents-page.test.tsx:25-36` — como um teste que baixa arquivo monta o mock
- `frontend/src/features/documents/test-utils.ts:88` — o duble de blob
- `frontend/src/features/financial/financial-labels.ts` — onde rótulos e funções auxiliares moram, para não criar aviso de lint
- `frontend/src/lib/format.ts:14-18` — `formatCurrency`, que formata para a tela; o CSV formata por conta própria, porque o destino é planilha e não leitura
- `frontend/tailwind.config.js` — sem nada de impressão; a variante `print:` vem do padrão

### Dependent Files

- `frontend/src/features/financial/components/closing-section.tsx` — ganha os dois botões e as marcações; é a task_04 quem o cria
- `frontend/src/test/setup.ts` — se os stubs de `URL.createObjectURL` ainda não estiverem globais, o caso os instala no próprio arquivo

### Related ADRs

- [ADR-006: Export by Browser Print and Client-Side CSV](adrs/adr-006.md) — a decisão inteira desta task, e por que o PDF no servidor foi recusado

## Deliverables

- `buildClosingCsv`, pura e testada, produzindo um arquivo que o Excel em pt-BR abre com as colunas certas
- Botão de exportar entregando o arquivo sem tocar na rede
- Folha de impressão que transforma a seção no documento, conferida a olho nos dois estados
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [x] UT-118, UT-119, UT-120, UT-121, UT-122 — o CSV: estrutura, vírgula decimal, escape do separador, as linhas especiais, o BOM e o CRLF
- [x] IT-314 — o botão entregando um `Blob` pela âncora, sem requisição

## Notas de execução

- **Nenhum caso prova que a impressão parece certa.** O `jsdom` não calcula
  layout, e por isso a conferência é humana: imprimir um mês aberto e um fechado,
  e registrar nas notas o que apareceu e o que sumiu. O que pode errar de forma
  que importe — o conteúdo do arquivo — é o CSV, e esse é testado como função.
- **O `jsdom` não implementa `URL.createObjectURL` nem o download de um link.** Os
  dois stubs mais um spy em `HTMLAnchorElement.prototype.click` mantêm IT-314
  silencioso; sem o spy, o clique vira tentativa de navegação e polui o log.
- `toContain` sobre `textContent` não normaliza espaço rígido: `Intl.NumberFormat`
  separa "R$" do número com U+00A0. Se o caso comparar texto de moeda, compare só
  os dígitos.

## Execução — feito, provado, e o que falta

**O status continua `pending` de propósito.** Tudo o que se pode implementar e
verificar está feito e os seis casos passam; o que falta é o item 5.5, a
conferência a olho da impressão, que exige um navegador e uma pessoa. Marcar a
task como concluída diria que um critério de aceite declarado foi verificado, e
ele não foi.

**O que ficou provado:**

- `buildClosingCsv` é pura, e os cinco casos afirmam string exata — cabeçalho,
  ordem das linhas, vírgula decimal com duas casas, escape do `;`, BOM e CRLF.
- **IT-314 morde:** removendo o `anchor.click()`, o caso fica vermelho.
- Um caso a mais, não atribuído, prende a **estrutura de que a folha depende**:
  a seção carrega `print-document` e o bloco de controles carrega `print-hide`.
  O `jsdom` não calcula layout, mas a marcação some em silêncio se alguém a
  remover, e isso é testável.

**O título da seção passou a carregar o nome do condomínio.** Na impressão a
casca inteira desaparece, e um balancete que não diz de qual condomínio ele é não
serve para prestar contas. O auxiliar do teste passou a casar o título por
trecho.

**Duas armadilhas de escrita, ambas pegas pelo pipeline:** o caractere BOM entrou
literal no arquivo de teste em vez da sequência de escape (`no-irregular-whitespace`
pegou), e o dublê de `createObjectURL` sem tipo de argumento quebrou o typecheck
ao ler `mock.calls[0][0]`.

**Pipeline:** 90 arquivos / 1086 casos (de 89 / 1078), lint nos mesmos **5
avisos**, typecheck e build limpos.

### O que a conferência humana precisa olhar

Abrir `/financeiro` → Balancete, e mandar imprimir (Ctrl+P) num mês aberto e num
fechado. Devem **aparecer**: o título com o nome do condomínio, a competência, o
selo de aberto/fechado, a procedência do saldo, as duas tabelas e o bloco de
resultado. Devem **sumir**: menu lateral, cabeçalho, o alternador de seções, o
seletor de mês e todos os botões.

## Success Criteria

- Every assigned test case implemented and passing
- O CSV de um mês com categoria nula e com linha de reconciliação abre no Excel em pt-BR com as colunas separadas e os valores reconhecidos como número
- A impressão de um mês fechado mostra mês, condomínio, procedência do saldo e o estado, e não mostra menu, alternador nem botão
- `npm --prefix frontend run lint` com os mesmos cinco avisos, `typecheck`, `test` e `build` verdes, com a contagem da referência mais os seis desta task
