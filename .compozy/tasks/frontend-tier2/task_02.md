---
status: completed
title: Telas de Comunicados e Ocorrências
type: frontend
complexity: medium
---

# Task 2: Telas de Comunicados e Ocorrências

## Overview

Duas telas com ciclo de vida editorial. Comunicados nasce rascunho, é publicado
e depois arquivado. Ocorrências abre com protocolo, muda de status ao longo do
atendimento e pode ser atribuída a um responsável — atribuir exige permissão
mais alta que as demais ações.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST copiar a estrutura de `frontend/src/features/reservations/`.
- MUST usar `createResourceHooks` e `useListState`; as ações de fluxo são hooks próprios ao lado da feature.
- MUST oferecer apenas os filtros e colunas ordenáveis que o servidor aceita (ver `_techspec.md`).
- MUST escopar toda requisição ao condomínio selecionado no shell.
- MUST tratar as duas classes de erro do servidor, como as telas existentes.
- MUST oferecer filtro de excluídos e restaurar, gatilhados pela permissão de update.
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx`. O registro é da task_05.
- MUST declarar os tipos em `frontend/src/types/announcement.ts` e `frontend/src/types/incident.ts`, **não** em `types/api.ts`.
- MUST fixar o condomínio de abertura no formulário (ver `CondominiumScopeNotice`).
- Comunicados: publicar e arquivar são ações de linha exigindo `announcement:update`, e MUST respeitar o ciclo — um rascunho publica, um publicado arquiva, e o que já está arquivado não faz nem um nem outro.
- Comunicados: o conteúdo é texto longo e MUST usar `Textarea`, não `Input`.
- Comunicados: `pinned` e `audience` são filtros do servidor e MUST aparecer como controles.
- Ocorrências: mudar status é ação de linha exigindo `incident:update`.
- Ocorrências: **atribuir exige `incident:manage`**, não `update` — um papel com update vê mudar status mas NÃO vê atribuir.
- Ocorrências: o seletor de responsável MUST ser escopado ao condomínio.
- Ocorrências: `priority` MUST ser visualmente distinguível sem depender só de cor, sendo CRITICAL o caso que mais importa.
- MUST usar `/incidents/summary` para os indicadores, em vez de contar no cliente.
</requirements>

## Subtasks

- [x] 2.1 Tipos em `frontend/src/types/announcement.ts` e `types/incident.ts`.
- [x] 2.2 Tela de Comunicados: lista, busca, filtros de status, categoria, público e fixados.
- [x] 2.3 Diálogo de comunicado com título, conteúdo longo, categoria, público e fixação.
- [x] 2.4 Publicar e arquivar como ações de linha, respeitando o ciclo de vida.
- [x] 2.5 Tela de Ocorrências: lista, busca, filtros de status, categoria, prioridade e responsável.
- [x] 2.6 Diálogo de ocorrência com protocolo, título, descrição, local, categoria e prioridade.
- [x] 2.7 Mudança de status como ação de linha.
- [x] 2.8 Atribuição de responsável, gatilhada por `incident:manage`.
- [x] 2.9 Indicadores de ocorrências a partir de `/incidents/summary`.
- [x] 2.10 Exclusão, excluídos e restaurar nas duas; gating por permissão.
- [x] 2.11 Testes das duas telas, incluindo os fluxos, o ciclo de vida e as recusas.

## Implementation Details

Criar `frontend/src/features/announcements/` e `frontend/src/features/incidents/`.

Contratos, filtros e rotas de fluxo estão em [`_techspec.md`](_techspec.md). Os
schemas do servidor são a fonte de verdade:
`backend/src/modules/announcements/announcement.schema.ts` e
`backend/src/modules/incidents/incident.schema.ts`.

Leia `backend/src/modules/announcements/announcement.service.ts` e
`incident.service.ts` antes de assumir as transições permitidas — o servidor é
a autoridade sobre o que pode virar o quê, e a interface deve refletir isso em
vez de inventar regra própria.

A forma de `/incidents/summary` é específica; leia o serviço antes de consumir.

A rota `/announcements/board` existe para a visão de mural, voltada ao morador.
Não é necessária para a tela administrativa; ignore-a salvo se couber
naturalmente.

`Textarea` já existe em `frontend/src/components/ui/textarea.tsx`.

### Relevant Files

- `frontend/src/features/reservations/` — a referência: CRUD com ações de linha, estados e recusas.
- `frontend/src/components/ui/textarea.tsx` — para o conteúdo longo do comunicado.
- `frontend/src/components/ui/badge.tsx`, `badge-variants.ts` — apresentação de status e prioridade.
- `frontend/src/lib/crud/` — fábrica de hooks e estado de lista.
- `frontend/src/test/render.tsx`, `fixtures.ts`, `api-double.ts` — harness de teste.
- `backend/src/modules/{announcements,incidents}/` — schemas, serviços e rotas.

### Dependent Files

- task_05 — registra as rotas destas telas.

### Related ADRs

- [ADR-003](../frontend-cruds/adrs/adr-003.md) — ações de linha e recusa do servidor apresentada como resultado normal.
- [ADR-002](../frontend-cruds/adrs/adr-002.md) — a distinção entre `update` e `manage`, que aqui separa mudar status de atribuir.
- [ADR-004](../frontend-cruds/adrs/adr-004.md), [ADR-006](../frontend-cruds/adrs/adr-006.md), [ADR-008](../frontend-cruds/adrs/adr-008.md), [ADR-010](../frontend-cruds/adrs/adr-010.md) — o desenho herdado.

## Deliverables

- Telas de Comunicados e Ocorrências completas, com CRUD e seus fluxos.
- Ciclo de vida do comunicado respeitado na interface.
- Atribuição de ocorrência gatilhada pela permissão correta.
- Tipos em arquivos próprios, fora de `types/api.ts`.
- `app-router.tsx` intocado.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Este workflow não tem `_tests.md`. Escreva, para **cada uma das duas telas**:

- [x] Listagem: busca, filtros, paginação e ordenação enviam os parâmetros corretos.
- [x] Estados vazios distinguíveis, com a ação certa em cada.
- [x] Sem condomínio selecionado: explica a exigência e não dispara requisição.
- [x] Cadastro e edição atualizam a lista sem refetch manual.
- [x] Erro 422 no campo, sem toast; erro 409 como mensagem, preservando o preenchido.
- [x] Duplo clique em salvar: uma requisição só.
- [x] Exclusão confirma; recusa mostra a mensagem do servidor.
- [x] Excluídos e restaurar funcionam e respeitam a permissão.
- [x] Células nulas renderizam placeholder.

E, específicos:

- [x] Comunicados: rascunho oferece publicar e não oferece arquivar.
- [x] Comunicados: publicado oferece arquivar e não oferece publicar.
- [x] Comunicados: arquivado não oferece nenhuma das duas.
- [x] Comunicados: recusa do servidor numa transição aparece na linha e o status não muda.
- [x] Comunicados: conteúdo longo é aceito e enviado inteiro.
- [x] Ocorrências: mudar status reflete na lista.
- [x] Ocorrências: montada com `incident:update` mas sem `manage`, atribuir **não** é oferecido e mudar status é.
- [x] Ocorrências: montada com `manage`, as duas são oferecidas.
- [x] Ocorrências: o seletor de responsável lista só gente do condomínio selecionado.
- [x] Ocorrências: indicadores vêm de `/incidents/summary`; falha neles não derruba a lista.
- [x] Ocorrências: prioridade CRITICAL é distinguível sem depender de cor.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero, incluindo tudo que já existia
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx` nem `frontend/src/types/api.ts`
- Nenhuma dependência de runtime nova
- Nenhuma alteração em `frontend/src/lib/crud/` ou nos componentes compartilhados
