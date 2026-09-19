---
status: completed
title: "A leitura dos lançamentos, nos dois modos"
type: backend
complexity: high
---

# Task 2: A leitura dos lançamentos, nos dois modos

## Overview

Expõe os lançamentos de uma competência: serve o gravado quando o mês está
fechado, calcula ao vivo quando está aberto, e diz em qual dos dois estados a
resposta foi produzida. É a mesma regra que `statement` já segue — e é ela que
impede a lista de um mês fechado de discordar do total que aparece acima dela.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- `entries()` MUST servir as linhas gravadas quando a competência está `CLOSED`, e MUST NOT rodar agregação nem consulta de movimento nesse caminho.
- Ausência de linha de fechamento e `status = 'OPEN'` MUST ser o mesmo estado para esta leitura, exatamente como em `statement`.
- A resposta MUST carregar `frozen`: `true` quando as linhas vieram do armazenamento, `false` quando foram calculadas. É o que distingue um documento anterior a esta esteira de um mês sem movimento.
- A rota MUST NOT aceitar `page` nem `perPage`. Aceitar e ignorar convidaria quem chama a acreditar que uma página foi aplicada.
- A soma dos lançamentos de entrada MUST bater com `totalIncome` de `GET /financial/closings/:mes`, e a de saída com `totalExpense` — as duas rotas descrevem um mês só.
- Toda entrada MUST validar `condominiumId` com `assertCondominiumAccess` antes de qualquer consulta.
- A rota MUST exigir `financial-closing:read`, e MUST NOT herdar a permissão de cobrança.
- A ordenação devolvida MUST ser a mesma nos dois modos — quem lê não deve conseguir dizer, pela ordem, se o mês estava aberto.
</requirements>

## Subtasks

- [x] 2.1 Escrever `ClosingService.entries` com os dois caminhos e o `frozen`
- [x] 2.2 Ligar o caminho gravado ao repositório de lançamentos, ordenado
- [x] 2.3 Ligar o caminho calculado às leituras de linha criadas na task_01, resolvendo nomes de categoria, unidade e prestador
- [x] 2.4 Acrescentar a rota e o seu schema de parâmetros, reusando o `referenceMonthSchema` privado do módulo
- [x] 2.5 Documentar a rota no bloco escrito à mão de `swagger.ts`
- [x] 2.6 Escrever os casos atribuídos, inclusive a canária do congelamento
- [x] 2.7 Rodar o pipeline do backend e comparar a contagem

## Implementation Details

Modificar:

- `backend/src/modules/financial/services/closing.service.ts` — `entries`
- `backend/src/modules/financial/closing.routes.ts` — a rota nova, ao lado das quatro existentes
- `backend/src/modules/financial/schemas/financial.schema.ts` — os parâmetros, se precisarem de forma própria
- `backend/src/config/swagger.ts`

A rota é `GET /:referenceMonth/entries`, registrada no mesmo `closingRouter`. Ele
é um `Router` comum e não `createCrudRouter`, então não há conflito de ordem com
rotas de `:id` — mas repare que `/:referenceMonth/entries` precisa conviver com
`/:referenceMonth`, e o Express casa pelo caminho completo.

Ver "API Endpoints" e "Core Interfaces" no [`_techspec.md`](_techspec.md).

### Relevant Files

- `backend/src/modules/financial/services/closing.service.ts:82-98` — `statement`, cuja regra de dois modos esta task repete
- `backend/src/modules/financial/services/closing.service.ts:228-254` — `fromSnapshot`, o precedente de "devolve o gravado, sem agregação"
- `backend/src/modules/financial/services/closing.service.ts:256-310` — `compute`, de onde sai a janela do mês e a resolução de nomes de categoria
- `backend/src/modules/financial/closing.routes.ts` — as quatro rotas existentes e a forma do handler
- `backend/src/shared/services/reference-guard.ts:65-76` — `assertCondominiumAccess`
- `backend/src/shared/http/api-response.ts:21-22` — `ok`, o envelope desta resposta
- `backend/src/shared/utils/date.util.ts` — `monthRange`, a única aritmética de mês do projeto
- `backend/tests/integration/balancete.spec.ts` — o molde de spec de leitura, com asserções de delta em vez de constantes do seed

### Dependent Files

- `frontend/src/types/financial.ts` — o espelho cliente da forma de resposta, escrito na task_03; mudar a forma depois custa dois lados
- `backend/src/config/swagger.ts:258-320` — o bloco manual das rotas do balancete

### Related ADRs

- [ADR-002: Frozen Movements in a Child Table, Not in the Document JSON](adrs/adr-002.md) — por que o mês fechado não recalcula
- [ADR-004: The Whole Month in One Response, Paged on the Client](adrs/adr-004.md) — por que a rota não pagina

## Deliverables

- `GET /financial/closings/:referenceMonth/entries` devolvendo `{ entries, frozen }`, nos dois modos
- A rota documentada no Swagger
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [x] IT-324, IT-325 — o mês fechado serve o gravado, e escrita direta no banco depois do fechamento não muda a lista
- [x] IT-326, IT-327 — o mês aberto calcula, e a soma dos lançamentos bate com o resumo da mesma competência
- [x] IT-328, IT-329 — mês sem movimento devolve lista vazia e não erro; a ordem é por data
- [x] IT-330, IT-331, IT-332, IT-333 — competência malformada, condomínio ausente, condomínio fora do escopo e permissão faltando
- [x] IT-334 — documento fechado sem lançamentos gravados responde `frozen: true` com lista vazia, distinguível de um mês sem movimento

## Notas de execução

- **IT-325 é a canária desta task.** Feche o mês, insira um pagamento direto pelo
  `paymentRepository` com data dentro dele, e afirme que a lista não mudou. Se
  ela mudar, o caminho gravado não está sendo servido — é o mesmo defeito que
  `balancete-mensal` IT-276 pega no total, agora apontado para a lista.
- **IT-334 precisa de um fechamento sem lançamentos.** Crie a linha de fechamento
  direto pelo repositório, com `totalIncome` acima de zero e nenhum lançamento —
  é exatamente o estado do documento que já existe no banco de desenvolvimento.
- **IT-327 é o que amarra as duas rotas.** Ele lê as duas e compara; se a soma
  divergir, uma delas está respondendo sobre outro mês.

## Success Criteria

- Every assigned test case implemented and passing
- Um mês fechado lido duas vezes, com escrita direta no banco entre as leituras, devolve a mesma lista
- A soma dos lançamentos e os totais do resumo concordam, provado por caso
- `npm --prefix backend run typecheck` e `run test` verdes, com a contagem da referência mais os onze desta task
