# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- **task_01 e task_02 entregues.** O backend do balancete detalhado esta
  completo: tabela, migration, escrita atomica no fechamento, rota e leitura nos
  dois modos. Backend verde: lint 0, typecheck 0, **30 suites / 378 casos**.
- Proxima: **task_03** (a tela na rota propria). O backend nao lhe deve nada.

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
  memoria**, em `sortStatementEntries`, nos tres caminhos — o que grava no
  fechamento e os dois modos de leitura. Nao reimplementar a ordem no SQL.
- **`close` grava na ordem documento -> limpeza -> insercao, e nao na ordem
  literal da ADR-003.** A ADR lista a limpeza primeiro, mas o lancamento e filho
  do fechamento: num primeiro fechamento nao ha `closing_id` para apagar por ele
  nem para apontar, e a FK recusaria o filho antes do pai. Seguir a letra
  exigiria exatamente a guarda `if (existing)` que a ADR proibe. As invariantes
  dela — atomicidade e limpeza incondicional **antes** da insercao — estao
  preservadas. Quem ler a ADR e achar o codigo errado deve ler isto antes.

## Shared Learnings

- `POST /financial/charges/:id/payments` responde `{ charge, payment }`: o id do
  pagamento e `body.data.payment.id`.
- **Um caso que afirma uma ausencia precisa da contraprova no mesmo `it`.**
  IT-322 afirma que nem o documento nem os lancamentos ficam depois da falha —
  o que um `close` quebrado por qualquer outra razao tambem satisfaria. O
  fechamento bem-sucedido logo em seguida e o que da sentido ao caso.
- Para derrubar so uma escrita dentro de uma transacao, o espiao vai em
  `EntityManager.prototype.save` filtrado por `instanceof <Entidade>`. sqljs faz
  rollback de verdade, entao o caso mede a transacao.

## Open Risks

- Nenhum aberto no backend. O risco anterior — entidade sem migration — foi
  fechado pela `1757900000000-ClosingEntries`, verificada contra o MySQL local
  nos dois sentidos.

## Handoffs

**Para a task_03**, o backend entrega: `GET /financial/closings/:mes/entries`
respondendo `{ entries, frozen }` nos dois modos, documentada no Swagger, e o
fechamento gravando um lancamento por movimento.

**Nao sobra nada da task_01.** O que a task_02 tinha deixado em aberto —
transacao, `deleteByClosing`, migration com os dois indices por `paid_at`,
contagem na auditoria — foi entregue, e IT-324/IT-325 deixaram de semear linhas
pelo repositorio: leem o que o `close` de verdade gravou, com as afirmacoes
originais intactas.
