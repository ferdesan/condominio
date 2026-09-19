# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Armazenamento e escrita atomica do fechamento: migration da tabela mais os dois
indices por `paid_at`, `deleteByClosing`, `close` dentro de
`AppDataSource.transaction`, contagem na auditoria, e UT-125 a UT-130 / IT-318 a
IT-323. Entregue.

Subtarefas 1.1, 1.3 e 1.5 ja estavam feitas pela task_02, que rodou antes —
entidade, `toStatementEntry`/`sortStatementEntries` e as leituras de linha. Nao
foram refeitas.

## Important Decisions

- **A ordem das escritas e documento -> limpeza -> insercao, e nao a ordem
  literal da ADR-003.** A ADR lista a limpeza primeiro, mas o lancamento e filho
  do fechamento: num primeiro fechamento nao existe `closing_id` para apagar por
  ele nem para apontar, e a FK recusaria o filho antes do pai. Seguir a letra
  exigiria a guarda `if (existing)` que a propria ADR proibe. As duas invariantes
  que ela compra — atomicidade, e limpeza incondicional antes da insercao —
  ficam preservadas.
- **`deleteByClosing` recebe o `EntityManager` como primeiro parametro.** Assim
  a subtarefa 1.2 tem a remocao no repositorio (onde o resto do SQL do modulo
  vive) sem que a chamada passe pelo getter do `BaseRepository`. Remocao fisica,
  nao logica: as linhas sao substituidas inteiras a cada fechamento.
- **O documento gravado e relido por `this.closings.findById` depois do commit**,
  em vez de devolvido de dentro da transacao. `manager.create` nao aplica default
  de coluna, e devolver a entidade em memoria mudaria silenciosamente campos como
  `reopenCount` na resposta do primeiro fechamento.
- **O `before` da auditoria e capturado antes da transacao.**
  `manager.merge(FinancialClosing, existing, document)` muta `existing`; lido
  depois, o estado de chegada apareceria no rastro como se fosse o de partida.

## Learnings

- **IT-322 so prova alguma coisa com contraprova junto.** O caso afirma a
  ausencia de duas coisas, e um `close` quebrado por qualquer outra razao
  satisfaria isso. O fechamento sem o espiao, no mesmo `it`, e o que fecha a
  brecha.
- **O espiao certo e `EntityManager.prototype.save` filtrado por
  `instanceof FinancialClosingEntry`.** Derruba so a insercao dos lancamentos e
  deixa a gravacao do documento passar, dentro do mesmo bloco — e o que faz o
  caso medir a transacao em vez da ordem das chamadas. sqljs faz rollback de
  verdade.
- **Mutacao conferida**: com a insercao fora da transacao, IT-322 falha com a
  linha de `financial_closings` sobrevivendo. A canaria morde.
- Data ISO sem zero a esquerda (`2026-08-5`) vira `Invalid Date`, e o
  comparador devolve `NaN` — o `sort` nao lanca, so devolve ordem errada.

## Files / Surfaces

Criado: `database/migrations/1757900000000-ClosingEntries.ts`.
Modificados: `repositories/financial-closing-entry.repository.ts` (+
`deleteByClosing`), `services/closing.service.ts` (`close`, e o comentario de
`reopen`), `tests/unit/closing-math.spec.ts`,
`tests/integration/balancete-fechamento.spec.ts`,
`tests/integration/balancete-lancamentos.spec.ts` (IT-324/IT-325 reapontados).

## Errors / Corrections

- IT-324 quebrou no pipeline completo: com `close` gravando de verdade, a
  semeadura manual da task_02 somava uma terceira linha. Corrigido reapontando o
  `beforeAll` para o `close` real, com as afirmacoes de IT-324 e IT-325
  inalteradas — que e o sinal de que a troca foi honesta.
- Um comentario afirmava que a ordem por data nao coincidia com a ordem por
  valor no cenario semeado; coincidia. Reescrito, e a semeadura passou a pagar na
  ordem inversa a do documento para que a afirmacao vizinha valha.

## Ready for Next Run

- Backend verde: lint 0, typecheck 0, **30 suites / 378 casos** (366 + os 12).
- `migration:run`, `migration:revert` e `migration:run` de novo contra o MySQL
  local, sem erro. Conferido no catalogo: FK `CASCADE`,
  `IDX_financial_closing_entries_closing (closing_id, kind)`, `..._tenant`, e os
  dois `paid_at` como `(tenant_id, condominium_id, paid_at)`.
- O banco de desenvolvimento fica **com** a migration aplicada.
