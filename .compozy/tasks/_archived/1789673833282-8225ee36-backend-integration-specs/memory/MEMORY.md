# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- As tres tasks do workflow estao implementadas: task_01 (correcoes + esqueleto), task_03
  (`cadastros.spec.ts`) e task_02 (`documents.spec.ts`, 25 casos).
- Suite backend: 26 suites / 291 casos verdes. Os 48 IDs de `_tests.md` estao cobertos.

## Shared Decisions

- Nenhuma decisao de arquitetura foi tomada fora do que os ADRs ja registram.

## Shared Learnings

- **Nao existe `_prd.md` nem `_user_stories.md` neste diretorio.** O bloco `<critical>` de todo
  task file manda ler os dois; o workflow nasceu de uma auditoria de cobertura, nao de um PRD.
  `_tests.md` e o unico catalogo de contrato. Nao gaste tempo procurando os outros.
- **Resposta de validacao de schema (422) tem mensagem generica.** "Falha na validacao dos dados
  enviados." fica em `error.message`; o texto especifico vai em `error.details[]`, e cada entrada
  usa a chave `field` — nao `path`. Afirme `error.code` em vez da mensagem nos casos 422.

## Open Risks

- **Fechado com prova:** o risco principal do `_techspec.md` ("Known Risks": `filePath` como
  `select: false` produz download do arquivo errado e exclusao silenciosa) foi verificado por
  mutacao durante a task_02 — forcar `findStoredPath` a devolver `null` deixa IT-229 e IT-233
  vermelhos. As duas canarias mordem de verdade.
- **Continua aberto, de proposito:** se um `RESIDENT` pode listar e ver os metadados de um
  documento de visibilidade `ADMIN`. Nenhum caso afirma nada nos dois sentidos, porque a divisao
  atual pode ser a regra de produto pretendida.

## Handoffs

- `backend/uploads-test/` precisa terminar vazio em toda execucao; quem mexer em `documents.spec.ts`
  mantem a limpeza no `afterAll` que a task_01 escreveu, antes do teardown do contexto.
