---
status: completed
title: "A seção Balancete na tela de Financeiro"
type: frontend
complexity: high
---

# Task 4: A seção Balancete na tela de Financeiro

## Overview

Dá corpo ao documento: uma quarta seção em `/financeiro` com seletor de mês, o
quadro de saldos, as duas tabelas por categoria, o resultado, e as ações de
fechar e reabrir guardadas por permissão e por confirmação. Acrescenta também os
dois campos de saldo de abertura ao formulário de condomínio, que é onde o
número entra no sistema pela primeira vez.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- A seção MUST ser uma entrada em `SECTIONS` e um ramo do ternário da página, sem rota, sem item de menu e sem estado na URL — as outras três seções se comportam assim e uma quarta divergente tornaria a tela inconsistente consigo mesma.
- O hook de leitura MUST ser chamado **dentro do componente da seção**, nunca no nível da página. A seção só monta quando é escolhida, e é isso que mantém intocada a superfície de leituras do boot de `/financeiro`.
- `serveFinancial` MUST passar a responder as URLs de fechamento. Ele lança para URL não prevista, então esquecê-lo derruba toda a suíte da tela financeira, e não só os casos novos.
- `AUXILIARY_READS` de `src/test/routes.test.tsx` MUST permanecer intocado, e a task MUST confirmar por caso que nenhuma leitura de fechamento acontece na montagem da rota.
- Os hooks MUST ficar fora da fábrica do ADR-008: há uma leitura e duas ações, e a fábrica monta seis operações sobre um recurso.
- A seção MUST se esconder do alternador quando o leitor não tem `financial-closing:read`, e as ações MUST seguir a permissão de cada uma — `create` para fechar, `manage` para reabrir.
- Fechar MUST pedir confirmação nomeando o mês, e MUST NOT chamar o endpoint antes dela. É um ato que trava dados.
- Um mês sem lançamento MUST dizer isso em palavras, e MUST NOT apresentar um balancete de zeros que parece calculado.
- O saldo de abertura MUST mostrar a sua procedência — herdado de qual mês, ou calculado a partir de qual data de corte.
- O campo de saldo de abertura MUST usar `inputMode="decimal"` sem `type="number"`, e o schema MUST converter vírgula em ponto, como `unit-schema.ts` já faz. `type="number"` engole a vírgula e transforma `1500,50` em `150050`.
- Os dois campos novos MUST seguir a convenção do schema de condomínio: tudo entra e sai como string no formulário, e a conversão acontece em `toCondominiumPayload`.
</requirements>

## Subtasks

- [x] 4.1 Espelhar a forma de resposta em `types/financial.ts`
- [x] 4.2 Escrever os hooks — leitura por mês e as duas mutações — com a chave de consulta e a invalidação
- [x] 4.3 Acrescentar a entrada em `SECTIONS` e os rótulos, inclusive o texto de procedência do saldo
- [x] 4.4 Escrever `closing-section.tsx`: seletor de mês, quadro de saldos, duas tabelas, resultado, estado vazio e estado de carregamento
- [x] 4.5 Ligar as duas ações, com confirmação no fechamento e apresentação da recusa do servidor na própria seção
- [x] 4.6 Ligar o ramo no ternário de `financial-page.tsx` e esconder a seção de quem não pode lê-la
- [x] 4.7 Estender `serveFinancial` com as URLs novas e as fixtures do balancete
- [x] 4.8 Acrescentar os dois campos ao schema, ao formulário e ao cartão de condomínio
- [x] 4.9 Escrever os casos atribuídos, inclusive o que prova que o boot não lê o balancete
- [x] 4.10 Rodar o pipeline do frontend e comparar a contagem

## Implementation Details

Criar:

- `frontend/src/features/financial/components/closing-section.tsx`

Modificar:

- `frontend/src/features/financial/financial-hooks.ts` — `CLOSINGS_KEY`, `useClosing`, `useCloseMonth`, `useReopenMonth`
- `frontend/src/features/financial/financial-labels.ts` — `SECTIONS` e os rótulos
- `frontend/src/features/financial/financial-page.tsx` — um ramo no ternário
- `frontend/src/features/financial/test-utils.ts` — `serveFinancial`
- `frontend/src/types/financial.ts`
- `frontend/src/features/condominiums/condominium-schema.ts`, `components/condominium-form-dialog.tsx`, `components/condominium-record-card.tsx`

O seletor de mês é `<Input type="month" />` cru, como os filtros de Cobranças e
Despesas já usam — não `DatePicker`, não `Combobox`. Rótulos e funções auxiliares
moram em `financial-labels.ts`, e não ao lado do componente: exportar função ao
lado de componente cria aviso de `only-export-components`, e o teto de cinco
avisos não deve subir.

Ver "API Endpoints" e "Core Interfaces" no [`_techspec.md`](_techspec.md) para a
forma da resposta.

### Relevant Files

- `frontend/src/features/financial/financial-page.tsx:45,111-152` — o estado de seção, a `<nav>` do alternador e o ternário; o comentário em `:111-117` explica por que não há `role="tablist"` nem estado na URL
- `frontend/src/features/financial/financial-labels.ts:67-73` — `SECTIONS` e o tipo `SectionId`, que deriva sozinho
- `frontend/src/features/financial/components/expenses-section.tsx` — a seção mais próxima em forma: filtros e ações no próprio arquivo
- `frontend/src/features/financial/financial-hooks.ts:130-164,181-196` — `useChargeSummary` e `useChargePayments`, os precedentes de leitura fora da fábrica, com a justificativa escrita em `:181-183`
- `frontend/src/features/financial/components/charges-section.tsx:364-374` — o filtro de competência, a forma canônica do seletor de mês
- `frontend/src/features/financial/test-utils.ts:167-243` — `serveFinancial`, que lança para URL não prevista, e os inspetores `lastParamsOf`/`allReadRequests`
- `frontend/src/features/financial/financial-page.test.tsx:26-78` — o mock de transporte e os helpers de tabela, inclusive `openSection(label)`
- `frontend/src/lib/permissions.ts:9-26` e `frontend/src/hooks/use-auth.ts` — `can`, a única forma de guardar por permissão neste frontend
- `frontend/src/features/units/unit-schema.ts:50-61` — `optionalDecimalInRange`, o único padrão de schema que converte vírgula em ponto; é o molde do saldo de abertura
- `frontend/src/features/condominiums/condominium-schema.ts:1-10,143-196` — a convenção de tudo string no formulário e a conversão em `toCondominiumPayload`/`toCondominiumFormValues`
- `frontend/src/features/condominiums/components/condominium-form-dialog.tsx:212-220,370-385` — o bloco de `chargeDueDay` e o `FormSection` que agrupa os campos
- `frontend/src/features/condominiums/components/condominium-record-card.tsx:54-56,65-80` — como um campo é exibido; o arquivo ainda não importa `formatCurrency`
- `frontend/src/lib/format.ts:14-18,65-69` — `formatCurrency` e `formatReferenceMonth`

### Dependent Files

- `frontend/src/test/routes.test.tsx:71-101` — `AUXILIARY_READS`; **não deve precisar de entrada nova**, e o caso IT-315 existe para provar isso
- `frontend/src/features/condominiums/condominium-schema.test.ts` — afirma a forma do payload; ganha os dois campos
- `frontend/src/features/condominiums/components/condominium-form-dialog.test.tsx` — pode afirmar a contagem de campos da seção
- `frontend/src/features/financial/financial-page.test.tsx` — a suíte da tela inteira; roda contra o `serveFinancial` estendido

### Related ADRs

- [ADR-008: A Fourth Section Under /financeiro, Not a Menu Item of Its Own](adrs/adr-008.md) — a forma da seção e as duas consequências que são regra de desenho
- [ADR-002: Opening Balance on the Condominium, Inherited Through Closings](adrs/adr-002.md) — de onde vem o saldo, e por que o campo mora no condomínio
- [ADR-003: The Freeze Covers Only Writes That Move Cash](adrs/adr-003.md) — o que as recusas que a tela apresenta significam
- [ADR-005: A Closed Month Is a Stored Document, Not a Recomputed View](adrs/adr-005.md) — por que a tela não muda de forma entre mês aberto e fechado

## Deliverables

- A seção Balancete em `/financeiro`, com mês, saldos, as duas tabelas, resultado e a linha de reconciliação
- Fechar e reabrir, cada um sob a sua permissão, com confirmação no fechamento e a recusa do servidor apresentada na seção
- Estado vazio honesto para mês sem lançamento
- Saldo de abertura e data de corte no formulário e no cartão de condomínio, com a vírgula decimal preservada
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [x] UT-123, UT-124 — o texto de procedência do saldo de abertura, nos dois caminhos
- [x] IT-305, IT-306, IT-307 — a seção rendendo, o seletor de mês refazendo a leitura e o estado vazio
- [x] IT-308, IT-309, IT-310, IT-311 — mês fechado, as duas ações escondidas por permissão e a confirmação antes do fechamento
- [x] IT-312, IT-313 — a seção escondida de quem não pode lê-la, e a recusa 409 apresentada na seção
- [x] IT-315 — a prova de que `/financeiro` não lê o balancete na montagem
- [x] IT-316, IT-317 — o saldo de abertura com vírgula decimal chegando como `1500.5`, e os dois campos no cartão

## Notas de execução

- **IT-316 é o caso que justifica a task inteira não copiar o vizinho.** Os cinco
  campos de dinheiro das telas financeiras usam `type="number"` hoje e engolem a
  vírgula; copiá-los reproduziria o defeito num campo de saldo, onde ele vale por
  todos os meses seguintes. O molde correto é `unit-schema.ts:50-61`.
- **Consertar os cinco campos existentes está fora do escopo.** Está nomeado nos
  riscos do TechSpec. Se for irresistível, é outra task, com os seus próprios
  casos.
- **`serveFinancial` lança para URL não prevista.** Rode a suíte do financeiro
  inteira antes de escrever caso novo, para separar "quebrei" de "faltou servir".
- Rótulo repetido entre o painel e o diálogo quebra `getByLabelText` mesmo com ids
  distintos — escopar em `within(dialog)` resolve, renomear o campo não.

## Execução — o que foi decidido e o que ficou provado

**Um texto repetido virou correção de tela, e não contorno de teste.** O quadro
de saldos e a tabela usavam ambos o rótulo "Entradas", e o caso quebrou por
ambiguidade. A regra deste repositório manda escopar com `within` em vez de
renomear — mas aqui os dois nomes descreviam coisas diferentes com a mesma
palavra: um é o total do mês, o outro é a quebra por categoria. As tabelas
passaram a se chamar "Entradas por categoria" e "Saídas por categoria", e a
tabela é nomeada pelo próprio título (`aria-labelledby`) em vez de repetir o
texto numa `caption`.

**IT-316 morde.** Removendo a conversão de vírgula do schema, `1500,50` deixa de
validar e o formulário nem envia — o caso fica vermelho. O que ele prova é a
conversão no schema, que é a parte testável; o comportamento do `type="number"`
em si é do navegador e o `jsdom` não o reproduz. Por isso o motivo está escrito
no comentário do campo, e não só no teste.

**A seção some do alternador por filtro, e não por `null` no ternário.**
`visibleSections` filtra `SECTIONS` antes do `map`, então quem não tem
`financial-closing:read` não vê o botão — e as outras três seções continuam
intactas, o que IT-312 afirma junto.

**`AUXILIARY_READS` não ganhou entrada nenhuma**, e `routes.test.tsx` não foi
tocado: o diff do arquivo é vazio. O hook do balancete é chamado dentro do
componente da seção, que só monta quando escolhida, e IT-315 afirma isso pela
lista de requisições feitas na montagem de `/financeiro`.

**Pipeline:** 89 arquivos / 1078 casos (de 87 / 1063), lint nos mesmos **5
avisos** conhecidos, typecheck e build limpos.

## Success Criteria

- Every assigned test case implemented and passing
- `/financeiro` abre em Cobranças fazendo exatamente as mesmas requisições de antes desta task, provado por IT-315
- `npm --prefix frontend run lint` com os mesmos cinco avisos conhecidos, nem um a mais
- `typecheck`, `test` e `build` verdes, com a contagem da referência mais os quatorze desta task
