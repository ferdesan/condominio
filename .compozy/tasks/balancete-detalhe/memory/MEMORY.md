# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- **As quatro tasks estao entregues.** Backend completo — tabela, migration,
  escrita atomica no fechamento, rota e leitura nos dois modos. Frontend
  completo — a tela em `/financeiro/balancete/:mes` com guarda propria, filtro e
  paginacao no cliente, e a exportacao (impressao e CSV) morando so nela.
  Backend verde: lint 0, typecheck 0, **30 suites / 378 casos**. Frontend verde:
  lint com os 5 avisos de sempre, **91 arquivos / 1101 casos** (a referencia
  anterior era 91 / 1096; a task_04 e +7 −2, porque dois casos migraram).
- Resta um follow-up conhecido, em **Open Risks**.

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
- **A tela nao herda a guarda de `/financeiro`.** `/financeiro/balancete/:mes`
  fica num `ProtectedRoute permission="financial-closing:read"` proprio, fora do
  bloco de `charge:read`, e nao entra em `navigation.ts` nem em `IMPLEMENTED`. O
  invariante `REGISTERED.toHaveLength(NAV_ITEMS.length)` continua valendo sem
  edicao, e a rota e exercitada por caso proprio, como `/perfil`.
- **`AUXILIARY_READS` de `routes.test.tsx` ganhou duas entradas**, e a razao
  esta escrita ao lado delas no codigo. A promessa da task_04 de
  `balancete-mensal` era sobre o boot de `/financeiro`, que continua sem ler o
  balancete; a rota de detalhe e outra superficie.
- **`close` grava na ordem documento -> limpeza -> insercao, e nao na ordem
  literal da ADR-003.** A ADR lista a limpeza primeiro, mas o lancamento e filho
  do fechamento: num primeiro fechamento nao ha `closing_id` para apagar por ele
  nem para apontar, e a FK recusaria o filho antes do pai. Seguir a letra
  exigiria exatamente a guarda `if (existing)` que a ADR proibe. As invariantes
  dela — atomicidade e limpeza incondicional **antes** da insercao — estao
  preservadas. Quem ler a ADR e achar o codigo errado deve ler isto antes.
- **O CSV e um arquivo so, com dois blocos de larguras diferentes**, separados
  por linha em branco, o titulo `Lançamentos` e um cabecalho proprio. Os
  lancamentos usam rotulos de secao no **singular** (`Entrada`/`Saída`, os mesmos
  da tela), e o resumo usa o plural (`Entradas`/`Saídas`): ordenar a planilha por
  essa coluna separa lancamento de soma de categoria.
- **Quem exporta le o payload da rota, nunca o recorte da tabela.** Filtro e
  paginacao sao estado de tela. Vale para o CSV hoje e valeria para qualquer
  exportacao nova.

## Shared Learnings

- `POST /financial/charges/:id/payments` responde `{ charge, payment }`: o id do
  pagamento e `body.data.payment.id`.
- **O esqueleto de uma pagina que repete o `h1` da tela pronta engana o teste.**
  `findByRole('heading', {level:1})` resolve antes de haver dado, e o caso passa
  medindo o esqueleto. Esperar por uma regiao que so existe com dado.
- **Aviso conhecido e pre-existente:** `Select is changing from uncontrolled to
  controlled` no `routes.test.tsx`. Vem de `topbar.tsx:50`
  (`value={selectedId ?? undefined}`), e nao de tela nova. So aparece desde a
  task_03 porque a rota do balancete e a primeira cujo caso **exige** que a
  selecao de condominio ja tenha resolvido. Correcao de uma linha (`?? ''`)
  pendente, fora do escopo daquela task.
- **Um caso que afirma uma ausencia precisa da contraprova no mesmo `it`.**
  IT-322 afirma que nem o documento nem os lancamentos ficam depois da falha —
  o que um `close` quebrado por qualquer outra razao tambem satisfaria. O
  fechamento bem-sucedido logo em seguida e o que da sentido ao caso.
- Para derrubar so uma escrita dentro de uma transacao, o espiao vai em
  `EntityManager.prototype.save` filtrado por `instanceof <Entidade>`. sqljs faz
  rollback de verdade, entao o caso mede a transacao.
- **O `Blob` do jsdom 25 nao tem `text()` nem `arrayBuffer()`.** Qualquer caso
  que confira o conteudo de um download precisa do `FileReader.readAsText`. Vale
  para todo o frontend, nao so para o balancete.
- **`:has()` nao e confiavel no seletor do jsdom.** `element.closest(...)`
  responde a mesma pergunta de baixo para cima e funciona.

## Open Risks

- Nenhum aberto no backend.
- **A folha impressa da rota mostra so a pagina visivel da tabela.** Mes com 25
  lancamentos: 20 linhas no DOM, 5 fora, e o rodape `Página 1 de 2` impresso
  junto — o `clientPagination` da `DataTable` recorta o array, entao as linhas
  restantes nao existem para o CSS revelar. O CSV nao sofre disso. Medido na
  task_04 e **deixado em aberto de proposito**: nenhum requisito nem caso
  atribuido o cobre, e as duas saidas custam mais do que aquela task comportava —
  uma copia completa so para impressao quebra `getByText` em IT-335/336/337/339
  (casos entregues), e `beforeprint` + `flushSync` nao e testavel em jsdom e o
  Safari nao emite o evento. Detalhe em `memory/task_04.md`.

## Handoffs

**Nao sobra nada das quatro tasks.** A esteira esta completa.

**O que continua precisando de um humano:** a conferencia visual da impressao —
margem, quebra de pagina, cor de fundo, se a tabela cabe na folha. A task_04
simulou as tres regras do `@media print` sobre o DOM dos dois estados e
registrou o que aparece e o que some (em `memory/task_04.md`), mas o jsdom nao
calcula layout e essa metade nao e automatizavel, como o ADR-006 da esteira
anterior ja dizia.
