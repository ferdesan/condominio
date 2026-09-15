---
status: completed
title: Papéis e permissões
type: frontend
complexity: medium
---

# Task 3: Papéis e permissões

## Overview

`/roles` tem CRUD completo no servidor e o frontend só o lê para preencher o
seletor de papel da tela de Usuários (`user-hooks.ts:56`). `GET /roles/permissions`,
que devolve o catálogo inteiro de permissões do sistema, nunca foi chamado.

O efeito: dá para **atribuir** um papel a alguém, e não dá para ver o que aquele
papel permite, nem criar um papel novo, nem ajustar um existente. O controle de
acesso do produto é configurável no servidor e opaco na interface.

<critical>
- ALWAYS READ the TechSpec before starting — o tratamento do curinga `*` está lá
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar `frontend/src/features/roles/` seguindo a estrutura das telas de CRUD — página, hooks, schema, `<recurso>-labels.ts`, subpasta `components/`.
- MUST usar `createResourceHooks` de `frontend/src/lib/crud/` e o `useListState` para o CRUD; NÃO escrever `useQuery`/`useMutation` à mão para as seis operações. O catálogo de permissões é uma leitura própria, ao lado da feature.
- MUST **NÃO** quebrar o consumo existente de `/roles` em `user-hooks.ts`. Se a chave de cache mudar, os dois consumidores mudam juntos e a tela de Usuários continua verde.
- MUST montar o seletor de permissões a partir de `GET /roles/permissions`, e **não** de uma lista escrita no cliente. Uma cópia local diverge do servidor no primeiro recurso novo.
- MUST tratar o curinga `*`: o catálogo o inclui, e `roleService.assertPermissions` recusa concedê-lo a quem não é super-admin. A tela **não pode** oferecê-lo a quem a recusa alcança — e se o oferecer, a recusa precisa aparecer como mensagem, e não como falha silenciosa.
- MUST agrupar as permissões de forma legível. O catálogo é uma lista plana de `recurso:acao` com dezenas de entradas; despejá-la como uma coluna de caixas de seleção não é uma interface.
- MUST distinguir, na listagem, os papéis do sistema dos papéis criados pelo tenant — editar ou excluir um papel de sistema tem consequência diferente.
- MUST oferecer excluídos e restaurar, gatilhados pela permissão de update (ADR-006), salvo se o roteador do recurso desabilitar a operação — conferir em `role.routes.ts` antes de assumir.
- MUST esconder toda ação de papéis sem a permissão correspondente: `role:create`, `role:update`, `role:delete`.
- MUST **NÃO** herdar o condomínio selecionado no shell: papel é por tenant.
- ~~MUST **NÃO** tocar `frontend/src/routes/app-router.tsx` nem `navigation.ts`. O registro é da task_06.~~ **Revogado**, pelo mesmo motivo da task_02: execução manual e sequencial, sem task concorrente. `/papeis` foi registrada aqui, com o item de menu e a cobertura em `routes.test.tsx`.
- MUST declarar os tipos em `frontend/src/types/role.ts`, **não** em `types/api.ts`. Conferir o que `types/user.ts` já declara de `Role` e reconciliar sem duplicar.
</requirements>

## Subtasks

- [x] 3.1 Tipos em `frontend/src/types/role.ts`, reconciliados com o `Role` de `types/user.ts`.
- [x] 3.2 Hooks de CRUD pela fábrica, mais a leitura do catálogo de permissões.
- [x] 3.3 Listagem: papéis, contagem de permissões, origem (sistema ou do tenant).
- [x] 3.4 Diálogo de cadastro e edição, com o seletor de permissões agrupado.
- [x] 3.5 Visualização do que um papel permite, sem precisar entrar em edição.
- [x] 3.6 Tratamento do curinga `*` e da recusa de concedê-lo.
- [x] 3.7 Exclusão, excluídos e restaurar, se o roteador os oferecer.
- [x] 3.8 Gating por permissão.
- [x] 3.9 Testes da tela, incluindo o curinga e a não-regressão de Usuários.

## Implementation Details

Criar `frontend/src/features/roles/`.

`frontend/src/features/users/` é a referência estrutural mais próxima: recurso
por tenant, sem escopo de condomínio, com diálogo sobre a lista. E é também o
consumidor existente de `/roles` — leia `user-hooks.ts` antes de mexer na chave
de cache.

O catálogo vem de `roleService.catalog()`, que devolve
`{ permissions: ['*', ...PERMISSION_CATALOG] }` — **um objeto**, não um array
solto. A fonte do catálogo é `backend/src/shared/constants/permissions.ts`; leia
para entender a forma `recurso:acao` e decidir o agrupamento.

`backend/src/shared/constants/roles.ts` tem a matriz semeada dos cinco papéis do
sistema — é o que `src/test/render.tsx` espelha no harness de teste.

### Relevant Files

- `frontend/src/features/users/` — a estrutura irmã; `user-hooks.ts:56` é o consumidor existente de `/roles`.
- `frontend/src/features/users/components/user-form-dialog.tsx` — diálogo com seleção múltipla (condomínios) por `Checkbox` + `Controller`.
- `frontend/src/lib/crud/` — fábrica de hooks e estado de lista.
- `frontend/src/lib/permissions.ts` — como o cliente avalia permissão, incluindo o curinga.
- ~~`frontend/src/types/user.ts` — o `Role` que já existe.~~ Mudou para `frontend/src/types/role.ts` nesta task.
- `backend/src/modules/roles/` — rotas, schema e service.
- `backend/src/shared/constants/permissions.ts` e `roles.ts` — o catálogo e a matriz semeada.

### Dependent Files

- ~~task_06 — registra `/papeis` e o item de menu.~~ Feito nesta task.

### Related ADRs

- [ADR-004](../frontend-cruds/adrs/adr-004.md) — diálogo sobre a lista, sem rota de detalhe.
- [ADR-006](../frontend-cruds/adrs/adr-006.md) — excluídos visíveis e restauráveis.
- [ADR-008](../frontend-cruds/adrs/adr-008.md) — a fábrica de hooks.
- [ADR-009](../frontend-cruds/adrs/adr-009.md), [ADR-010](../frontend-cruds/adrs/adr-010.md).

## O que a execução descobriu

**`Role` morava no arquivo errado.** Estava em `types/user.ts`, mas não é um
tipo de usuário — é um recurso próprio que `User` apenas referencia. Mudou
para `types/role.ts`, e `types/user.ts` passou a importá-lo. Quatro
consumidores da tela de Usuários trocaram de caminho de import; nenhuma
asserção mudou. Reexportar de `user.ts` daria dois caminhos válidos para o
mesmo símbolo, que é o que o cabeçalho de `api.ts` recusa.

**A chave de cache compartilhada com a tela de Usuários é um recurso, e não um
risco.** A fábrica invalida `[ROLES_KEY]` a cada mutação, e o prefixo alcança
`['roles', 'options']` — criar um papel aqui faz a tela de Usuários passar a
oferecê-lo, sem uma linha a mais. O comentário de `user-hooks.ts` que parecia
alertar contra isso protege a listagem de **usuários**, que tem outra chave.

**Editar um papel do sistema envia um corpo de um campo só.**
`roleService.beforeUpdate` recusa `permissions` pela **presença da chave**, e
não pelo conteúdo: reenviar as mesmas permissões seria recusado com 409. Por
isso `toSystemRolePayload` manda apenas `description`. Tem teste afirmando que
nem `permissions` nem `name` viajam.

**`manage` não marca as outras quatro ações.** No servidor ele *resolve* as
demais (`hasPermission` o trata como curinga do recurso), mas não as *contém* —
o papel guarda exatamente o que foi concedido. Marcá-las junto gravaria cinco
permissões onde o servidor esperava uma. A coluna é destacada e a implicação
está escrita na tela.

**A matriz é montada do catálogo recebido, e um recurso desconhecido cai em
"Outros".** `PERMISSION_GROUPS` decide a ordem, e nunca quais permissões
existem. Um recurso novo no backend aparece com o identificador técnico até
ganhar rótulo — visivelmente incompleto, e nunca silenciosamente ausente. Há
teste para os dois casos.

## Verificação da execução

Sequência completa, na ordem do CI, em 2026-09-14:

```
lint       5 avisos, 0 erros   (o teto conhecido, inalterado)
typecheck  zero
test       71 arquivos / 869 casos   (baseline 70 / 837; +32 desta tela)
build      zero
backend typecheck  zero
backend test       nao executado -- precisa de MySQL e Redis, e o backend nao foi tocado
```

A suíte de `features/users/` passou **sem alteração de asserção**, que era o
risco nomeado na abertura desta task.

## Deliverables

- Tela de papéis com CRUD e o catálogo de permissões do servidor.
- Tela de Usuários continua verde, com o mesmo comportamento.
- Tipos em `types/role.ts`, fora de `types/api.ts`.
- `/papeis` registrada, no menu e coberta por `routes.test.tsx`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

- [x] Listagem: busca, filtro, paginação e ordenação enviam o que o servidor aceita.
- [x] Estados vazios: sem registros e sem resultado de busca são distinguíveis.
- [x] O seletor de permissões é montado a partir de `GET /roles/permissions`, e não de uma lista local — asserção sobre a chamada.
- [x] Cadastro envia o conjunto de permissões escolhido e a lista atualiza sem refetch manual.
- [x] Curinga: a recusa de conceder `*` a quem não é super-admin aparece como mensagem, preservando o preenchido.
- [x] Papel de sistema é visualmente distinguível de papel criado pelo tenant.
- [x] Ver o que um papel permite não exige entrar em edição.
- [x] Erro 422 com campo aparece no campo; 409 sem campo vira mensagem de formulário.
- [x] Duplo clique em salvar dispara uma requisição só.
- [x] Exclusão confirma antes; recusa do servidor mantém o registro e mostra a mensagem.
- [x] Sem `role:create`/`update`/`delete`, as ações correspondentes não são oferecidas.
- [x] A tela não dispara requisição escopada a condomínio.
- [x] **Não-regressão:** a suíte de `features/users/` continua passando sem alteração de asserção.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run lint` continua com **5 avisos e 0 erros**
- `npm --prefix frontend run test` sai zero, incluindo os casos já existentes
- `git diff --name-only` **não** inclui `frontend/src/types/api.ts` (o roteador e a navegação entraram nesta task, ver o requisito revogado acima)
- Nenhuma dependência de runtime nova
- Nenhuma alteração no backend, em `frontend/src/lib/crud/` ou nos componentes compartilhados
