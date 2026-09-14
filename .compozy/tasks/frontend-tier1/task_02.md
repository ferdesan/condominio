---
status: pending
title: Telas de Prestadores e Veículos
type: frontend
complexity: medium
---

# Task 2: Telas de Prestadores e Veículos

## Overview

Entrega duas telas CRUD escopadas ao condomínio, replicando o padrão já
estabelecido em `frontend/src/features/residents/`. Prestadores é um cadastro de
fornecedores com vínculo contratual e avaliação. Veículos vincula-se
opcionalmente a uma unidade e a um morador — pode existir sem nenhum dos dois.

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
- MUST fixar o condomínio de abertura no formulário, como fazem as telas existentes (ver `CondominiumScopeNotice`).
- Prestadores: `document` MUST aceitar **CPF ou CNPJ** — 11 ou 14 dígitos — validando e formatando os dois casos.
- Prestadores: `rating` é inteiro de 1 a 5 e MUST ser apresentado como avaliação, não como número cru.
- Veículos: `plate` MUST espelhar o `plateSchema` do servidor.
- Veículos: `unitId` e `residentId` são **opcionais** — a tela MUST aceitar veículo sem dono cadastrado, e a listagem MUST renderizar essas linhas sem quebrar.
</requirements>

## Subtasks

- [ ] 2.1 Tipos `ServiceProvider` e `Vehicle` em `frontend/src/types/api.ts`, seguindo as convenções do arquivo.
- [ ] 2.2 Tela de Prestadores: lista, busca, filtros de status e tipo de serviço, paginação, estados vazios.
- [ ] 2.3 Diálogo de Prestadores com razão social, documento CPF/CNPJ, contato, vigência de contrato e avaliação.
- [ ] 2.4 Tela de Veículos: lista, busca por placa e modelo, filtros de unidade, morador, tipo e status, paginação, estados vazios.
- [ ] 2.5 Diálogo de Veículos com placa, dados do veículo e vínculos opcionais de unidade e morador.
- [ ] 2.6 Exclusão com confirmação, filtro de excluídos e restaurar, nas duas.
- [ ] 2.7 Gating por permissão nas duas.
- [ ] 2.8 Testes das duas telas.

## Implementation Details

Criar `frontend/src/features/service-providers/` e `frontend/src/features/vehicles/`.

Contratos, filtros e ordenação estão em [`_techspec.md`](_techspec.md). Os
schemas do servidor são a fonte de verdade:
`backend/src/modules/service-providers/service-provider.schema.ts` e
`backend/src/modules/vehicles/vehicle.schema.ts`.

**Veículos** trazem `unit` aninhada na resposta — use para exibir o número da
unidade sem segunda requisição, protegendo o acesso, já que o vínculo é opcional
e a unidade pode ter sido excluída.

**Prestadores não têm relação aninhada.** A listagem mostra só campos próprios.

O documento de prestador é o único campo do tier que aceita dois formatos. O
helper `formatDocument` em `frontend/src/lib/format.ts` já distingue 11 de 14
dígitos na exibição; a validação de entrada precisa fazer o mesmo.

### Relevant Files

- `frontend/src/features/residents/` — a referência a copiar.
- `frontend/src/lib/crud/` — fábrica de hooks e estado de lista.
- `frontend/src/lib/format.ts` — `formatDocument` já cobre CPF e CNPJ.
- `frontend/src/components/common/`, `ui/` — tabela, diálogo, filtros, campos.
- `frontend/src/components/common/condominium-scope-notice.tsx` — aviso de divergência de condomínio.
- `frontend/src/test/render.tsx`, `fixtures.ts`, `api-double.ts` — harness de teste.
- `backend/src/modules/{service-providers,vehicles}/` — schemas e repositórios.

### Dependent Files

- `frontend/src/types/api.ts` — ganha dois tipos.
- task_04 — registra as rotas destas telas.

### Related ADRs

- [ADR-004](../frontend-cruds/adrs/adr-004.md), [ADR-006](../frontend-cruds/adrs/adr-006.md), [ADR-008](../frontend-cruds/adrs/adr-008.md), [ADR-010](../frontend-cruds/adrs/adr-010.md) — o desenho herdado, que não deve ser re-decidido.

## Deliverables

- Telas de Prestadores e Veículos completas, com lista, diálogo, exclusão e restauração.
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

E, específicos:

- [ ] Prestadores: documento de 11 e de 14 dígitos ambos aceitos e formatados corretamente; 10 dígitos rejeitado no campo.
- [ ] Prestadores: avaliação fora de 1 a 5 rejeitada antes do envio.
- [ ] Veículos: placa em formato inválido rejeitada no campo.
- [ ] Veículos: cadastro sem unidade e sem morador é aceito, e a linha renderiza sem quebrar.
- [ ] Veículos: veículo cuja unidade foi excluída ainda renderiza, com a ausência explícita.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx`
- Nenhuma dependência de runtime nova
- Nenhuma alteração em `frontend/src/lib/crud/` ou nos componentes compartilhados
