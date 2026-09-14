---
status: completed
title: Telas de Manutenções e Usuários
type: frontend
complexity: medium
---

# Task 3: Telas de Manutenções e Usuários

## Overview

Manutenções acompanha o ciclo de uma ordem — agendada, iniciada, concluída ou
cancelada — e lista o que está por vir. Usuários é a única tela deste tier que
**não é escopada por condomínio**: é administração do tenant, com papel,
vínculo a condomínios e reset de senha.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST copiar a estrutura de `frontend/src/features/reservations/`.
- MUST usar `createResourceHooks` e `useListState`; as ações de fluxo são hooks próprios.
- MUST oferecer apenas os filtros e colunas ordenáveis que o servidor aceita (ver `_techspec.md`).
- MUST tratar as duas classes de erro do servidor.
- MUST oferecer filtro de excluídos e restaurar, gatilhados pela permissão de update.
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx`. O registro é da task_05.
- MUST declarar os tipos em `frontend/src/types/maintenance.ts` e `frontend/src/types/user.ts`, **não** em `types/api.ts`.
- Manutenções: MUST ser escopada ao condomínio do shell, com o aviso de divergência no formulário.
- Manutenções: iniciar, concluir e cancelar são ações de linha exigindo `maintenance:update`, e MUST respeitar o ciclo — só o que está agendado inicia, só o iniciado conclui, e o concluído não aceita mais nada.
- Manutenções: MUST usar `/maintenances/upcoming` para destacar o que está por vir, em vez de filtrar no cliente.
- Manutenções: os seletores de prestador e de responsável MUST ser escopados ao condomínio.
- **Usuários NÃO é escopada por condomínio** — é por tenant. A tela MUST NÃO exigir condomínio selecionado nem enviar `condominiumId`.
- Usuários: os filtros são `status`, `roleId` e `unitId`; a resposta traz `role` e `condominiums` aninhados e MUST exibi-los.
- Usuários: **resetar senha exige `user:manage`**, não `update` — e MUST pedir confirmação, por ser ação sensível e irreversível.
- Usuários: a tela MUST NÃO exibir nem permitir editar senha em texto; o reset é a única via.
</requirements>

## Subtasks

- [x] 3.1 Tipos em `frontend/src/types/maintenance.ts` e `types/user.ts`.
- [x] 3.2 Tela de Manutenções: lista, busca, filtros de status, tipo, recorrência, prestador e responsável.
- [x] 3.3 Diálogo de manutenção com título, descrição, ativo, agendamento, tipo e vínculos.
- [x] 3.4 Iniciar, concluir e cancelar como ações de linha, respeitando o ciclo.
- [x] 3.5 Destaque do que está por vir, a partir de `/maintenances/upcoming`.
- [x] 3.6 Tela de Usuários: lista, busca, filtros de status, papel e unidade — sem escopo de condomínio.
- [x] 3.7 Diálogo de usuário com nome, email, telefone, papel e vínculos.
- [x] 3.8 Reset de senha com confirmação, gatilhado por `user:manage`.
- [x] 3.9 Exclusão, excluídos e restaurar nas duas; gating por permissão.
- [x] 3.10 Testes das duas telas, incluindo ciclo, recusas e o escopo diferente de Usuários.

## Implementation Details

Criar `frontend/src/features/maintenances/` e `frontend/src/features/users/`.

Contratos, filtros e rotas de fluxo estão em [`_techspec.md`](_techspec.md). Os
schemas do servidor são a fonte de verdade:
`backend/src/modules/maintenances/maintenance.schema.ts` e
`backend/src/modules/users/user.schema.ts`.

Leia `maintenance.service.ts` antes de assumir as transições — o servidor decide
o que pode virar o quê.

A forma de `/maintenances/upcoming` é específica; leia o serviço.

**Atenção ao escopo de Usuários.** Todas as telas construídas até aqui seguem o
condomínio do shell. Esta não: seus filtros não incluem `condominiumId`, e
enviá-lo seria ignorado em silêncio. A tela deve funcionar com ou sem condomínio
selecionado, e **não** deve renderizar o estado de "selecione um condomínio".
Isso também significa que o `CondominiumScopeNotice` não se aplica aqui.

Os papéis disponíveis vêm de `/roles`, que é CRUD padrão. Consuma para o
seletor; não construa tela de papéis.

### Relevant Files

- `frontend/src/features/reservations/` — a referência de CRUD com ações de linha.
- `frontend/src/features/condominiums/` — a única tela existente **não** escopada por condomínio; útil como referência para Usuários.
- `frontend/src/lib/permissions.ts` — a distinção entre `update` e `manage`.
- `frontend/src/components/common/confirm-dialog.tsx` — para a confirmação do reset de senha.
- `frontend/src/lib/crud/` — fábrica de hooks e estado de lista.
- `frontend/src/test/render.tsx`, `fixtures.ts`, `api-double.ts` — harness de teste.
- `backend/src/modules/{maintenances,users,roles}/` — schemas, serviços e rotas.

### Dependent Files

- task_05 — registra as rotas destas telas.

### Related ADRs

- [ADR-002](../frontend-cruds/adrs/adr-002.md) — a matriz de papéis; aqui separa reset de senha das demais ações.
- [ADR-003](../frontend-cruds/adrs/adr-003.md) — ações de linha com ciclo de vida e recusa do servidor.
- [ADR-004](../frontend-cruds/adrs/adr-004.md), [ADR-006](../frontend-cruds/adrs/adr-006.md), [ADR-008](../frontend-cruds/adrs/adr-008.md), [ADR-010](../frontend-cruds/adrs/adr-010.md) — o desenho herdado.

## Deliverables

- Tela de Manutenções com CRUD, ciclo de vida e destaque do que está por vir.
- Tela de Usuários, por tenant e não por condomínio, com reset de senha confirmado.
- Tipos em arquivos próprios, fora de `types/api.ts`.
- `app-router.tsx` intocado.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Este workflow não tem `_tests.md`. Escreva, para **cada uma das duas telas**:

- [x] Listagem: busca, filtros, paginação e ordenação enviam os parâmetros corretos.
- [x] Estados vazios distinguíveis, com a ação certa.
- [x] Cadastro e edição atualizam a lista sem refetch manual.
- [x] Erro 422 no campo, sem toast; erro 409 como mensagem, preservando o preenchido.
- [x] Duplo clique em salvar: uma requisição só.
- [x] Exclusão confirma; recusa mostra a mensagem do servidor.
- [x] Excluídos e restaurar funcionam e respeitam a permissão.
- [x] Células nulas renderizam placeholder.

E, específicos:

- [x] Manutenções: agendada oferece iniciar e cancelar, não concluir.
- [x] Manutenções: iniciada oferece concluir e cancelar, não iniciar.
- [x] Manutenções: concluída não oferece nenhuma das três.
- [x] Manutenções: recusa do servidor numa transição aparece na linha e o status não muda.
- [x] Manutenções: o destaque do que está por vir vem de `/maintenances/upcoming`.
- [x] Manutenções: sem condomínio selecionado, explica a exigência.
- [x] Usuários: **sem condomínio selecionado, a tela funciona normalmente** e não pede seleção.
- [x] Usuários: nenhuma requisição da tela envia `condominiumId`.
- [x] Usuários: papel e condomínios vinculados aparecem na listagem.
- [x] Usuários: com `user:update` mas sem `manage`, resetar senha **não** é oferecido.
- [x] Usuários: com `manage`, resetar senha é oferecido e pede confirmação antes de disparar.
- [x] Usuários: dispensar a confirmação não dispara requisição nenhuma.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero, incluindo tudo que já existia
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx` nem `frontend/src/types/api.ts`
- A tela de Usuários é utilizável sem nenhum condomínio selecionado
- Nenhuma dependência de runtime nova
- Nenhuma alteração em `frontend/src/lib/crud/` ou nos componentes compartilhados
