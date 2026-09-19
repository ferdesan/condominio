# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- **task_02 entregue** (rota, servico e os 11 casos). Backend verde: lint 0,
  typecheck 0, 30 suites / 366 casos.
- **task_01 NAO foi executada.** A task_02 rodou antes dela e criou apenas as
  superficies de leitura que consome. Ver "Handoffs".

## Shared Decisions

- **A resposta da rota e `{ entries, frozen }`.** A assinatura em prosa do
  TechSpec ("Core Interfaces") diz `Promise<StatementEntry[]>`; a tabela "API
  Endpoints", o requisito 3 da task_02 e a task_03 dizem o objeto. Vale o
  objeto. `frontend/src/types/financial.ts` (task_03) espelha esta forma.
- **`page` e `perPage` sao recusados com 422**, nao descartados em silencio —
  ADR-004 diz "does not accept", e descartar e o "aceitar e ignorar" que ela
  proibe. Quem mexer no schema da rota nao deve trocar `.strict()` por um
  `z.object` comum.
- **A ordenacao total (`occurredAt` ASC, `amount` DESC, `sourceId`) roda em
  memoria**, em `sortStatementEntries`, nos dois modos de leitura. Quem gravar
  os lancamentos na task_01 deve usar a mesma funcao, e nao reimplementar a
  ordem no SQL.

## Shared Learnings

- `POST /financial/charges/:id/payments` responde `{ charge, payment }`: o id do
  pagamento e `body.data.payment.id`.
- Escrever uma linha de apoio direto pelo repositorio, quando a rota que a
  produz pertence a outra task, ja e pratica desta base — `balancete.spec.ts`
  IT-273 e IT-296 fazem isso com a linha de fechamento.

## Open Risks

- **A entidade `FinancialClosingEntry` existe sem migration.** Os testes criam o
  schema por `synchronize`, entao a suite nao percebe; um ambiente implantado
  nao teria a tabela. A migration e entregavel da task_01 (subtarefa 1.4), junto
  dos dois indices por `paid_at`.

## Handoffs

**O que a task_01 ainda deve entregar** (a task_02 deliberadamente nao invadiu):

- `close` reescrito dentro de `AppDataSource.transaction`, com remocao
  incondicional antes da insercao (subtarefas 1.6 e 1.2 — o
  `deleteByClosing` do repositorio ainda nao existe, foi deixado para quem tem
  caller e caso).
- A migration da tabela e os dois indices por `paid_at` (1.4), com `migration:run`
  e `migration:revert` contra MySQL (1.9).
- A contagem de lancamentos no `after` da auditoria de fechamento (1.7).
- Os casos UT-125 a UT-130 e IT-318 a IT-323.

**O que a task_02 ja deixou pronto para ela**: a entidade com todas as colunas
de "Data Models", `findByClosing` ordenado, `toStatementEntry` /
`sortStatementEntries` em `closing-math.ts` (UT-125 a UT-130 pousam neles sem
mudanca), e `movementsInRange` / `paidMovementsInRange` nos repositorios de
pagamento e despesa.

**Consequencia nos testes da task_02**: como `close` ainda nao grava lancamentos,
IT-324, IT-325 e IT-334 semeiam as linhas pelo repositorio. Quando a task_01
entrar, vale reapontar IT-324 e IT-325 para o `close` de verdade.
