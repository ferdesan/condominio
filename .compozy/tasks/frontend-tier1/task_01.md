---
status: completed
title: Telas de Dependentes e Funcionários
type: frontend
complexity: medium
---

# Task 1: Telas de Dependentes e Funcionários

## Overview

Entrega duas telas CRUD escopadas ao condomínio, replicando o padrão já
estabelecido em `frontend/src/features/residents/`. Dependentes vincula-se a um
morador e sua unidade; Funcionários é um cadastro independente com dados
contratuais.

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
- MUST oferecer apenas os filtros e colunas ordenáveis que o servidor aceita (ver `_techspec.md`); um filtro fora da whitelist é ignorado em silêncio e parece quebrado.
- MUST escopar toda requisição ao condomínio selecionado no shell, e explicar a exigência quando nenhum estiver selecionado.
- MUST tratar as duas classes de erro do servidor: resposta com detalhe de campo vai para o campo; sem detalhe (409) vai para mensagem de formulário.
- MUST oferecer o filtro de excluídos e a ação restaurar, gatilhados pela permissão de update.
- MUST esconder criar, editar, excluir e restaurar de papéis sem a permissão correspondente.
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx`. O registro das rotas é da task_04.
- Dependentes: o seletor de morador MUST ser escopado ao condomínio, e escolher um morador MUST preencher a unidade dele.
- Funcionários: `salary` MUST usar `CurrencyInput`; `position` é obrigatório.
- MUST fixar o condomínio de abertura no formulário, como fazem as telas existentes (ver `CondominiumScopeNotice`).
</requirements>

## Subtasks

- [ ] 1.1 Tipos de `Dependent` e `Employee` em `frontend/src/types/api.ts`, seguindo as convenções do arquivo.
- [ ] 1.2 Tela de Dependentes: lista, busca, filtros, paginação, estados vazios.
- [ ] 1.3 Diálogo de Dependentes com seletor de morador que preenche a unidade.
- [ ] 1.4 Tela de Funcionários: lista, busca, filtros, paginação, estados vazios.
- [ ] 1.5 Diálogo de Funcionários com os campos contratuais e monetário.
- [ ] 1.6 Exclusão com confirmação, filtro de excluídos e restaurar, nas duas.
- [ ] 1.7 Gating por permissão nas duas.
- [ ] 1.8 Testes das duas telas.

## Implementation Details

Criar `frontend/src/features/dependents/` e `frontend/src/features/employees/`.

Contratos, filtros e ordenação estão em [`_techspec.md`](_techspec.md). Os
schemas do servidor são a fonte de verdade:
`backend/src/modules/dependents/dependent.schema.ts` e
`backend/src/modules/employees/employee.schema.ts`.

Dependentes trazem `resident` aninhado na resposta — use para exibir o nome do
morador sem segunda requisição, protegendo o acesso caso tenha sido excluído.

### Relevant Files

- `frontend/src/features/residents/` — a referência a copiar.
- `frontend/src/lib/crud/` — fábrica de hooks e estado de lista.
- `frontend/src/components/common/`, `ui/` — tabela, diálogo, filtros, campos.
- `frontend/src/components/common/condominium-scope-notice.tsx` — o aviso de divergência de condomínio.
- `frontend/src/test/render.tsx`, `fixtures.ts`, `api-double.ts` — harness de teste.
- `backend/src/modules/{dependents,employees}/` — schemas e repositórios.

### Dependent Files

- `frontend/src/types/api.ts` — ganha dois tipos.
- task_04 — registra as rotas destas telas.

### Related ADRs

- [ADR-004](../frontend-cruds/adrs/adr-004.md), [ADR-006](../frontend-cruds/adrs/adr-006.md), [ADR-008](../frontend-cruds/adrs/adr-008.md), [ADR-010](../frontend-cruds/adrs/adr-010.md) — o desenho herdado, que não deve ser re-decidido.

## Deliverables

- Telas de Dependentes e Funcionários completas, com lista, diálogo, exclusão e restauração.
- Tipos novos em `types/api.ts`.
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
- [ ] Dependentes: escolher morador preenche a unidade; morador excluído não quebra a linha.
- [ ] Funcionários: salário formatado na exibição e numérico no envio.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx`
- Nenhuma dependência de runtime nova
- Nenhuma alteração em `frontend/src/lib/crud/` ou nos componentes compartilhados
