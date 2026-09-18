---
status: pending
title: "O cálculo e as duas rotas de leitura"
type: backend
complexity: high
---

# Task 2: O cálculo e as duas rotas de leitura

## Overview

Transforma as tabelas de movimento no documento: o balancete de um mês aberto,
computado na hora, com saldo de abertura resolvido, receitas e despesas por
categoria, resultado e saldo final. Entrega as duas rotas de leitura e a forma
de resposta que a task_03 vai gravar e a task_04 vai desenhar — a partir daqui o
número existe, ainda que nada o congele.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- A receita MUST sair de `payment.paid_at` e a despesa de `expense.paid_at` com `status = 'PAID'`. Nenhum campo de cobrança — `reference_month`, `amount`, `interest`, `penalty`, `discount`, `paid_amount` — MUST alimentar qualquer total do balancete.
- As linhas por categoria MUST ser produzidas primeiro, e todo total de topo MUST ser a soma dessas linhas em memória. Uma segunda consulta de `SUM` para o mesmo número é proibida: é assim que `charges/summary`, `delinquencyByUnit` e `monthlySeries` acabaram com três definições diferentes de "valor da cobrança".
- Categoria nula MUST virar uma linha explícita "Sem categoria". Descartar o valor é proibido, porque um total que não fecha por linha omitida é pior do que uma linha feia.
- O nome da categoria MUST ser resolvido incluindo removidas, de modo que uma categoria excluída depois não deixe a linha sem nome.
- O saldo de abertura MUST resolver por herança quando o mês anterior está fechado, e por cálculo a partir do saldo de abertura do condomínio e da data de corte caso contrário — informando qual dos dois em `source` e a origem em `from`.
- Uma linha de fechamento com `status = 'OPEN'` MUST ser tratada como mês aberto, exatamente como a ausência de linha.
- As despesas `PAID` com `paid_at` nulo e competência igual ao mês MUST aparecer em `unresolvedPaidExpenses`, e MUST ficar fora de todo total.
- As fronteiras do mês MUST vir de `monthRange`, e não de comparação de texto sobre `YYYY-MM` nem de aritmética local.
- Toda entrada MUST validar `condominiumId` com `assertCondominiumAccess` antes de qualquer consulta.
- `ClosingService` MUST NOT estender `CondominiumScopedService`: não há create/update/delete a herdar, e montar a fábrica exporia seis operações sobre um recurso que tem três.
</requirements>

## Subtasks

- [ ] 2.1 Escrever as agregações no repositório: receita por categoria, despesa por categoria, despesas pagas sem data, e o recorte de inadimplência do mês
- [ ] 2.2 Escrever a montagem de linhas — nomes resolvidos, "Sem categoria", ordenação, e os totais derivados das próprias linhas
- [ ] 2.3 Escrever a resolução do saldo de abertura, com os dois caminhos e a provenência
- [ ] 2.4 Montar `ClosingService.statement`, devolvendo a forma `MonthlyStatement` do TechSpec
- [ ] 2.5 Escrever `ClosingService.list` sobre o repositório, escopado por condomínio
- [ ] 2.6 Criar `closing.routes.ts` com as duas rotas de leitura e seus schemas, e montá-lo em `financial.routes.ts`
- [ ] 2.7 Documentar as rotas no bloco escrito à mão de `swagger.ts`, ao lado das que já estão lá
- [ ] 2.8 Escrever os casos unitários e de integração atribuídos
- [ ] 2.9 Rodar o pipeline do backend e comparar a contagem

## Implementation Details

Criar:

- `backend/src/modules/financial/services/closing.service.ts` — por ora só `statement` e `list`; `close` e `reopen` são da task_03
- `backend/src/modules/financial/closing.routes.ts` — `Router()` comum, não `createCrudRouter`

Modificar:

- `backend/src/modules/financial/repositories/financial-closing.repository.ts` — as agregações
- `backend/src/modules/financial/schemas/financial.schema.ts` — query e params das rotas, reusando o `referenceMonthSchema` privado do arquivo
- `backend/src/modules/financial/financial.routes.ts` — `financialRouter.use('/closings', closingRouter)`
- `backend/src/config/swagger.ts`

As agregações usam o escape hatch `query(scope)` de `BaseRepository`, como todo o
resto do módulo financeiro já faz — `QueryBuilder` com parâmetros nomeados,
nunca SQL cru concatenado. A receita por categoria precisa do join
`payment → charge` para alcançar `charge.category_id`: o pagamento não tem
categoria própria.

Ver "Core Interfaces", "Data Models" e "API Endpoints" no
[`_techspec.md`](_techspec.md).

### Relevant Files

- `backend/src/modules/financial/repositories/charge.repository.ts:65-134` — as três agregações existentes, e as três definições divergentes que este cálculo não deve repetir
- `backend/src/modules/financial/repositories/expense.repository.ts:16-48` — `totals` e `byCategory`, o molde mais próximo do que esta task escreve
- `backend/src/modules/dashboard/dashboard.service.ts:181-199` — resolve nome de categoria num segundo SELECT e mapeia "Sem categoria" em memória; o precedente exato
- `backend/src/shared/repositories/base.repository.ts:135-165` — `query(scope)` e `baseQuery`, que já aplicam tenant e escopo de condomínio
- `backend/src/modules/financial/financial.routes.ts:187-202` — `/payments`, o precedente de rota de leitura servida direto do repositório
- `backend/src/modules/assemblies/assembly.routes.ts:34-69` — o helper `handle` e a forma de uma rota customizada
- `backend/src/shared/services/reference-guard.ts:65-76` — `assertCondominiumAccess`
- `backend/src/shared/http/api-response.ts:21-30` — `ok` e `page`, os dois envelopes
- `backend/tests/integration/financial.spec.ts` — o molde de spec e as personas do seed
- `backend/src/database/seeds/seed.ts:453-597` — as categorias, as 96 cobranças de três competências, os pagamentos e as nove despesas; é sobre esses números que os casos afirmam

### Dependent Files

- `backend/src/config/swagger.ts:258-278` — o bloco manual onde as rotas novas entram
- `frontend/src/types/financial.ts` — o espelho cliente da forma de resposta, escrito na task_04; mudar a forma depois de lá custa dois lados
- `.compozy/tasks/balancete-mensal/task_03.md` — grava exatamente o objeto que esta task produz

### Related ADRs

- [ADR-001: Cash Basis for the Monthly Statement](adrs/adr-001.md) — o que soma e o que não soma, e por quê
- [ADR-002: Opening Balance on the Condominium, Inherited Through Closings](adrs/adr-002.md) — a regra dos dois caminhos do saldo de abertura
- [ADR-004: A Paid Expense Must Carry Its Payment Date](adrs/adr-004.md) — a linha de reconciliação que esta task apresenta
- [ADR-005: A Closed Month Is a Stored Document, Not a Recomputed View](adrs/adr-005.md) — por que a forma de resposta é a mesma nos dois modos

## Deliverables

- `GET /financial/closings/:referenceMonth` devolvendo o balancete completo de um mês aberto, com saldo de abertura, linhas por categoria dos dois lados, resultado, saldo final, inadimplência auxiliar e a linha de reconciliação
- `GET /financial/closings` listando os meses fechados de um condomínio, do mais recente para o mais antigo
- As duas rotas documentadas no Swagger
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [ ] UT-105, UT-106, UT-107, UT-108, UT-109 — resolução do saldo de abertura: herança, cálculo, linha `OPEN` que não herda, corte nulo e o zero legítimo
- [ ] UT-110, UT-111, UT-112, UT-113, UT-114, UT-115 — montagem das linhas: nomes, "Sem categoria", categoria removida, o total que é a soma das linhas, o conjunto vazio e a categoria órfã
- [ ] IT-258, IT-259, IT-260, IT-261, IT-262 — o regime de caixa nas duas pontas, inclusive o pagamento parcial e a despesa paga fora da competência
- [ ] IT-263, IT-264, IT-265, IT-266, IT-267 — categoria nula, a igualdade entre topo e linhas, a identidade do saldo final, a inadimplência fora do resultado e a despesa paga sem data
- [ ] IT-268, IT-269, IT-270, IT-271 — mês sem lançamento, mês malformado, `condominiumId` ausente e condomínio fora do escopo
- [ ] IT-272, IT-273, IT-274 — o saldo de abertura nos três cenários: primeiro mês, herança de um mês fechado e a data de corte que exclui
- [ ] IT-296, IT-297 — a listagem, sua ordem e seu escopo

## Notas de execução

- **IT-273 depende de fechar um mês, que é da task_03.** Escreva-o criando a
  linha de fechamento direto pelo repositório, e não pela rota — a rota ainda não
  existe. O caso afirma a *herança*, não o ato de fechar.
- **IT-267 precisa de uma despesa que o serviço agora recusa.** Crie-a pelo
  `expenseRepository`, contornando o service de propósito: o caso existe para
  provar que uma linha anterior ao invariante continua visível.
- Os números do seed são conhecidos e estáveis (três competências, 32 unidades,
  inadimplentes a cada nove). Prefira afirmar relações — "o total é a soma das
  linhas", "o mês X difere de `charges/summary`" — a fixar constantes que uma
  mudança no seed quebraria sem nada ter regredido.

## Success Criteria

- Every assigned test case implemented and passing
- Um mês com movimento devolve `totalIncome` igual à soma de `income[].total` e `totalExpense` igual à soma de `expense[].total`, por construção e não por coincidência
- Nenhum campo de cobrança aparece em qualquer soma do balancete — conferível por leitura do repositório novo
- `npm --prefix backend run typecheck` e `run test` verdes, com a contagem da referência mais os trinta desta task
