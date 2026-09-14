# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Auditoria (por tenant, somente leitura, lista geral + historico por registro) e Notificacoes (pessoal, contagem dedicada, marcacao de leitura). Entregue. Suite: 64 arquivos / 722 casos, verde; baseline 62/691.

## Important Decisions

- **Nenhuma das duas usa `createResourceHooks`.** O task file permitia usar a fabrica so pela listagem; foi descartado. Ela expoe as seis operacoes do roteador CRUD, e cinco delas nao existem em nenhum dos dois modulos — deixar `useCreate`/`useUpdate`/`useRemove`/`useRestore` acessiveis apontaria para endpoints que respondem 404, e quem escrevesse a proxima tela nao teria como saber disso pelo tipo. Os hooks proprios sao ~40 linhas cada e dizem exatamente o que existe.
- **`actionUrl` sempre resolve para a listagem do modulo, nunca para um detalhe.** `resolveActionUrl` (em `features/notifications/notification-links.ts`) sobe pelos segmentos do caminho ate achar um que esteja em `NAV_ITEMS`; sem correspondencia, o link nao e oferecido. A alternativa — manter uma lista de rotas de detalhe conhecidas — foi descartada por duplicar o roteador num segundo lugar, onde o sintoma de esquecer de atualizar seria tela em branco. Custo aceito: `/reservas/{id}` leva a `/reservas`, perdendo o registro especifico. A fonte e `routes/navigation.ts`, entao um modulo que ganhe tela vira destino sem mudanca neste arquivo.
- **Auditoria tem gate de permissao na propria pagina**, alem do guard de rota que a task_05 adiciona: sem `audit-log:read` ela renderiza `ForbiddenPage` e a query nao sai (`enabled: canRead`). E o que torna o caso testavel antes de a rota existir, e o guard de rota nao alcanca quem monta a pagina direto.
- **Notificacoes nao tem gate de leitura na pagina.** O item de menu nao declara permissao e a task_05 exige que a rota siga sem guard; os cinco papeis do sistema tem `notification:read`. O unico gating da tela e `notification:update`, que esconde as duas formas de marcar.
- **`AppNotification`, e nao `Notification`.** `Notification` e um tipo global do DOM: um modulo que esquecesse o import compilaria contra a notificacao do navegador sem erro nenhum no type check. E a unica divergencia de nomenclatura em relacao as demais telas do tier, e e deliberada.
- **Whitelist de filtros de Notificacoes exclui `userId` e `condominiumId`, que o servidor aceita.** `userId` e sobrescrito pelo servico com o da sessao; `condominiumId` esconderia as notificacoes do tenant inteiro, que tem a coluna nula. Enviar qualquer um dos dois prometeria um recorte que a tela nao controla.
- **Nao ha filtro de "somente nao lidas".** `readAt` nao esta entre os `filterableFields` do repositorio — o controle seria descartado em silencio e pareceria funcionar. O indicador dedicado responde a mesma pergunta.

## Learnings

- **`/audit-logs/:resource/:resourceId` devolve array cru**, sem `meta`, ja ordenado por `createdAt DESC` e limitado a cem (`findAllBy`). Mesma forma de `/maintenances/upcoming`; a lista de endpoints auxiliares sem forma comum continua valendo.
- **`/notifications/unread-count` devolve `{ unread }`** — o formato que faltava conferir na shared memory. Fecha o conjunto com `{ inside }` e `{ pending }`.
- **`fireEvent` em sequencia e o unico jeito de provar o trinco de duplo clique.** `user.click` do `userEvent` faz flush de microtasks entre os cliques, entao a mutacao pode resolver e a segunda chamada passaria pelo trinco legitimamente. `clickTrigger(button); clickTrigger(button);` sem await no meio reproduz o duplo clique real. Precedente: o mesmo caso em comunicados.
- **`findByText` falha com "found multiple" quando duas fixtures compartilham o texto.** Custou um caso em auditoria: duas entradas com a descricao padrao. Toda fixture adicional num mesmo caso precisa de texto proprio.
- **Assercao de data formatada nao pode fixar o fuso.** `formatDateTime` usa o fuso da maquina; a coluna e conferida por forma (`/^\d{2}\/\d{2}\/\d{4} as \d{2}:\d{2}/`), o que prova legibilidade sem prender o teste ao ambiente.
- **Rota de teste real, e nao assercao de `href`.** `renderWithProviders` ja monta um `MemoryRouter`, entao passar `<Routes>` como `ui` e `route` como entrada inicial permite clicar no link e conferir que a tela de destino renderizou — que e o que "navega ate ela" significa.
- **Rotulos do dialogo sao diferentes dos cabecalhos da tabela de proposito** ("Quem agiu" x "Autor", "Data e hora" x "Quando"). A tabela continua montada atras do dialogo, e dois elementos com o mesmo texto quebram a consulta antes de confundir o leitor — mesma familia de problema ja documentada para ids repetidos entre filtro e formulario.

## Files / Surfaces

- `frontend/src/types/{audit,notification}.ts` — novos; `types/api.ts` intocado.
- `frontend/src/features/audit/` — hooks, labels, pagina, 3 componentes, test-utils, 1 arquivo de teste (15 casos).
- `frontend/src/features/notifications/` — hooks, labels, links, pagina, 4 componentes, test-utils, 1 arquivo de teste (16 casos).
- Nada mais foi tocado: `git diff --name-only` traz so o `README.md`, que ja estava modificado antes desta execucao. `app-router.tsx` intocado.

## Errors / Corrections

- Uma falha na primeira rodada de auditoria (`findByText` ambiguo entre duas fixtures com a mesma descricao). Corrigida no teste; nenhuma mudanca de producao foi necessaria.

## Ready for Next Run

- `AuditPage` (`features/audit/audit-page.tsx`) e `NotificationsPage` (`features/notifications/notifications-page.tsx`), export nomeado, sem barrel, nenhuma registra rota — para a task_05.
- **Auditoria se comporta como `/usuarios`, e nao como as outras seis:** e por tenant, funciona sem condominio selecionado e nenhuma requisicao dela envia `condominiumId`. Um teste de rota que a monte esperando o estado de "selecione um condominio" falha por desenho.
- **`/notificacoes` ja depende de `NAV_ITEMS`** atraves de `resolveActionUrl`. Registrar as oito rotas nao muda esse arquivo, mas vale saber que a resolucao de destino melhora sozinha quando um item passa a ter tela.
