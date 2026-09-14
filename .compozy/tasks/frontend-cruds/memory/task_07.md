# Task Memory: task_07.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Endurecimento transversal das quatro telas (papeis, escopo de condominio, expiracao de sessao, acesso fora de escopo) e conferencia do portao do pipeline. 17 casos do `_tests.md` (IT-177 a IT-193). Sem commit automatico.

## Important Decisions

- **Conflito IT-185 x IT-205 resolvido pela distincao grava/lista** (promovido para a memoria compartilhada). O `_tests.md` e a autoridade para os dois; nenhum precisou ceder.
- IT-188 e IT-191 nao podem ser provados por uma suite que roda a si mesma. Implementados como asercao sobre o contrato — grafo de jobs, tolerancia a falha, reporters de cobertura x arquivo que o upload aponta — com a execucao real da suite registrada como evidencia da tarefa.
- IT-189 e IT-190 rodam uma suite de brinquedo num diretorio temporario com o mesmo runner, que e o unico jeito honesto de observar codigo de saida e contagem relatada.

## Learnings

- Tres defeitos reais apareceram, nenhum visivel de dentro de uma tela:
  1. `query-provider.tsx` levantava toast em 401 de *mutacao* (as consultas ja ignoravam) — a sessao expirada no meio de uma acao acusava a acao.
  2. `vite.config.ts` nao tinha o reporter `json`, entao `test:cov` passava verde sem escrever o `coverage-final.json` que o pipeline sobe.
  3. Os tres dialogos escopados recebiam o `selectedId` vivo, entao trocar de condominio com o formulario aberto redirecionava o envio.
- Cada correcao foi conferida ao contrario (desfazer a correcao faz o caso novo falhar) antes de ser dada por boa.

## Files / Surfaces

- Correcoes: `providers/query-provider.tsx`, `vite.config.ts`, `test/setup.ts`, as tres telas escopadas, `block-manager-dialog.tsx` e os cinco dialogos que gravam.
- Novo: `components/common/condominium-scope-notice.tsx`, `test/api-double.ts` (duble que atende as rotas das quatro telas de uma vez).
- Testes novos: `test/role-matrix`, `test/authorization`, `test/condominium-scope`, `test/environment`, `test/pipeline-gate`, `providers/condominium-provider.test.tsx`.

## Errors / Corrections

- Primeira tentativa fixou tambem a *gestao* de blocos no condominio de abertura, o que quebrou IT-205. Corrigido restringindo a fixacao ao formulario interno.
- A primeira versao do `pipeline-gate` derrubou tres casos de jornada sob `--coverage` por disputa de CPU dos runners aninhados. Corrigido com `--no-file-parallelism`, nao aumentando o timeout — a causa era o ambiente, nao os casos.

## Ready for Next Run

- Nada pendente desta tarefa. Diff sem commit, pronto para revisao manual.
