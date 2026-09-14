# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- Tasks 1 a 7 implementados. Suite do frontend: 40 arquivos / 347 casos, verde; lint, typecheck, test, build e test:cov todos saindo zero.
- As cinco perguntas em aberto do `_prd.md` foram respondidas e registradas la: quatro resolvidas, uma (link de notificacao para `/reservas/{id}`) deliberadamente em aberto ate existir tela de notificacoes.

## Shared Decisions

- **Dialogo aberto durante troca de condominio:** quem *grava* fica preso ao condominio em que abriu (formularios de unidade, morador, reserva, bloco e geracao em lote); quem so *lista* acompanha o shell (gestao de blocos). Isso reconcilia IT-185/US-027.EC-3 com IT-205/US-030.EC-5, que a leitura ingenua faz colidir. O aviso e `components/common/condominium-scope-notice.tsx`, renderizado por todo dialogo escopado.
- As telas fixam o condominio no proprio estado que abre o dialogo (`FormTarget` carrega `condominiumId`), e nao dentro do dialogo. Ao editar um registro o id vem do proprio registro, nao do shell.

## Shared Learnings

- **Finais de linha:** o repositorio guarda LF e nao tem `.gitattributes`; `core.autocrlf=false`. Ferramentas de edicao nesta maquina Windows escrevem CRLF e inflam o diff para o arquivo inteiro. Conferir com `file <path> | grep CRLF` antes de entregar e normalizar se preciso.
- **Subprocessos dentro da suite:** um teste que executa o proprio runner (`vitest run` aninhado) precisa de `--no-file-parallelism`. Sem isso a pool aninhada disputa CPU com a suite de fora e empurra os casos de jornada pesados para alem do `testTimeout` de 5s — falha que so aparece sob `--coverage`, e que parece defeito dos testes antigos.
- O `setup.ts` compartilhado so preenche lacunas do jsdom e esta guardado por `typeof window !== 'undefined'`, entao um arquivo pode declarar `@vitest-environment node` (necessario para esbuild/`loadConfigFromFile`, que quebram sob jsdom).

## Open Risks

- Os cinco `warning` de lint que sobram (`no-explicit-any` em `data-table.tsx` e `filter-panel.tsx`, `only-export-components` em `test/render.tsx`) sao anteriores a este esforco. O lint do CI tem `continue-on-error: true`, entao nao travam o portao — mas travariam se alguem ligar `--max-warnings 0`.

## Handoffs

- O portao do pipeline esta conferido por teste (`src/test/pipeline-gate.test.ts`): job de teste sem tolerancia a falha, `build` dependendo dele, e o reporter `json` que escreve o `coverage-final.json` que o upload aponta. Mexer em `.github/workflows/ci-cd.yml` ou nos reporters de cobertura quebra esse arquivo de proposito.
