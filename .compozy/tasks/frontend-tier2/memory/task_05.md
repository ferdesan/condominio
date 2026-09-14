# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Oito rotas registradas, consolidacao de tipos decidida e registrada, pipeline conferido na ordem do CI. Entregue. Frontend: 65 arquivos / 729 casos, verde (baseline 64/722). Backend, intocado e conferido: 16 suites / 151 casos. Lint com os mesmos 5 avisos anteriores, typecheck zero, build zero.

## Important Decisions

- **Sem consolidacao de tipos; a regra e "recurso novo ganha `types/<recurso>.ts`, e `types/api.ts` esta fechado para novos".** Registrada no cabecalho do proprio `types/api.ts`, que e onde a proxima pessoa vai olhar. As duas alternativas foram avaliadas e recusadas: mover tudo para `api.ts` exigiria reescrever os imports das oito telas recem-entregues, que esta task nao deve alterar; e reexportar dali criaria dois caminhos de import validos para cada simbolo sem nada que escolhesse entre eles — o valor de um ponto de entrada unico so existe quando ele e o unico. O resultado e coerente pelo criterio que importa: cada tipo tem exatamente um lugar e um caminho de import. O que sobrou em `api.ts` e nomeado como divida com fronteira explicita (os contratos anteriores ao tier), e nao como meia migracao silenciosa.
- **`/notificacoes` ficou sem guarda de permissao, dentro do `ProtectedRoute` de sessao.** E o unico item sem permissao em `navigation.ts`, e o servidor tambem nao exige uma que distinga papeis: os cinco papeis do sistema tem `notification:read`. Inventar uma aqui esconderia a tela de quem a API atenderia.
- **O teste de rotas monta `<AppRouter />`, e nao as paginas.** Registrar uma rota e sempre duas coisas — declarar a rota e acrescentar o caminho a `IMPLEMENTED` —, e esquecer a segunda deixa o item no `PlaceholderPage` sem nenhum teste de tela perceber. Nenhum dos 64 arquivos anteriores montava o roteador.
- **O `ThemeProvider` do teste de rotas fica no proprio arquivo, e nao em `test/render.tsx`.** So quem monta o shell precisa dele (a topbar e o login leem o tema); as telas isoladas nao. Acrescenta-lo ao harness compartilhado mudaria o ambiente dos outros 64 arquivos sem necessidade.

## Learnings

- **Montar `<AppRouter />` exige o `ThemeProvider` e um duble que atenda o shell.** O roteador traz `CondominiumProvider` proprio, que sobrescreve o contexto do harness e consulta `/condominiums` — sem servir essa rota, nenhuma tela escopada por condominio sai do estado de selecao.
- **Para afirmar "chegou na tela certa", o `h1` do `PageHeader` e o sinal.** O item de menu tem o mesmo texto, mas e link: `getByRole('heading', { level: 1, name })` desambigua sem depender da ordem no documento. E o contraponto e o texto do `PlaceholderPage` ("Modulo em construcao"), que prova o caso negativo.
- **Leitura auxiliar nao prevista deve falhar com 4xx no duble.** Um 422 nao e repetido pelo `retry` do QueryProvider, entao a tela mostra o proprio estado de erro e o cabecalho continua assertavel — um 5xx travaria o caso em tres tentativas. Mesma regra ja aprendida nas tasks anteriores, agora aplicada ao duble do roteador inteiro.
- **`window.scrollTo` faltava no `test/setup.ts`.** O `AppShell` devolve o topo da pagina a cada `pathname` novo, e o jsdom lanca "Not implemented" — uma pagina de ruido por caminho visitado. Nenhum arquivo anterior montava o shell, entao a lacuna so apareceu agora. Stub adicionado junto dos demais.

## Files / Surfaces

- `frontend/src/routes/app-router.tsx` — 8 imports, 8 caminhos em `IMPLEMENTED`, 7 rotas guardadas por permissao e `/notificacoes` sem guarda propria.
- `frontend/src/types/api.ts` — apenas o cabecalho, registrando a regra de onde mora o tipo de um recurso.
- `frontend/src/test/tier2-routes.test.tsx` — novo, 7 casos.
- `frontend/src/test/setup.ts` — stub de `window.scrollTo`.
- Nenhuma tela das tasks 1 a 4 foi alterada: a verificacao nao revelou defeito em nenhuma.

## Errors / Corrections

- Primeira rodada do teste de rotas: 7 de 7 falharam por `useTheme precisa estar dentro de <ThemeProvider>`. Causa unica — o harness compartilhado nao monta o provedor de tema, que o shell e o login exigem. Corrigido no teste; nenhuma mudanca de producao foi necessaria.

## Ready for Next Run

- **19 dos 22 itens de menu tem tela.** Seguem sem tela: **Financeiro** (`/financeiro`, `charge:read`), **Assembleias** (`/assembleias`, `assembly:read`) e **Documentos** (`/documentos`, `document:read`). Os tres continuam levando ao `PlaceholderPage`, com teste que garante isso, e os tres modulos ja existem no backend.
- Os tres sao genuinamente diferentes das dezenove: financeiro tem cobranca, pagamento, despesa e categoria num so modulo; assembleia tem enquete e voto; documento tem upload. Nenhum cabe no padrao de lista + dialogo sem desenho proprio — a razao pela qual o `_techspec.md` os deixou de fora deste tier.
