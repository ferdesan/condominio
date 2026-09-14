# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Telas de Comunicados e Ocorrencias: CRUD completo mais os fluxos de cada uma — publicar/arquivar no comunicado; mudar status e atribuir na ocorrencia, com permissoes diferentes. Entregue e verificado.

## Important Decisions

- **Ciclo do comunicado gatilhado por status, e nao so por permissao.** E o oposto do que Visitantes e Correspondencias fizeram, e e deliberado: o `## Tests` da task exige as tres formas ("rascunho oferece publicar e nao arquivar", etc.), e o ciclo e linear e fechado — o servidor recusa publicar o arquivado e arquivar de novo nao teria efeito. A recusa continua alcancavel (outra pessoa publica o rascunho enquanto a lista esta aberta), entao o caso de teste da recusa na linha continua escrevivel.
- **Ocorrencias mantem a forma das telas anteriores:** mudar status e atribuir sao oferecidos so pela permissao, sem olhar status. O `STATUS_FLOW` do servidor nao e duplicado; o unico destino que o dialogo descarta e o proprio estado atual, que nao e uma mudanca. O silencio do task file sobre "respeitar o ciclo" em Ocorrencias — em contraste com o texto explicito em Comunicados — foi lido como intencional.
- **`protocol` nao e campo editavel.** `createIncidentSchema` nao o aceita: quem o gera e `IncidentService.nextProtocol`. A subtask 2.6 lista "protocolo" entre os campos do dialogo, e a leitura adotada foi mostra-lo como somente leitura (vazio no cadastro, preenchido na edicao), nunca envia-lo.
- **`status` e `assignedToId` fora do corpo de criacao/edicao das duas telas.** Manda-los pelo PATCH criaria um segundo caminho para as mesmas transicoes, sem as verificacoes de `/publish`, `/status` e `/assign` — e `assign` exige `manage`, que o PATCH nao exige.
- **`audience = BLOCKS` ganhou seletor de blocos no formulario.** Sem ele a opcao existiria no contrato e nao teria como ser usada com sucesso. A regra e duplicada no cliente (a unica): o servidor a recusa como 409 sem caminho de campo, e uma mensagem geral nao diria qual controle consertar.
- Indicadores de ocorrencia como bloco proprio por status, com rotulos de status reusados dentro de uma regiao nomeada (`role="region"`), para que os testes escopem em vez de colidir com os badges da coluna.

## Learnings

- **`GET /incidents/summary` devolve um array de `{ status, total }`**, e nao um objeto de contadores nomeados — e so os status com ocorrencias aparecem: um status sem nenhuma vem ausente, e nao zerado. A rota tambem valida a query e exige `condominiumId` como uuid obrigatorio.
- **`/users` nao aceita `condominiumId` como filtro** (`UserRepository.filterableFields = ['status','roleId','unitId']`, sem `condominiumField`). O vinculo vem embutido na resposta via `relations: ['role','condominiums']`, e o recorte e do cliente. Lista de condominios vazia significa "todos do tenant" — e a mesma leitura de `recipientsService.usersOfCondominium`, que inclui o vinculo ausente.
- `publishedAt` e a ordem padrao de Comunicados e **nao** e ordenavel, como a memoria compartilhada previa. Confirmado contra `AnnouncementRepository`.
- `POST /incidents/:id/status` exige a tratativa para `RESOLVED` e `REJECTED` (`BusinessRuleError`), entao a acao de linha abre dialogo. `publish` e `archive` aceitam corpo vazio e sao clique unico.
- `Textarea` traz `maxLength = 2000` por padrao; o conteudo do comunicado aceita 20000 no servidor. Sem passar o limite explicitamente, o proprio controle cortaria o texto antes do envio. Vale conferir o mesmo em qualquer campo longo das telas restantes.
- `AnnouncementService.archive` **nao** verifica nada — arquivar um ja arquivado passa. So `publish` recusa. A restricao do arquivado na interface e escolha da tela, nao espelho do servidor.

## Errors / Corrections

- **Ids de DOM duplicados entre o painel de filtros e o dialogo.** `announcement-pinned` estava no `SelectTrigger` do filtro e no `Checkbox` do formulario. Com dois elementos do mesmo id, `label.control` resolve para o primeiro do documento e o segundo fica sem rotulo — `getByLabelText` falha dentro do dialogo com "non-labellable". Filtro renomeado para `announcement-pinned-filter`. Conferir a interseccao entre ids de filtro e ids de campo antes de escrever os testes das telas restantes.
- A chave da consulta de usuarios comecou com o condominio dentro (`['users','options',id]`), o que prometia uma variacao que a resposta nao tem e refazia a busca a cada troca no shell. Corrigida para `['users','options']`.
- Nome de icone do lucide: `AlertOctagon` renderiza a classe `lucide-octagon-alert`, e nao `lucide-alert-octagon`.

## Files / Surfaces

- Criados: `types/announcement.ts`, `types/incident.ts`, `features/announcements/**`, `features/incidents/**` (18 arquivos de codigo + 4 de teste).
- Intocados, como exigido: `routes/app-router.tsx`, `types/api.ts`, `lib/crud/**`, `components/common/**`, `components/ui/**`, `src/test/**`, `package.json`.

## Ready for Next Run

- Verificacao final: `typecheck` 0, `lint` 0 erros / 5 warnings (os mesmos anteriores), `test` 58 arquivos / 619 casos verdes, `build` 0. Baseline antes da task: 54 / 555.
- Sem commit: a execucao rodou com `--auto-commit=false`. O diff esta limpo para revisao manual, e as duas features aparecem como diretorios nao rastreados.
- A task_05 registra as rotas; os nomes dos componentes estao no handoff da memoria compartilhada.
- Fora de escopo, registrado: `expiresAt` e `attachmentUrl` do comunicado, e `unitId`, `occurredAt` e `isAnonymous` da ocorrencia, nao entraram nos formularios — nenhum requisito ou caso de teste os pede. `/announcements/board` segue sem uso, como o task file permite.
