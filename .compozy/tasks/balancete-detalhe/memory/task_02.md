# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

`GET /financial/closings/:referenceMonth/entries` devolvendo `{ entries, frozen }`
nos dois modos, documentada no Swagger, com IT-324 a IT-334. Entregue.

## Important Decisions

- **`entries()` devolve `{ entries, frozen }`, e nao `StatementEntry[]`.** A
  assinatura em prosa do TechSpec ("Core Interfaces") diz array puro, mas a
  tabela "API Endpoints" e o requisito 3 da task exigem o objeto. Derivar
  `frozen` na rota custaria uma segunda leitura de status e deixaria rota e
  servico poderem discordar sobre qual modo produziu as linhas.
- **`page`/`perPage` sao recusados (422), e nao descartados.** Um `z.object`
  comum remove chave desconhecida em silencio, que e exatamente o "aceitar e
  ignorar" que ADR-004 proibe. Dai `closingEntriesQuerySchema =
  closingQuerySchema.strict()`. Nenhum caso atribuido cobre isso — foi conferido
  a mao (422, `unrecognized_keys`).
- **A ordenacao total roda em memoria nos dois caminhos**, alem do `ORDER BY` do
  repositorio. A colacao do MySQL pode ordenar `source_id` diferente do
  comparador JS, e o requisito e que quem le nao consiga dizer pela ordem se o
  mes estava aberto.
- **`occurred_at` ficou `datetime(6)`**, como a tabela "Data Models" pede, e nao
  o `datetime` simples do resto do modulo. sqljs aceita.

## Learnings

- `POST /financial/charges/:id/payments` responde `{ charge, payment }` — o id do
  lancamento e `body.data.payment.id`. Ler `body.data.id` da `undefined` e o
  caso falha sem dizer por que.
- O repositorio de lancamentos nao leva `condominiumField`: a linha nao guarda
  condominio, e o `BaseRepository` filtraria por uma coluna inexistente.

## Files / Surfaces

Criados: `entities/financial-closing-entry.entity.ts`,
`repositories/financial-closing-entry.repository.ts`,
`tests/integration/balancete-lancamentos.spec.ts`.
Modificados: `closing-math.ts`, `services/closing.service.ts`,
`closing.routes.ts`, `schemas/financial.schema.ts`,
`repositories/payment.repository.ts`, `repositories/expense.repository.ts`,
`config/swagger.ts`.

## Errors / Corrections

- Nenhuma correcao de rumo. IT-326 falhou uma vez pelo `body.data.id` acima.

## Ready for Next Run

- Pipeline do backend verde: lint 0, typecheck 0, **30 suites / 366 casos**
  (referencia 355 + os 11 desta task).
- Mutacao conferida: forcar o caminho fechado a recalcular derruba IT-324,
  IT-325 e IT-334 — a canaria morde.
- **A task_01 nao estava implementada quando esta rodou.** Ver o MEMORY.md
  compartilhado: o que sobrou dela esta listado la.
