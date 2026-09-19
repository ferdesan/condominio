---
status: completed
title: "Armazenamento e a escrita atômica do fechamento"
type: backend
complexity: critical
---

# Task 1: Armazenamento e a escrita atômica do fechamento

## Overview

Cria a tabela que guarda os lançamentos de um mês fechado e reescreve `close`
para gravá-los junto do documento, numa transação só. É a task de maior risco da
esteira: `close` é a escrita por onde passa toda prestação de contas do produto,
e ela deixa de usar o `BaseRepository` — que não participa de transação — para
falar direto com o `EntityManager`.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- A entidade `FinancialClosingEntry` MUST estender `TenantScopedEntity` e carregar todas as colunas de "Data Models" do TechSpec, com `numericTransformer` em `amount`.
- A FK para `financial_closings` MUST ser `ON DELETE CASCADE`: um fechamento removido não pode deixar lançamentos órfãos apontando para nada.
- `category_name` e `counterpart` MUST ser gravados, e não resolvidos na leitura. Uma categoria renomeada ou um prestador removido depois não podem reescrever um documento já prestado.
- `close` MUST executar suas escritas dentro de `AppDataSource.transaction`, usando o `manager` da transação. `BaseRepository` MUST NOT ser usado ali: o getter dele resolve o repositório global do DataSource (`base.repository.ts:37-40`), então uma chamada por ele não participaria da transação e quebraria a atomicidade sem erro nenhum.
- Cada linha escrita pelo `manager` MUST trazer `tenantId` explícito — é o repositório que normalmente o injeta a partir do escopo, e ele não está no caminho.
- A remoção dos lançamentos anteriores MUST ser incondicional, antes da inserção, sem checar se havia fechamento anterior. Uma guarda que só limpa "quando devia haver" confia na própria contabilidade.
- A auditoria MUST continuar fora da transação, depois do commit, como `charge.service.ts:163-173` já faz. Uma escrita de auditoria é fire-and-forget por desenho e não pode derrubar um fato financeiro.
- `reopen` MUST NOT remover os lançamentos gravados. Enquanto o mês está aberto eles não são lidos; apagá-los tornaria a reabertura destrutiva.
- A migration MUST acrescentar os dois índices por `paid_at` em `payments` e `expenses`, que as agregações existentes já precisariam.
- A ordenação dos lançamentos MUST ser total — data, valor decrescente, `sourceId` — para que duas leituras do mesmo mês fechado devolvam a mesma sequência.
</requirements>

## Subtasks

- [x] 1.1 Criar a entidade `FinancialClosingEntry` com as colunas, os índices e a FK em cascata
- [x] 1.2 Criar o repositório, com leitura por fechamento e remoção por fechamento
- [x] 1.3 Escrever as funções puras que montam um `StatementEntry` a partir de uma linha crua, e a ordenação total
- [x] 1.4 Escrever a migration: tabela, os dois índices de `paid_at`, e o `down()` simétrico
- [x] 1.5 Escrever as leituras de linha nos repositórios de pagamento e despesa, com o join manual para unidade e prestador
- [x] 1.6 Reescrever `close` dentro de `AppDataSource.transaction`, com a remoção incondicional antes da inserção
- [x] 1.7 Acrescentar a contagem de lançamentos ao `after` da auditoria de fechamento
- [x] 1.8 Escrever os casos atribuídos, inclusive o de atomicidade
- [x] 1.9 Rodar `migration:run` e `migration:revert` contra o MySQL local e registrar o resultado
- [x] 1.10 Rodar o pipeline do backend e comparar a contagem

## Implementation Details

Criar:

- `backend/src/modules/financial/entities/financial-closing-entry.entity.ts`
- `backend/src/modules/financial/repositories/financial-closing-entry.repository.ts`
- `backend/src/database/migrations/<timestamp>-ClosingEntries.ts`

Modificar:

- `backend/src/modules/financial/closing-math.ts` — a montagem e a ordenação, ao lado das funções puras que já vivem lá
- `backend/src/modules/financial/repositories/payment.repository.ts` e `expense.repository.ts` — as leituras de linha
- `backend/src/modules/financial/services/closing.service.ts` — `close`

O join para a unidade é manual contra `Charge`, e não pela relação. A razão está
escrita em `payment.repository.ts:25-33`: um join de relação herda o filtro de
exclusão lógica, e uma cobrança removida levaria consigo a identidade de um
pagamento que aconteceu de verdade.

Ver "Data Models" e "Development Sequencing" no [`_techspec.md`](_techspec.md).

### Relevant Files

- `backend/src/shared/repositories/base.repository.ts:37-40` — o getter que resolve o repositório global; é a razão inteira de a transação não poder usá-lo
- `backend/src/shared/repositories/base.repository.ts:89-97` — `update`, que mescla e nunca remove; é por isso que a limpeza precisa ser explícita
- `backend/src/modules/financial/services/charge.service.ts:156-173` — o molde: transação com `manager.create`/`save` em `{ chunk: 100 }`, `tenantId` explícito na linha, e a auditoria fora
- `backend/src/modules/units/unit.service.ts:125-143` — o gêmeo do molde acima
- `backend/src/modules/financial/services/closing.service.ts:108-180` — `close` como está hoje, com a única escrita nas linhas `:159-161`
- `backend/src/modules/financial/services/closing.service.ts:182-226` — `reopen`, que não toca no `breakdown` e não deve tocar nos lançamentos
- `backend/src/modules/financial/closing-math.ts` — `toStatementLines`, `round2` e os rótulos `Sem categoria` / `Categoria removida`, que a montagem reusa
- `backend/src/modules/financial/entities/financial-closing.entity.ts` — a entidade pai e o `breakdown` que fica como está
- `backend/src/database/migrations/1757800000000-FinancialClosings.ts` — o molde de migration desta esteira, com o bloco de colunas comuns e o `down()` simétrico
- `backend/src/modules/financial/entities/payment.entity.ts` e `expense.entity.ts` — as colunas que viram lançamento, e a ausência de índice por `paid_at`
- `backend/tests/integration/balancete-fechamento.spec.ts` — o molde de spec do fechamento, com `registerIsolatedTenant` e o helper `seedMovement`

### Dependent Files

- `backend/tests/integration/balancete.spec.ts` e `balancete-fechamento.spec.ts` — fecham meses; a escrita nova roda em todos esses caminhos
- `backend/src/modules/financial/services/closing.service.ts` — `fromSnapshot` e `statement` continuam como estão; só `close` muda
- `.compozy/tasks/balancete-detalhe/task_02.md` — lê o que esta task grava

### Related ADRs

- [ADR-002: Frozen Movements in a Child Table, Not in the Document JSON](adrs/adr-002.md) — a forma da tabela e o que é congelado
- [ADR-003: Closing Becomes One Transaction, and a Re-Close Replaces Its Movements](adrs/adr-003.md) — a transação, o bypass e a limpeza incondicional

## Deliverables

- `financial_closing_entries` criada pela migration, com a FK em cascata e os índices
- Os dois índices por `paid_at` em `payments` e `expenses`
- `close` escrevendo documento e lançamentos numa transação, com substituição incondicional
- `reopen` inalterado quanto aos lançamentos
- Evidência de `migration:run` e `migration:revert` contra MySQL
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [x] UT-125, UT-126, UT-127, UT-128 — a montagem de um lançamento: entrada com unidade, categoria nula, categoria órfã, saída sem prestador
- [x] UT-129, UT-130 — a ordenação total, inclusive o desempate por `sourceId`
- [x] IT-318, IT-319 — o fechamento grava um lançamento por movimento, e cada um carrega a outra parte
- [x] IT-320, IT-321 — refechar substitui em vez de duplicar, e incorpora o que entrou entre um fechamento e outro
- [x] IT-322 — atomicidade: falhar a inserção não deixa nem os lançamentos nem o documento
- [x] IT-323 — reabrir não apaga os lançamentos gravados

## Notas de execução

- **IT-322 é a canária desta task.** Force a inserção dos lançamentos a falhar —
  um `amount` fora do domínio, ou um espião que lance — e afirme que o mês volta
  a ler como aberto e que a tabela está vazia. Se ele passar com as escritas fora
  da transação, não está provando nada.
- **A migration é o único artefato que nenhuma suíte exercita**, como na esteira
  anterior: os testes criam o schema por `synchronize`. O aceite é a execução
  contra o MySQL local, com o resultado escrito aqui.
- Cada linha escrita pelo `manager` precisa de `tenantId` explícito. Esquecer
  disso não dá erro de tipo — dá linha sem tenant, invisível para todo o resto do
  sistema.

## Success Criteria

- Every assigned test case implemented and passing
- Fechar o mesmo mês duas vezes deixa exatamente um conjunto de lançamentos
- Uma falha no meio da escrita deixa o mês exatamente como estava antes
- `npm --prefix backend run typecheck` e `run test` verdes, com a contagem da referência mais os doze desta task
- `migration:run` e `migration:revert` aplicados contra MySQL sem erro
