# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- **Workflow concluído: as seis tasks.** Origem: auditoria de 2026-09-14 que comparou cada rota de `backend/src/modules/*/*.routes.ts` com os literais de caminho em `frontend/src`.
- **`/esqueci-senha` e `/redefinir-senha` existem**, públicas, em `frontend/src/features/auth/`, com o link a partir do login. A moldura das três telas públicas virou `features/auth/components/auth-shell.tsx`.
- **task_06 foi absorvida.** Cada task registrou a própria rota; task_04 e task_05 não criam rota nenhuma.
- **`/configuracoes` existe**, em `frontend/src/features/tenant/`: identificação, política de encargos editável e plano/limites como leitura. Registrada no roteador e no menu (seção Administração), sob `tenant:read`.
- **`/papeis` existe**, em `frontend/src/features/roles/`: CRUD pela fábrica, matriz de permissões montada do catálogo do servidor, e visualização somente leitura. Sob `role:read`, também na seção Administração.
- **`Role` vive em `types/role.ts`**, e não mais em `types/user.ts`, que passou a importá-lo. Quatro arquivos de `features/users/` trocaram o caminho do import.
- **`/perfil` já foi entregue**, fora deste workflow, em `frontend/src/features/profile/`. Era o item 1 do inventário. Não há mais nenhuma rota servida pelo `PlaceholderPage`.
- **Canal de tempo real ligado**, em `hooks/use-realtime.ts`, montado em `AppShell`. Invalida chaves, nunca escreve no cache; degrada em silêncio.
- Suite em **74 arquivos / 945 casos** (73 / 919 após task_04; 72 / 893 após task_01; 71 / 869 após task_03; 70 / 837 após task_02; 69 / 810 na abertura); backend segue em **16 suites / 151 casos**. Lint com **5 avisos, 0 erros**.
- **`POST /announcements/:id/read` continua sem tela, por decisão da task_04**: é um contador de visualizações (`incrementReads`), e não um recibo por pessoa. Há teste afirmando que a tela nunca a chama.

## Shared Decisions

- **`app-router.tsx` e `navigation.ts` têm um dono só — quando as tasks correm em paralelo.** É a regra que manteve o `frontend-tier2` livre de conflito com quatro tasks sobre o mesmo roteador. Numa execução manual e sequencial ela só cobra: a task_02 rodou sozinha e registrou a própria rota, em vez de deixar a tela inalcançável até a última task da cadeia.
- **Execução sequencial.** As arestas formam cadeia. No tier 2, duas execuções em ondas paralelas falharam — a primeira no resolvedor de conflitos, a segunda por timeout com três agentes disputando a máquina durante a verificação.
- **Rota de contexto não passa pela fábrica do ADR-008.** A fábrica monta as seis operações de um roteador CRUD sobre um recurso; `/auth` e `/tenants/me` não têm recurso nem `:id` — o alvo vem do token. Precedente escrito no cabeçalho de `features/profile/profile-hooks.ts`.
- **Tela sem recurso não usa `CrudLayout`.** O perfil é uma pilha de `Card`, um por rota, porque os efeitos não se misturam — gravar o nome não toca em sessão, trocar a senha derruba todas. Vale para a tela de tenant (task_02).
- **Tipo de recurso novo vai para `types/<recurso>.ts`, nunca para `types/api.ts`.** O cabeçalho de `api.ts` declara o arquivo fechado para novos, e duas execuções anteriores quebraram por tasks concorrentes nele.

## Shared Learnings

- **Um evento declarado no servidor pode nunca ser emitido.** `dashboard:refresh` está no union de `RealtimeEvent` e nenhum serviço o dispara. Antes de mapear um evento, `grep` pelo emissor — mapear o que ninguém emite é código que nunca executa e sempre precisa ser mantido.
- **A sala de destino decide quem recebe.** `visitor:arrived` vai para `ROOM.unit`, e só contas com `unitId` (morador) entram nela — um administrador nunca o recebe neste back-office. O evento existir no servidor não significa que este frontend o alcance.
- **`auth` como função resolve reconexão com token renovado sem plumbing.** O socket.io a chama em toda tentativa, inclusive nas reconexões; ela lê `tokenStorage` na hora. `lib/api.ts` renova o token em silêncio e não avisa ninguém — não foi preciso inventar um evento para isso.
- **`ref.current` na limpeza de um efeito lê o valor do momento da limpeza.** Copiar para uma variável local dentro do efeito é o que a regra `react-hooks/exhaustive-deps` pede, e o que torna a limpeza correta.
- **`ReturnType<typeof vi.spyOn>` sem genérico não tipa um espião concreto.** Envolver a chamada numa função auxiliar e usar `ReturnType<typeof helper>` faz o TypeScript inferir a assinatura certa sem escrever o genérico a mão.

- **"O servidor guarda" não é "o servidor registra por pessoa".** `POST /announcements/:id/read` parece um recibo de leitura e é `reads_count + 1` numa coluna do comunicado — sem vínculo com quem pediu, sem impedir repetição, sem estado a consultar. Antes de construir "lido/não lido", confira se existe a linha que sustentaria isso.
- **Um dublê que falta não dá erro de URL: dá toast de erro.** `apiGet` sem implementação devolve `undefined`, e o React Query trata resultado indefinido como falha — o sintoma aparece como "toast chamado 1 vez" num caso que nada tem a ver. Toda leitura nova que uma tela faz na montagem precisa entrar no `serve*` da feature.
- **Gráfico do Recharts não rende DOM no jsdom** (o container mede zero). Ordenação, corte e tradução de rótulo saem para um módulo e são testados como função; no componente ficam só os estados vazio e carregando, que renderizam de verdade.
- **Consulta sob demanda é `useMutation`, mesmo sendo `GET`.** O que decide não é o verbo: um `useQuery` guardaria a resposta por chave e devolveria cache na segunda leitura do mesmo código — errado quando o propósito é saber o estado agora.
- **Rotulo acessível repetido entre um painel e uma linha da tabela quebra `getByRole`.** A mesma ação oferecida em dois lugares precisa de `within(painel)` no teste, e não de um rótulo diferente — os dois descrevem a mesma coisa.

- **Prova de não-enumeração é comparação, e não presença.** Afirmar que "algo aparece" depois de pedir a recuperação não prova nada: o que protege a informação é as duas respostas — conta existente e inexistente — serem idênticas. O caso captura o texto renderizado nos dois cenários, normaliza o único trecho que legitimamente difere (o endereço digitado) e compara.
- **Resposta que só existe fora de produção é armadilha.** `forgotPassword` devolve `token` em desenvolvimento e o omite no deploy. Consumi-lo produz uma tela que funciona na máquina de quem escreveu e falha em produção — a pior forma de um defeito existir. Tem teste afirmando que ele nunca aparece.
- **Uma mensagem para três causas costuma ser deliberado.** Token desconhecido, usado e expirado produzem o mesmo 400 com o mesmo texto; distingui-los diria a quem tem um token inválido se ele um dia foi válido. A tela repete o que veio e oferece a única saída comum.

- **Uma guarda do servidor pode olhar a *presença* da chave, e não o conteúdo.** `roleService.beforeUpdate` recusa `permissions` num papel do sistema mesmo que o valor enviado seja idêntico ao atual. Reenviar o objeto inteiro no PATCH — o reflexo normal — seria recusado com 409; o corpo precisa omitir a chave. Vale conferir a guarda antes de assumir que um PATCH idempotente passa.
- **`<recurso>:manage` resolve as outras ações, mas não as contém.** `hasPermission` trata `manage` como curinga do recurso; o papel guarda exatamente o que foi concedido. Uma interface que marcasse as cinco ao escolher `manage` gravaria cinco onde o servidor esperava uma.
- **Catálogo do servidor é fonte de verdade; rótulo local é apresentação.** A matriz de permissões monta as linhas do que `GET /roles/permissions` devolveu, e `PERMISSION_GROUPS` só decide a ordem. Um recurso novo no backend aparece em "Outros" com o identificador técnico — visivelmente incompleto, e nunca silenciosamente ausente.
- **Toggle de filtro em teste precisa mudar o mundo *antes* do clique.** Ligar `includeDeleted` muda a chave da consulta; alterar o duble depois e alternar o filtro de ida e volta serve o cache do primeiro recorte, e a linha esperada nunca aparece.

- **`input type="number"` engole a vírgula decimal, e num campo de dinheiro isso é um erro de 10x.** Digitar `1,5` produz `15`: o navegador descarta a vírgula e o `5` se concatena ao `1`, sem aviso. Campo decimal que gente em pt-BR vai digitar precisa ser `type="text"` com `inputMode="decimal"`, e o schema converte vírgula em ponto. Campo **inteiro** (como a carência em dias) pode seguir `type="number"` — não há separador a perder. Isto refina a nota do tier 3 sobre `CurrencyInput`: ela dizia o que **não** usar, e não previu o separador.
- **`superRefine` no lugar de dois `refine` encadeados** quando um campo precisa de duas mensagens distintas: cada `refine` embrulha o schema numa camada nova de `ZodEffects`, e o tipo aninhado deixa de ser atribuível a `z.ZodEffects<z.ZodString, string, string>` numa assinatura de função auxiliar.
- **Fixture de recurso novo não cabe em `test/fixtures.ts`**: aquele arquivo só importa de `types/api.ts`, que está fechado. Ela mora no `test-utils.ts` da feature, e `test/routes.test.tsx` a importa de lá quando precisa servir a leitura da tela no mundo vazio.
- **O duble de um PATCH precisa mesclar como o servidor mescla.** `tenantService.update` funde `settings` com o que já existe; um duble que ecoasse o corpo enviado esconderia a regra de que mandar três campos não apaga os outros três.
- **`updateTenantSchema` aceita mais do que a tela pode oferecer.** É `createTenantSchema.partial()`, mas `tenantService.update:67-81` recusa com **403**, para quem não é super-admin, `plan`, `status`, `maxCondominiums`, `maxUsers` e `slug`. Oferecer qualquer um faz todo salvamento falhar. O schema do servidor **não** é, sozinho, a especificação da tela — o service é.
- **`forgotPassword` sempre responde 202**, exista a conta ou não (`auth.service.ts:264`), e devolve o `token` **apenas fora de produção**. Uma tela que consome esse token funciona em desenvolvimento e falha no deploy.
- **Trocar ou redefinir senha derruba todas as sessões.** `changePassword` e `resetPassword` chamam `revokeAllForUser`, que revoga todo refresh token do usuário — inclusive o do navegador que pediu. Não há "manter esta sessão"; o servidor não distingue a de quem pediu.
- **401 em `/auth/change-password` é erro de campo**, e não sessão expirada — é a única rota autenticada onde isso vale. O perfil trata assim, apontando a mensagem ao campo da senha atual.
- **Três campos de `tenant.settings` são lidos de verdade**, em `charge.service.ts:310-312`: `chargeGraceDays`, `latePenaltyPercent` e `lateInterestPercent`. `timezone`, `locale` e `primaryColor` são semeados e não têm leitor. A diferença entre "o servidor guarda" e "alguma coisa lê" precisa ser conferida antes de oferecer um campo.
- **`users.preferences.emailNotifications` e `pushNotifications` não têm leitor nenhum** no backend. Por isso a tela de perfil oferece só o tema — o único que produz efeito, via `ThemeProvider`.
- **O `retry` do `QueryProvider` não repete 4xx e repete 5xx duas vezes.** Um teste de estado de erro precisa usar um status de cliente, ou mede o backoff da repetição em vez do que a tela mostra.
- **O harness de `test/render.tsx` não monta o `ThemeProvider`.** Tela isolada que lê o tema precisa envolvê-lo no próprio arquivo de teste, como `test/routes.test.tsx` já fazia e `features/profile/profile-page.test.tsx` passou a fazer.

## Open Risks

- **Os 5 avisos de lint** são anteriores a todo este esforço (`no-explicit-any` em `data-table.tsx` e `filter-panel.tsx`, `only-export-components` em `test/render.tsx`). Entregar sem aumentar esse número. Exportar uma função ao lado de um componente cria um aviso novo — por isso rótulos e helpers moram em módulos próprios (`<recurso>-labels.ts`).
- ~~**task_05 é a de maior risco do workflow.**~~ Entregue: o canal só se liga dentro do shell autenticado, nenhuma tela passou a depender dele, e nenhuma suíte existente precisou mudar. A degradação silenciosa tem teste próprio.
- ~~**task_03 tem um consumidor existente.**~~ Resolvido: a chave `roles` é compartilhada de propósito, e a invalidação da fábrica alcança `['roles', 'options']` — criar um papel atualiza o seletor da tela de Usuários. A suíte de `features/users/` passou sem alteração de asserção.
- **`npm --prefix backend run test` precisa de MySQL e Redis.** Se o ambiente não os tiver, dizer isso explicitamente em vez de declarar a etapa verde.

## Handoffs

- **Fora de escopo, e não esquecido:** portal do morador (`POST /polls/:id/vote`, `GET /polls/:id/votes`, `GET /financial/charges/my`, `GET /residents/my-unit`), auto-cadastro de administradora (`POST /auth/register`), despachante de e-mail/push para as preferências de notificação, i18n para `preferences.locale`, e upload de avatar. Os motivos estão em `_techspec.md`, seção "O que está deliberadamente fora".
- **Itens abertos que não vieram desta auditoria** e continuam em `tasks/README.md`: specs de integração ausentes no backend (`documents`, `dependents`, `employees`, `service-providers`, `common-areas`), exportação/anonimização LGPD, e o calendário semanal/diário de Reservas.
