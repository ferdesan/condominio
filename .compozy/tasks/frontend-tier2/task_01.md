---
status: completed
title: Telas de Visitantes e Correspondências
type: frontend
complexity: medium
---

# Task 1: Telas de Visitantes e Correspondências

## Overview

As duas telas da portaria. Visitantes registra quem entra e sai, com check-in e
check-out e a contagem de quem está dentro agora. Correspondências registra o
que chega e dá baixa na entrega, com a contagem do que está pendente.

Ambas são CRUD mais um fluxo de linha — a forma de `features/reservations/`.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST copiar a estrutura de `frontend/src/features/reservations/` — página, hooks, schema, subpasta `components/`, kebab-case, export nomeado, sem barrel.
- MUST usar `createResourceHooks` de `frontend/src/lib/crud/` e o `useListState`; NÃO escrever `useQuery`/`useMutation` à mão para o CRUD. As ações de fluxo são hooks próprios ao lado da feature.
- MUST oferecer apenas os filtros e colunas ordenáveis que o servidor aceita (ver `_techspec.md`).
- MUST escopar toda requisição ao condomínio selecionado no shell, e explicar a exigência quando nenhum estiver selecionado.
- MUST tratar as duas classes de erro: com detalhe de campo vai para o campo; sem detalhe (409) vai para mensagem de formulário ou da linha.
- MUST oferecer filtro de excluídos e restaurar, gatilhados pela permissão de update.
- MUST esconder qualquer ação de papéis sem a permissão correspondente.
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx`. O registro das rotas é da task_05.
- MUST declarar os tipos em `frontend/src/types/visitor.ts` e `frontend/src/types/correspondence.ts`, **não** em `types/api.ts` — duas execuções anteriores quebraram por tasks concorrentes no mesmo arquivo.
- MUST fixar o condomínio de abertura no formulário (ver `CondominiumScopeNotice`).
- Visitantes: check-in e check-out são ações de linha exigindo `visitor:update`, e MUST refletir na contagem de quem está dentro.
- Visitantes: a contagem MUST vir de `/visitors/inside-count`, não de `meta.total`.
- Correspondências: dar baixa é ação de linha exigindo `correspondence:update`, e MUST reduzir a contagem de pendentes.
- Correspondências: a contagem MUST vir de `/correspondences/pending-count`.
- MUST tornar os status visualmente distinguíveis sem depender só de cor.
</requirements>

## Subtasks

- [x] 1.1 Tipos em `frontend/src/types/visitor.ts` e `types/correspondence.ts`.
- [x] 1.2 Tela de Visitantes: lista, busca, filtros, paginação, estados vazios.
- [x] 1.3 Diálogo de cadastro e edição de visitante.
- [x] 1.4 Check-in e check-out como ações de linha, com a contagem de presentes em destaque.
- [x] 1.5 Tela de Correspondências: lista, busca, filtros, paginação, estados vazios.
- [x] 1.6 Diálogo de cadastro e edição de correspondência.
- [x] 1.7 Baixa de entrega como ação de linha, com a contagem de pendentes em destaque.
- [x] 1.8 Exclusão, filtro de excluídos e restaurar nas duas.
- [x] 1.9 Gating por permissão nas duas.
- [x] 1.10 Testes das duas telas, incluindo os fluxos e suas recusas.

## Implementation Details

Criar `frontend/src/features/visitors/` e `frontend/src/features/correspondences/`.

Contratos, filtros e as rotas de fluxo estão em [`_techspec.md`](_techspec.md).
Os schemas do servidor são a fonte de verdade:
`backend/src/modules/visitors/visitor.schema.ts` e
`backend/src/modules/correspondences/correspondence.schema.ts`.

Antes de assumir a forma da resposta de `/inside-count` e `/pending-count`,
leia os serviços correspondentes — o envelope é o padrão, mas o corpo é
específico.

Ambas trazem `unit` aninhada. Use para exibir a unidade sem segunda
requisição, protegendo o acesso — pode ter sido excluída.

A rota `/visitors/access-code/:code` existe para consulta por código de acesso.
Só a use se couber naturalmente na tela; nenhum requisito depende dela.

### Relevant Files

- `frontend/src/features/reservations/` — a referência: CRUD com ações de linha e contadores.
- `frontend/src/features/reservations/components/reservation-row-actions.tsx` — a forma das ações de linha com recusa do servidor.
- `frontend/src/lib/crud/` — fábrica de hooks e estado de lista.
- `frontend/src/components/common/condominium-scope-notice.tsx` — aviso de divergência de condomínio.
- `frontend/src/test/render.tsx`, `fixtures.ts`, `api-double.ts` — harness de teste.
- `backend/src/modules/{visitors,correspondences}/` — schemas, serviços e rotas.

### Dependent Files

- task_05 — registra as rotas destas telas.

### Related ADRs

- [ADR-003](../frontend-cruds/adrs/adr-003.md) — a forma de ação de linha com recusa do servidor, estabelecida em Reservas.
- [ADR-004](../frontend-cruds/adrs/adr-004.md), [ADR-006](../frontend-cruds/adrs/adr-006.md), [ADR-008](../frontend-cruds/adrs/adr-008.md), [ADR-010](../frontend-cruds/adrs/adr-010.md) — o desenho herdado.

## Deliverables

- Telas de Visitantes e Correspondências completas, com CRUD e seus fluxos.
- Tipos em arquivos próprios, fora de `types/api.ts`.
- `app-router.tsx` intocado.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Este workflow não tem `_tests.md`. Escreva, para **cada uma das duas telas**:

- [x] Listagem: busca aplica o termo; filtro aplica o parâmetro; paginação pede a próxima página; ordenação envia `sortOrder` em maiúsculas.
- [x] Estados vazios: sem registros e sem resultado de busca são distinguíveis e oferecem a ação certa.
- [x] Sem condomínio selecionado: explica a exigência e não dispara requisição.
- [x] Cadastro: envia e a lista atualiza sem refetch manual.
- [x] Erro 422 com campo aparece no campo, sem toast; erro 409 sem campo aparece como mensagem, preservando o preenchido.
- [x] Duplo clique em salvar: uma única requisição.
- [x] Exclusão confirma antes; recusa do servidor mostra a mensagem e mantém o registro.
- [x] Excluídos: o filtro envia `includeDeleted=true`; restaurar devolve o registro.
- [x] Permissão: como operador sem `update`, as ações de fluxo não são oferecidas.
- [x] Células nulas renderizam placeholder, nunca "null".

E, específicos:

- [x] Visitantes: check-in muda o status e a contagem de presentes acompanha.
- [x] Visitantes: check-out no mesmo visitante muda o status de volta e a contagem acompanha.
- [x] Visitantes: check-out em quem não entrou é recusado pelo servidor e a mensagem aparece na linha.
- [x] Visitantes: dois cliques em check-in disparam uma requisição só.
- [x] Correspondências: dar baixa muda o status e a contagem de pendentes cai.
- [x] Correspondências: baixa em item já entregue é recusada e a mensagem aparece.
- [x] Correspondências: contagem de pendentes zero renderiza como zero, não some.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero, incluindo os 498 casos já existentes
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx` nem `frontend/src/types/api.ts`
- Nenhuma dependência de runtime nova
- Nenhuma alteração em `frontend/src/lib/crud/` ou nos componentes compartilhados
