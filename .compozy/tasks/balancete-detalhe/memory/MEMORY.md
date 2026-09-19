# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- **task_01, task_02 e task_03 entregues.** O backend esta completo — tabela,
  migration, escrita atomica no fechamento, rota e leitura nos dois modos — e a
  tela existe em `/financeiro/balancete/:mes`, com guarda propria, filtro por
  categoria e paginacao no cliente. Backend verde: lint 0, typecheck 0,
  **30 suites / 378 casos**. Frontend verde: lint com os 5 avisos de sempre,
  **91 arquivos / 1096 casos** (eram 90 / 1087).
- Proxima: **task_04** (a exportacao migra para a rota). A tela nao lhe deve
  nada alem dos dois botoes e das marcacoes de impressao.

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

## Open Risks

- Nenhum aberto no backend. O risco anterior — entidade sem migration — foi
  fechado pela `1757900000000-ClosingEntries`, verificada contra o MySQL local
  nos dois sentidos.
- No frontend, os dois que a task_04 precisa resolver estao em **Handoffs**:
  impressao com a tabela paginada, e exportacao com filtro ativo.

## Handoffs

**Para a task_04**, a task_03 entrega a tela em `/financeiro/balancete/:mes`,
com `ClosingEntriesTable` ao lado, e o link "Ver o documento completo" ja na
secao — a metade do IT-341 que fala do link ja e verdade; a que fala da ausencia
do `Exportar CSV` e trabalho da task_04.

**Dois riscos que a task_04 herda, e nenhum caso pega:**

1. **A tabela pagina no cliente (20 por pagina), entao a folha impressa mostraria
   so a pagina visivel.** O CSV nao sofre disso — le o payload, nao o DOM. Quem
   mover `print-document` para a rota precisa decidir o que a impressao faz com
   as outras paginas.
2. **O filtro por categoria tambem nao e do payload.** Exportar com filtro ativo
   tem de exportar o mes inteiro; exportar o recorte faria o arquivo discordar do
   que o ADR-004 existe para garantir.

**Nao sobra nada das tasks 01, 02 e 03.**
