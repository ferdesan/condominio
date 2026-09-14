# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- **Tier concluido, e com ele o menu inteiro.** Financeiro, Assembleias e Documentos entregues numa execucao so, sem decomposicao em tasks. O menu tem **22 de 22** telas; nenhum item leva mais ao `PlaceholderPage`.
- Suite do frontend: 68 arquivos / 790 casos, verde. Baseline antes deste tier: 65/729. Backend intocado e conferido: 16 suites / 151 casos.
- Pipeline conferido na ordem do CI: lint (os mesmos 5 avisos anteriores a todo este esforco), typecheck, testes e build — todos zero.

## Shared Decisions

- **Financeiro: tres secoes sob uma rota, com filtros e acoes de linha dentro do arquivo de cada secao.** E a unica tela com essa forma; espalhar cada secao em quatro arquivos tornaria a feature dificil de percorrer. A troca de secao e estado local, sem rota propria (ADR-004).
- **Documentos e a unica tela sem "incluir removidos" e sem "restaurar", contra o ADR-006.** `afterRemove` apaga o arquivo do disco e nao ha rota de restauracao — e a eliminacao do dado que a LGPD exige. A confirmacao precisa dizer isso, porque quem ja usou as outras telas espera reversibilidade.
- **Download autenticado passa por `api.get` com `responseType: 'blob'`, e nao por `<a href>`.** A sessao viaja no cabecalho, e uma navegacao do navegador nao o carrega. Consequencia a aceitar: o corpo de erro tambem vem como blob, entao a mensagem do servidor nao chega — `describeDownloadFailure` traduz o status nas tres recusas que a rota produz.
- **Upload vai como `FormData` cru pelo `apiPost`.** O axios remove o `Content-Type: application/json` da instancia quando o corpo e `FormData`, deixando o navegador escrever o cabecalho com o `boundary` — que e a unica forma de o multer ler o arquivo. Definir o cabecalho a mao quebraria isso.
- **Dinheiro e digitado como decimal em `Input type="number"`, e nao pelo `CurrencyInput`.** O controle de moeda guarda `number` e formata no proprio estado, quebrando a convencao de valores em texto dos formularios. Precedente: `unit-schema.ts`.
- **Campo que o servidor grava por rota propria continua fora do corpo de criacao/edicao** — regra herdada do tier 2 e aplicada de novo: `status` de cobranca (rotas de baixa e cancelamento), `status` de despesa (`/pay`), `status` de assembleia (`/start`, `/finish`, `/cancel`), e as `options` de uma votacao no PATCH, que o proprio `updatePollSchema` omite para nao invalidar a apuracao.

## Shared Learnings

- **Opcional numerico vazio precisa ser omitido, e nao enviado como zero.** Em `/financial/charges/generate`, `fixedAmount` ausente manda o servidor usar a taxa cadastrada na unidade; zero geraria cobrancas de R$ 0,00. A diferenca entre "nao informado" e "zero" e real sempre que o servidor tem um terceiro comportamento para a ausencia.
- **`toContain` sobre `textContent` nao normaliza espaco rigido.** `Intl.NumberFormat` separa "R$" do numero com U+00A0; `getByText` do RTL normaliza e passa, `toContain` com string literal falha. Comparar so os digitos resolve sem prender o teste ao formato.
- **Assercao de data formatada nao pode fixar o fuso** (ja registrado no tier 2) — e assercao de data **futura** tambem nao pode usar uma data que ja passou: um `endsAt` em 2026-06 contra um `startsAt` que e "agora" falha por regra de negocio, nao por defeito. Usar uma data distante.
- **Rotulo repetido entre o painel de filtros e o dialogo quebra `getByLabelText` mesmo com ids distintos.** O id evita o problema de rotulo orfao; o que quebra a consulta e o *texto* acessivel repetido no documento. A solucao no teste e escopar em `within(dialog)`, e nao renomear o campo.
- **Um `render={() => (<FormField>...)}` fechado com `/>` em vez de `</FormField>` produz um erro de JSX a dezenas de linhas de distancia.** O typecheck aponta a linha errada; procurar o `/>` orfao dentro do `render` mais proximo e mais rapido do que ler o relatorio.
- **`z.instanceof(File)` funciona no jsdom**, e `Object.defineProperty(file, 'size', ...)` evita alocar megabytes so para exercitar um limite de tamanho.
- **O jsdom nao implementa `URL.createObjectURL` nem o download de um link.** Os dois stubs e um spy em `HTMLAnchorElement.prototype.click` mantem o caso silencioso e preciso; sem o spy, o clique vira tentativa de navegacao e polui o log.

## Open Risks

- Os 5 `warning` de lint que sobram sao anteriores a todo este esforco (`no-explicit-any` em `data-table.tsx` e `filter-panel.tsx`, `only-export-components` em `test/render.tsx`). Entregar sem aumentar esse numero.
- **`/financial/payments` nao tem tela.** A rota e somente leitura e a baixa acontece pela cobranca; o historico de pagamentos de uma cobranca especifica nao e consultavel pela interface hoje. Nao foi pedido, e e a lacuna conhecida mais proxima.
- **O voto nao e emitido pela interface.** `POST /polls/:id/vote` existe e exige `vote:create`, mas a tela de Assembleias e de back-office: ela conduz a votacao (abre, apura) e nao vota. O portal do morador, que votaria, nao existe neste frontend.

## Handoffs

- **`FinancialPage`** — `features/financial/financial-page.tsx`; **`AssembliesPage`** — `features/assemblies/assemblies-page.tsx`; **`DocumentsPage`** — `features/documents/documents-page.tsx`. Export nomeado, sem barrel, todas ja registradas em `app-router.tsx`.
- **`frontend/src/test/routes.test.tsx` substitui `tier2-routes.test.tsx`** e cobre os 22 caminhos. Ele compara a contagem de `REGISTERED` com `NAV_ITEMS.length`: um item de menu novo faz o teste falhar de imediato, em vez de passar despercebido.
- **Os tipos seguem a regra do cabecalho de `types/api.ts`**: recurso novo ganha `types/<recurso>.ts`, sem reexportacao. Este tier acrescentou `document.ts`, `assembly.ts` e `financial.ts`.
