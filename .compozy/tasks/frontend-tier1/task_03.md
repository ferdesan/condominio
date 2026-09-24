---
status: completed
title: Telas de Áreas comuns e Blocos
type: frontend
complexity: medium
---

# Task 3: Telas de Áreas comuns e Blocos

## Overview

Áreas comuns é a tela mais rica deste tier: seus 17 campos governam as nove
regras de reserva que o servidor aplica, então editar uma área muda o
comportamento do formulário de Reservas. Blocos promove a gestão que já existe
dentro de Unidades a uma rota própria, reaproveitando os componentes em vez de
reescrevê-los.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST copiar a estrutura de `frontend/src/features/residents/` — página, hooks, schema, subpasta `components/`, kebab-case, export nomeado, sem barrel.
- MUST usar a fábrica `createResourceHooks` de `frontend/src/lib/crud/` e o `useListState`; NÃO escrever `useQuery`/`useMutation` à mão.
- MUST oferecer apenas os filtros e colunas ordenáveis que o servidor aceita (ver `_techspec.md`).
- MUST escopar toda requisição ao condomínio selecionado no shell, e explicar a exigência quando nenhum estiver selecionado.
- MUST tratar as duas classes de erro do servidor: resposta com detalhe de campo vai para o campo; sem detalhe (409) vai para mensagem de formulário.
- MUST oferecer o filtro de excluídos e a ação restaurar, gatilhados pela permissão de update.
- MUST esconder criar, editar, excluir e restaurar de papéis sem a permissão correspondente.
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx`. O registro das rotas é da task_04.
- MUST fixar o condomínio de abertura no formulário, como fazem as telas existentes (ver `CondominiumScopeNotice`).
- Áreas comuns: MUST cobrir os 17 campos, incluindo os parâmetros que governam as regras de reserva.
- Áreas comuns: MUST validar localmente `closesAt > opensAt` e `maxHours >= minHours`, que o servidor também exige e devolve com caminho de campo.
- Áreas comuns: `availableWeekdays` é array de inteiros de 0 a 6 e MUST ter um seletor de dias da semana, não um campo de texto. Array vazio e nulo MUST ser distinguíveis — nulo significa todos os dias.
- Áreas comuns: MUST deixar evidente, ao editar, que esses parâmetros governam o formulário de Reservas.
- Blocos: MUST reaproveitar `frontend/src/features/units/components/block-manager-dialog.tsx` e o formulário que ele usa, NÃO reescrevê-los.
- Blocos: a gestão embutida em Unidades MUST continuar funcionando; esta tela é adicional, não substituta.
</requirements>

## Subtasks

- [ ] 3.1 Tipos `CommonArea` e `Block` em `frontend/src/types/api.ts` — verificar se já existem de tasks anteriores antes de criar.
- [ ] 3.2 Tela de Áreas comuns: lista, busca, filtros de status e exigência de aprovação, paginação, estados vazios.
- [ ] 3.3 Diálogo de Áreas comuns cobrindo os 17 campos, agrupados de forma legível.
- [ ] 3.4 Seletor de dias da semana para `availableWeekdays`.
- [ ] 3.5 Validações cruzadas locais de horário e duração.
- [ ] 3.6 Extrair a gestão de blocos de Unidades para componentes reutilizáveis, sem quebrar o uso existente.
- [ ] 3.7 Tela de Blocos consumindo esses componentes.
- [ ] 3.8 Exclusão com confirmação, filtro de excluídos e restaurar, nas duas.
- [ ] 3.9 Gating por permissão nas duas.
- [ ] 3.10 Testes das duas telas, incluindo a regressão da gestão dentro de Unidades.

## Implementation Details

Criar `frontend/src/features/common-areas/` e `frontend/src/features/blocks/`.

Contratos e filtros estão em [`_techspec.md`](_techspec.md). Os schemas do
servidor são a fonte de verdade:
`backend/src/modules/common-areas/common-area.schema.ts` e
`backend/src/modules/blocks/block.schema.ts`.

**Nenhum dos dois tem relação aninhada na resposta.** As listagens mostram só
campos próprios.

Os 17 campos de área comum pedem agrupamento no diálogo — identificação,
disponibilidade, regras de reserva, custo — em vez de uma lista corrida. O
diálogo tem largura máxima fixa; use a variante larga, como fez Condomínios.

Sobre Blocos: a gestão existe hoje em
`frontend/src/features/units/components/block-manager-dialog.tsx` e
`block-form-dialog.tsx`, por [ADR-007](../frontend-cruds/adrs/adr-007.md).
A extração deve manter esses componentes funcionando de dentro de Unidades — a
tela nova é um segundo ponto de entrada para a mesma capacidade, não uma
substituição. Se a extração exigir mudar a assinatura deles, ajuste também o uso
em Unidades e cubra com teste.

Os tipos `CommonArea` e `Block` podem já existir em `types/api.ts`, criados pela
task_01 do workflow anterior. Verifique antes de duplicar.

### Relevant Files

- `frontend/src/features/residents/` — a referência de estrutura.
- `frontend/src/features/condominiums/components/condominium-form-dialog.tsx` — o formulário mais largo já feito; o de área comum é comparável.
- `frontend/src/features/units/components/block-manager-dialog.tsx`, `block-form-dialog.tsx` — a reaproveitar.
- `frontend/src/features/units/units-page.tsx` — o consumidor atual da gestão de blocos.
- `frontend/src/features/reservations/reservation-rules.ts` — lê estes parâmetros; útil para entender o impacto.
- `frontend/src/lib/crud/` — fábrica de hooks e estado de lista.
- `frontend/src/test/render.tsx`, `fixtures.ts`, `api-double.ts` — harness de teste.
- `backend/src/modules/{common-areas,blocks}/` — schemas e repositórios.

### Dependent Files

- `frontend/src/types/api.ts` — pode ganhar dois tipos, se ainda não existirem.
- `frontend/src/features/units/` — a extração dos componentes de bloco toca esta feature.
- task_04 — registra as rotas destas telas.

### Related ADRs

- [ADR-007](../frontend-cruds/adrs/adr-007.md) — por que blocos vivem dentro de Unidades hoje; esta tela não revoga isso, adiciona um caminho.
- [ADR-003](../frontend-cruds/adrs/adr-003.md) — as nove regras de reserva que estes parâmetros governam.
- [ADR-004](../frontend-cruds/adrs/adr-004.md), [ADR-006](../frontend-cruds/adrs/adr-006.md), [ADR-008](../frontend-cruds/adrs/adr-008.md), [ADR-010](../frontend-cruds/adrs/adr-010.md) — o desenho herdado.

## Deliverables

- Tela de Áreas comuns completa, com os 17 campos e as validações cruzadas.
- Tela de Blocos reaproveitando os componentes existentes.
- Gestão de blocos dentro de Unidades preservada e coberta por teste.
- `app-router.tsx` intocado.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Este workflow não tem `_tests.md`. Escreva, para **cada uma das duas telas**:

- [ ] Listagem: busca aplica o termo; filtro aplica o parâmetro correto; paginação pede a próxima página; ordenação envia `sortOrder` em maiúsculas.
- [ ] Estados vazios: sem registros oferece cadastrar; busca sem resultado oferece limpar — e são distinguíveis.
- [ ] Sem condomínio selecionado: explica a exigência e não dispara requisição.
- [ ] Cadastro: envia e a lista atualiza sem refetch manual.
- [ ] Erro 422 com campo: aparece no campo, sem toast.
- [ ] Erro 409 sem campo: aparece como mensagem do formulário, preservando o preenchido.
- [ ] Duplo clique em salvar: uma única requisição.
- [ ] Exclusão: confirma antes; 409 de impedimento mostra a mensagem do servidor e mantém o registro.
- [ ] Excluídos: o filtro envia `includeDeleted=true`; restaurar devolve o registro.
- [ ] Permissão: montada como operador (STAFF), nenhuma ação de escrita é oferecida.
- [ ] Células nulas renderizam placeholder, nunca a string "null".

E, específicos:

- [ ] Áreas comuns: `closesAt` anterior a `opensAt` rejeitado no campo `closesAt`.
- [ ] Áreas comuns: `maxHours` menor que `minHours` rejeitado no campo `maxHours`.
- [ ] Áreas comuns: seletor de dias grava array de inteiros; nenhum dia selecionado e "todos os dias" produzem valores distintos.
- [ ] Áreas comuns: taxa de reserva exibida como dinheiro e enviada como número.
- [ ] Áreas comuns: os 17 campos vêm preenchidos ao editar um registro existente.
- [ ] Blocos: exclusão de bloco com unidades mostra a recusa do servidor e mantém o bloco.
- [ ] Blocos: **regressão** — a gestão de blocos dentro da tela de Unidades continua funcionando após a extração.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero, incluindo os testes pré-existentes de Unidades
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx`
- Nenhuma dependência de runtime nova
- Nenhuma alteração em `frontend/src/lib/crud/` ou nos componentes compartilhados de `components/`
