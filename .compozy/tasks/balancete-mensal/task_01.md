---
status: pending
title: "Fundação de dados e o invariante da despesa paga"
type: backend
complexity: high
---

# Task 1: Fundação de dados e o invariante da despesa paga

## Overview

Cria tudo o que o cálculo do balancete precisa existir antes de poder estar
certo: a tabela que guarda o documento fechado, as duas colunas de saldo de
abertura no condomínio, o recurso `financial-closing` no catálogo de permissões,
o helper de fronteira de mês, e a migration que leva os três ao MySQL — inclusive
aos papéis já gravados. No mesmo movimento fecha a brecha que deixa uma despesa
ser `PAID` sem data de pagamento, porque uma linha nesse estado não pertence a
mês nenhum num balancete de caixa e a task_02 somaria sobre um conjunto que perde
valor em silêncio.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- A entidade `FinancialClosing` MUST estender `TenantScopedEntity` e carregar todas as colunas da tabela em "Data Models" do TechSpec, com `numericTransformer` em todo campo monetário e `simple-json` em `breakdown`.
- O índice único `(tenant_id, condominium_id, reference_month)` MUST existir, porque é ele que torna o refechamento uma atualização da mesma linha em vez de uma segunda linha.
- As duas colunas novas de `condominiums` MUST ter default (`0` e `NULL`), de modo que toda linha existente continue legível sem backfill.
- `financial-closing` MUST ser acrescentado a `RESOURCES`, e nada além disso MUST ser escrito à mão no catálogo: as cinco permissões e a matriz de papéis derivam do array.
- `monthRange(referenceMonth)` MUST viver em `shared/utils/date.util.ts` e ser a única fonte de fronteira de mês do projeto — a guarda da task_03 e as agregações da task_02 consomem esta função, e não recalculam.
- `monthRange` MUST recusar um mês impossível com `RangeError` em vez de normalizá-lo silenciosamente para o mês seguinte.
- A migration MUST criar a tabela, acrescentar as duas colunas e anexar `financial-closing:manage` ao JSON de permissões dos papéis de sistema `ADMIN` e `SINDICO`, tudo no mesmo `up()`, com `down()` simétrico.
- `ExpenseService` MUST recusar com `BusinessRuleError` (409) o estado resultante em que `status` é `PAID` e `paidAt` é nulo, tanto na criação quanto na edição.
- A verificação MUST ler o estado **resultante**, e não o corpo enviado: marcar `PAID` numa linha que já tem `paidAt` passa; limpar `paidAt` numa linha já `PAID` falha.
- `ExpenseService.pay` MUST continuar funcionando sem alteração de contrato — ele já grava os dois campos juntos.
</requirements>

## Subtasks

- [ ] 1.1 Criar a entidade `FinancialClosing` com as colunas, o índice único e a FK do TechSpec
- [ ] 1.2 Criar `FinancialClosingRepository` com a configuração de `BaseRepository` (alias, campos filtráveis, ordenação padrão por `referenceMonth` descendente) e um `findByMonth`
- [ ] 1.3 Acrescentar `opening_balance` e `opening_balance_date` à entidade e ao schema Zod de condomínio, seguindo o precedente de `chargeDueDay` e `syndicTermEndsAt`
- [ ] 1.4 Acrescentar `financial-closing` a `RESOURCES` e conferir que ADMIN e SINDICO passam a recebê-lo por derivação, sem edição manual da matriz
- [ ] 1.5 Escrever `monthRange(referenceMonth)` em `date.util.ts`, com a recusa de mês impossível
- [ ] 1.6 Escrever a migration: `CREATE TABLE`, os dois `ALTER TABLE` e o patch de permissão dos papéis de sistema, com `down()` simétrico
- [ ] 1.7 Fechar a brecha do ADR-004 em `prepareCreate` e `prepareUpdate` de `ExpenseService`
- [ ] 1.8 Rodar `npm --prefix backend run migration:run` contra MySQL e conferir tabela, colunas e o array de permissões dos dois papéis; registrar o resultado
- [ ] 1.9 Rodar o pipeline de verificação do backend (typecheck e testes) e comparar a contagem com a referência

## Implementation Details

Criar:

- `backend/src/modules/financial/entities/financial-closing.entity.ts`
- `backend/src/modules/financial/repositories/financial-closing.repository.ts`
- `backend/src/database/migrations/<timestamp>-FinancialClosings.ts`

Modificar:

- `backend/src/modules/condominiums/condominium.entity.ts` e `condominium.schema.ts`
- `backend/src/shared/constants/resources.ts`
- `backend/src/shared/utils/date.util.ts`
- `backend/src/modules/financial/services/expense.service.ts`
- `backend/src/config/data-source.ts` — apenas se a lista de entidades for explícita; conferir antes

Ver "Data Models" e "Development Sequencing" no [`_techspec.md`](_techspec.md)
para o desenho da tabela e a ordem. A migration segue o molde de
`1757700000000-LgpdTables.ts`: bloco de colunas comuns reaproveitado, `engine`
fixo, nomes `IDX_`/`UQ_`/`FK_`, e `down()` derrubando na ordem inversa.

O patch de permissão é um read-modify-write em TypeScript sobre as linhas de
`roles`, e não uma função JSON do MySQL — a coluna é `simple-json`, que o TypeORM
persiste como texto.

### Relevant Files

- `backend/src/modules/financial/entities/expense.entity.ts` — `paid_at` já existe (`:38-39`); é o campo que o balancete soma
- `backend/src/modules/financial/schemas/financial.schema.ts:84-100` — onde a brecha está: `status` aceito na criação e `paidAt` opcional
- `backend/src/modules/financial/services/expense.service.ts:31-53` — `prepareCreate` e `prepareUpdate`, os dois pontos da correção
- `backend/src/shared/entities/tenant-scoped.entity.ts` e `base.entity.ts` — a base que a entidade nova estende
- `backend/src/shared/entities/transformers.ts:10-20` — `numericTransformer`, obrigatório em coluna `decimal`
- `backend/src/modules/condominiums/condominium.entity.ts:62-66` — `syndic_term_ends_at` e `charge_due_day`, os dois precedentes de forma
- `backend/src/shared/constants/resources.ts:2-39` e `roles.ts:26-62` — o catálogo e a derivação dos papéis
- `backend/src/database/migrations/1757700000000-LgpdTables.ts` — o molde da migration
- `backend/src/shared/utils/date.util.ts` — `REFERENCE_MONTH`, `dayjs` com o plugin utc

### Dependent Files

- `backend/tests/unit/permissions.spec.ts` — afirma o catálogo e a matriz de papéis; um recurso novo muda o que ele conta
- `backend/src/database/seeds/seed.ts:105-126` — semeia os papéis de sistema; o array passa a incluir o recurso novo em base nova
- `backend/src/modules/roles/role.service.ts:73-76` — `catalog()` devolve `PERMISSION_CATALOG`, que cresce sozinho
- `frontend/src/features/roles/` — a matriz de permissões monta as linhas do catálogo do servidor; o recurso novo aparece em "Outros" com o identificador técnico até ganhar rótulo
- `backend/tests/integration/financial.spec.ts` — exercita criação e edição de despesa; o invariante pode alcançar um caso existente

### Related ADRs

- [ADR-002: Opening Balance on the Condominium, Inherited Through Closings](adrs/adr-002.md) — as duas colunas e por que moram no condomínio
- [ADR-004: A Paid Expense Must Carry Its Payment Date](adrs/adr-004.md) — o invariante, e por que uma esteira de feature tem licença para corrigir produção aqui
- [ADR-005: A Closed Month Is a Stored Document, Not a Recomputed View](adrs/adr-005.md) — a forma da tabela e o significado da ausência de linha
- [ADR-007: The New Permission Reaches Seeded Roles Through a Data Migration](adrs/adr-007.md) — por que a migration toca dados, e o que acontece se não tocar

## Deliverables

- Tabela `financial_closings` criada pela migration, com o índice único e a FK
- `opening_balance` e `opening_balance_date` em `condominiums`, com default e aceitos pelo schema
- `financial-closing` no catálogo, com ADMIN e SINDICO recebendo `manage` por derivação em base nova e por migration em base existente
- `monthRange` como única fonte de fronteira de mês
- `ExpenseService` recusando `PAID` sem `paidAt`, na criação e na edição
- Evidência da execução de `migration:run` contra MySQL, com o antes e o depois do array de permissões de um papel
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [ ] UT-101, UT-102, UT-103, UT-104 — `monthRange`: o mês comum, a virada de ano, o fevereiro bissexto e a recusa do mês impossível
- [ ] IT-298, IT-299, IT-300, IT-301 — o invariante do ADR-004 nos quatro estados: criar pago sem data, marcar pago sem data, marcar pago com data já presente, e limpar a data de uma linha paga
- [ ] IT-302 — regressão: `POST /financial/expenses/:id/pay` continua gravando status e data juntos

## Notas de execução

- **A migration é o único artefato que nenhuma suíte exercita.** `data-source.ts:17-24`
  não carrega migrations em teste: o schema vem de `synchronize: true` e os papéis
  de um seed que roda do zero. Uma migration errada passa em tudo. O aceite dela é
  a execução manual contra MySQL, e o resultado vai escrito nas notas da task.
- **Não presuma que o catálogo cresce sozinho em base existente.** Ele cresce no
  código; o que está gravado em `roles.permissions` não muda sem o patch. Este é o
  ponto inteiro do ADR-007.
- Se `backend/tests/unit/permissions.spec.ts` quebrar pela contagem de recursos,
  a correção é atualizar a expectativa, não isentar o recurso novo.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix backend run typecheck` e `npm --prefix backend run test` verdes, com a contagem de casos igual à referência mais os nove desta task
- `migration:run` aplicado contra MySQL sem erro, e `migration:revert` devolvendo o banco ao estado anterior — tabela ausente, colunas ausentes, permissão removida dos dois papéis
- Nenhuma alteração de comportamento em rota alguma além da recusa nova de despesa paga sem data
