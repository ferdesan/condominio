# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Manutencoes (escopada por condominio, tres acoes de ciclo, destaque do que esta por vir) e Usuarios (por tenant, reset de senha sob `user:manage`). Entregue. Suite: 62 arquivos / 691 casos, verde; baseline 58/619.

## Important Decisions

- **Ciclo de Manutencoes gatilhado por status, contra o padrao da shared memory.** O `task_03.md` exige o ciclo na interface e o `## Tests` dele — que e o contrato de teste deste workflow, ja que nao existe `_tests.md` — cobra as tres assercoes. Pela escada de precedencia isso vence a nota de memoria. As duas condicoes que a propria memoria exige para a excecao estao satisfeitas: o task file pede explicitamente, e o ciclo e fechado. O recorte nunca oferece o que o servidor recusaria.
- **`estimatedCost`, `notes` e `attachments` ficam fora do formulario**, por ausencia de requisito — mesmo criterio ja usado em comunicados e ocorrencias. Todos tem default ou sao nulaveis no servidor, entao a criacao passa sem eles.
- **`scopeToCondominium` e copia deliberada de `scopeAssignees` (ocorrencias), nao import.** Sao seis linhas puras; importar acoplaria duas telas independentes, e `lib/crud/` nao muda nesta entrega.
- **A colecao de condominios do formulario de Usuarios vem do contexto do shell**, nao de uma consulta. E a lista do tenant, ja carregada, e assim a tela nao adiciona requisicao — o que tambem mantem verdadeira a assercao de que nenhuma requisicao dela envia `condominiumId`.
- **`/units` da tela de Usuarios vai sem `condominiumId`.** O `baseQuery` do servidor ja restringe aos condominios visiveis pelo token, entao a colecao nunca extrapola o que a pessoa pode ver.

## Learnings

- **`await screen.findByRole('table')` nao prova que as linhas chegaram.** O `DataTable` renderiza `<table>` desde o primeiro quadro, com uma linha de "Carregando..." no lugar dos dados. Custou 16 falhas de uma vez: toda assercao sobre botao de linha ou celula falhava por "unable to find". Esperar pelo conteudo (o titulo do registro) e o unico sinal confiavel.
- **Erro de fixture em consulta auxiliar precisa ser 4xx.** O `retry` do `QueryProvider` repete 5xx ate tres vezes, e o estado de erro nao chega dentro do teste. Ocorrencias ja usava 422 por esse motivo.
- **Botao fora de dialogo modal so e alcancavel por texto.** O Radix marca o resto da pagina como `aria-hidden`, entao `getByRole('button', { name })` nao enxerga o gatilho de troca de condominio; `getByText` sim. Ja documentado em comunicados.
- **`legend` de `fieldset` com o mesmo texto de um rotulo de campo** deixa duas coisas com o mesmo nome no mesmo dialogo. A secao do agendamento virou "Programacao" para nao colidir com o campo "Agendamento".

## Files / Surfaces

- `frontend/src/types/{maintenance,user}.ts` — novos; `types/api.ts` intocado.
- `frontend/src/features/maintenances/` — hooks, labels, schema, pagina, 5 componentes, test-utils, 2 arquivos de teste (39 casos).
- `frontend/src/features/users/` — hooks, labels, schema, pagina, 4 componentes, test-utils, 2 arquivos de teste (33 casos).
- Nada mais foi tocado: `git diff --name-only` traz so o `README.md`, que ja estava modificado antes desta execucao.

## Errors / Corrections

- Primeira rodada: 18 de 39 casos de manutencoes falharam. Causa unica nos dois grupos — esperar pela tabela em vez do conteudo (ver Learnings), mais o 500 na fixture do destaque e o `getByRole` no botao fora do modal. Corrigido nos testes; nenhuma mudanca de producao foi necessaria.

## Ready for Next Run

- `MaintenancesPage` (`features/maintenances/maintenances-page.tsx`) e `UsersPage` (`features/users/users-page.tsx`), export nomeado, sem barrel, nenhuma registra rota — para a task_05.
- **A task_05 precisa saber que `/usuarios` nao se comporta como as outras sete.** Se o teste de rota montar a tela sem condominio selecionado esperando o estado de "selecione um condominio", vai falhar por desenho, e nao por defeito.
