---
status: pending
title: Telas de Auditoria e Notificações
type: frontend
complexity: low
---

# Task 4: Telas de Auditoria e Notificações

## Overview

As duas telas somente-leitura do tier. Auditoria mostra o rastro de quem mudou
o quê, com uma visão geral e o histórico de um registro específico.
Notificações lista o que o servidor gerou para o usuário, conta as não lidas e
permite marcá-las.

**Nenhuma das duas é CRUD.** Não há criar, editar, excluir nem restaurar — e não
deve haver diálogo de formulário em lugar nenhum destas telas.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST usar a tabela e o estado de lista existentes; a leitura pode usar `createResourceHooks` apenas pela parte de listagem, ou hooks próprios — o que ficar mais simples.
- MUST **NÃO** oferecer criar, editar, excluir ou restaurar em nenhuma das duas. Estas rotas não existem no servidor.
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx`. O registro é da task_05.
- MUST declarar os tipos em `frontend/src/types/audit.ts` e `frontend/src/types/notification.ts`, **não** em `types/api.ts`.
- Auditoria: é por tenant, **não** por condomínio — a tela MUST NÃO exigir condomínio selecionado.
- Auditoria: MUST oferecer, além da lista geral, a consulta do histórico de um registro específico via `/audit-logs/:resource/:resourceId`.
- Auditoria: cada entrada MUST deixar legível quem agiu, o que mudou e quando; a diferença entre antes e depois é o conteúdo que importa.
- Notificações: marcar como lida é ação exigindo `notification:update` e MUST reduzir a contagem de não lidas.
- Notificações: a contagem MUST vir de `/notifications/unread-count`.
- Notificações: cada entrada carrega `actionUrl` apontando para a tela de origem; a interface MUST oferecer seguir esse link quando ele existir, e MUST tolerar link para rota ainda não implementada sem quebrar.
- MUST distinguir lida de não lida sem depender só de cor.
- MUST NÃO introduzir realtime; o socket continua fora de escopo, apesar de o backend emitir eventos.
</requirements>

## Subtasks

- [ ] 4.1 Tipos em `frontend/src/types/audit.ts` e `types/notification.ts`.
- [ ] 4.2 Tela de Auditoria: lista paginada, com quem, o quê e quando legíveis.
- [ ] 4.3 Consulta do histórico de um registro específico.
- [ ] 4.4 Tela de Notificações: lista, distinção entre lida e não lida, contagem de não lidas.
- [ ] 4.5 Marcar como lida, com a contagem acompanhando.
- [ ] 4.6 Seguir o `actionUrl` quando existir, tolerando rota não implementada.
- [ ] 4.7 Gating por permissão nas duas.
- [ ] 4.8 Testes das duas telas.

## Implementation Details

Criar `frontend/src/features/audit/` e `frontend/src/features/notifications/`.

As rotas estão em [`_techspec.md`](_techspec.md). Nenhum dos dois módulos usa o
roteador CRUD, então **não assuma as sete rotas padrão** — leia
`backend/src/modules/audit/audit.routes.ts` e
`backend/src/modules/notifications/notification.routes.ts` antes de escrever os
hooks.

A forma da entrada de auditoria e do corpo de `/notifications/read` é
específica; leia os serviços.

Sobre o `actionUrl`: hoje as notificações de reserva apontam para
`/reservas/{id}`, e **não existe rota de detalhe de reserva** — por ADR-004, os
módulos vivem em diálogo. Seguir esse link levaria a lugar nenhum. A tela deve
lidar com isso de forma previsível: ou navegar para a listagem correspondente,
ou não oferecer o link quando a rota não existir. Escolha uma, implemente
consistentemente, e registre a escolha no código.

Auditoria é somente leitura por natureza; a tabela já suporta isso — basta não
passar ações de linha.

### Relevant Files

- `frontend/src/features/reservations/reservations-page.tsx` — a referência de listagem com contador em destaque.
- `frontend/src/components/common/data-table.tsx` — a tabela; sem coluna de ações, fica somente leitura.
- `frontend/src/routes/navigation.ts` — note que `/notificacoes` é o único item de menu **sem permissão declarada**, portanto visível a todos.
- `frontend/src/lib/format.ts` — `formatDateTime` e `formatRelative` para as datas do rastro.
- `frontend/src/test/render.tsx`, `fixtures.ts`, `api-double.ts` — harness de teste.
- `backend/src/modules/{audit,notifications}/` — rotas e serviços; nenhum usa o roteador CRUD.

### Dependent Files

- task_05 — registra as rotas destas telas.

### Related ADRs

- [ADR-004](../frontend-cruds/adrs/adr-004.md) — por que não há rota de detalhe de reserva, que é o que torna o `actionUrl` um problema.
- [ADR-010](../frontend-cruds/adrs/adr-010.md) — a costura de teste.

## Deliverables

- Tela de Auditoria somente leitura, com lista geral e histórico por registro.
- Tela de Notificações com contagem de não lidas e marcação de leitura.
- Tratamento previsível do `actionUrl`, com a escolha registrada no código.
- Tipos em arquivos próprios, fora de `types/api.ts`.
- `app-router.tsx` intocado.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Este workflow não tem `_tests.md`. Escreva:

**Auditoria**

- [ ] Lista paginada: a paginação pede a próxima página com os parâmetros certos.
- [ ] **Sem condomínio selecionado, a tela funciona** e não pede seleção.
- [ ] Nenhuma ação de criar, editar, excluir ou restaurar é oferecida em lugar nenhum.
- [ ] Uma entrada mostra quem agiu, o que mudou e quando, de forma legível.
- [ ] O histórico de um registro específico consulta a rota por recurso e identificador.
- [ ] Lista vazia renderiza estado vazio, não tabela em branco.
- [ ] Papel sem `audit-log:read` não alcança a tela.

**Notificações**

- [ ] Lista renderiza distinguindo lida de não lida sem depender de cor.
- [ ] A contagem de não lidas vem de `/notifications/unread-count`.
- [ ] Marcar como lida reduz a contagem e muda a aparência da entrada.
- [ ] Marcar duas vezes em sequência dispara uma requisição só.
- [ ] Sem permissão de `notification:update`, marcar como lida não é oferecido.
- [ ] Contagem zero renderiza como zero, não some.
- [ ] Entrada com `actionUrl` para rota existente navega até ela.
- [ ] Entrada com `actionUrl` para rota **inexistente** se comporta como decidido, sem quebrar nem levar a tela em branco.
- [ ] Entrada sem `actionUrl` não oferece link.
- [ ] Lista vazia renderiza estado vazio.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero, incluindo tudo que já existia
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx` nem `frontend/src/types/api.ts`
- Nenhuma das duas telas oferece escrita que o servidor não suporta
- Nenhuma dependência de runtime nova; nenhum uso de socket
