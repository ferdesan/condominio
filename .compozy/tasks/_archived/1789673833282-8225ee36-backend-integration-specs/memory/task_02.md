# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Estender `backend/tests/integration/documents.spec.ts` (esqueleto da task_01) com 25 casos:
envio, matriz de visibilidade em tabela unica, mecanica de download, listagem, atualizacao e exclusao.
Concluido: 26 suites / 291 casos (era 266), lint e typecheck limpos, `uploads-test/` vazio.

## Important Decisions

- `beforeAll` da task_01 estendido, nao recriado: mais tres personas (`sindico` e o par
  `porteiro`/`morador`) e um envio por visibilidade, iterando `DOCUMENT_VISIBILITIES`.
- Matriz tipada contra o enum do servidor (`DocumentVisibility`), com uma guarda que lanca na
  coleta do `describe` se alguma visibilidade nao tiver duas linhas. E o que torna literal a
  consequencia do ADR-003 ("uma visibilidade nova quebra a tabela"); sem ela a tabela apenas
  ignoraria o nivel novo.
- As quatro linhas 403 da tabela afirmam tambem a mensagem, dentro de um `if (status === 403)`.
  Cobre a exigencia especifica do IT-220 sem tirar a matriz de uma tabela so.
- IT-211 monta a requisicao inline em vez de usar o helper: o helper sempre anexa, e o caso
  investiga justamente a ausencia da parte de arquivo. Nao e um segundo helper.
- IT-231 ganhou uma afirmacao extra (existe documento com `downloadsCount > 0`) para o
  "filtro ignorado" nao passar por vacuidade — a mecanica de download roda antes na ordem do arquivo.

## Learnings

- `.field()` encadeado **depois** de `.attach()` funciona: o multer so resolve no `finish` do
  busboy, entao campo que chega apos o arquivo ainda entra em `req.body` (usado no IT-215).
- Superagent tem parser binario para `application/pdf`, entao `response.body` ja vem `Buffer`
  na resposta do download — comparacao byte a byte direta, sem parser customizado.
- O multer drena o restante do stream ao abortar por `LIMIT_FILE_SIZE`, entao o cliente recebe
  o 400 inteiro em vez de um socket resetado. O caso de 10 MB + 1 byte roda em ~75 ms.
- O `morador` semeado e `TENANT` (`index 0`, `0 % 3 === 0` em seed.ts), o que torna literal o
  nome do IT-221.
- Nenhuma persona precisa de `perPage` alto para achar os documentos semeados: `?category=CONVENTION`
  isola um deles, e os envios do arquivo usam `MINUTES`.

## Files / Surfaces

- `backend/tests/integration/documents.spec.ts` — unico arquivo alterado (+298 linhas, so adicao).
- Nenhuma mudanca em codigo de producao, como a task previa.

## Errors / Corrections

- Nenhum caso falhou na primeira execucao. Para nao aceitar verde sem prova, `findStoredPath` foi
  temporariamente forcado a devolver `null` (a falha exata que o ADR-001 previu): IT-229 e IT-233
  ficaram vermelhos junto com mais 11 casos, enquanto as linhas 403 e o IT-230 seguiram verdes.
  Mutacao revertida com `git checkout --`.

## Ready for Next Run

- 25 casos implementados e passando; nenhum pendente.
- Sem commit automatico (`--auto-commit=false`); o diff esta pronto para revisao manual.
- Follow-up registrado, nao feito: o IT-234 da task_01 le o nome do arquivo do disco porque o
  `beforeAll` dela nao subia nada. Agora sobe cinco, entao a letra do `_tests.md` ("o caminho vem
  do upload feito no `beforeAll`") voltou a ser possivel. Reescrever caso da task_01 esta fora
  do escopo desta.
