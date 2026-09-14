---
status: pending
title: Registro das seis rotas e verificação
type: frontend
complexity: low
---

# Task 4: Registro das seis rotas e verificação

## Overview

Liga as seis telas construídas pelas tasks 1 a 3 ao roteador, de uma vez só, e
confirma que o pipeline segue verde. Esta task existe separada porque o
roteador é o único arquivo que as três tasks paralelas precisariam tocar — e na
rodada anterior foi exatamente isso que derrubou a execução.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST registrar as seis rotas em `frontend/src/routes/app-router.tsx` e acrescentar os seis caminhos ao conjunto `IMPLEMENTED`, seguindo a forma já usada pelas rotas existentes: cada tela dentro do seu próprio `ProtectedRoute` com a permissão do item de navegação.
- MUST preservar o comentário que explica a ausência de `/blocos` **apenas se** ele deixar de valer — com a tela de Blocos registrada, o comentário precisa ser atualizado ou removido, não mantido desatualizado.
- MUST verificar que cada rota renderiza a tela real e não o `PlaceholderPage`.
- MUST confirmar que a navegação lateral leva a cada uma das seis, e que um papel sem a permissão não vê o item nem alcança a rota.
- MUST rodar a sequência do pipeline na ordem em que o CI roda — lint, typecheck, testes, build — e todos MUST passar.
- MUST NÃO alterar as telas entregues pelas tasks 1 a 3, exceto se a verificação revelar defeito; nesse caso, corrigir e dizer o que foi corrigido.
- MUST NÃO adicionar dependência de runtime.
</requirements>

## Subtasks

- [ ] 4.1 Registrar as seis rotas e atualizar o conjunto `IMPLEMENTED`.
- [ ] 4.2 Revisar o comentário sobre `/blocos`, que deixa de valer com a tela registrada.
- [ ] 4.3 Testar que cada uma das seis rotas renderiza a tela real, não o placeholder.
- [ ] 4.4 Testar o gating por permissão nas seis rotas.
- [ ] 4.5 Rodar lint, typecheck, testes e build, nessa ordem, e corrigir o que falhar.
- [ ] 4.6 Relatar quantos itens de menu seguem em placeholder depois desta entrega.

## Implementation Details

O arquivo é `frontend/src/routes/app-router.tsx`. Ele gera rotas de placeholder
para todo item de navegação **fora** do conjunto `IMPLEMENTED`, então registrar
uma tela é sempre duas coisas: declarar a rota real e acrescentar o caminho ao
conjunto.

Os seis caminhos e suas permissões já estão declarados em
`frontend/src/routes/navigation.ts` e não precisam de mudança:

| Caminho | Permissão |
|---|---|
| `/dependentes` | `dependent:read` |
| `/funcionarios` | `employee:read` |
| `/prestadores` | `service-provider:read` |
| `/veiculos` | `vehicle:read` |
| `/areas-comuns` | `common-area:read` |
| `/blocos` | `block:read` |

Atenção ao comentário acima do conjunto `IMPLEMENTED`: hoje ele explica que
`/blocos` fica de fora porque a gestão vive dentro de Unidades. Com a tela de
Blocos registrada, essa frase passa a ser falsa. Atualize-a para refletir que
existem dois caminhos para a mesma capacidade — ou remova-a, se não acrescentar.

### Relevant Files

- `frontend/src/routes/app-router.tsx` — o arquivo desta task.
- `frontend/src/routes/navigation.ts` — os itens e permissões, já declarados.
- `frontend/src/routes/protected-route.tsx` — o guard a usar.
- `frontend/src/features/misc/placeholder-page.tsx` — o que as rotas deixam de renderizar.
- `frontend/src/test/role-matrix.test.tsx`, `authorization.test.tsx` — os testes transversais existentes, a estender.
- `.github/workflows/ci-cd.yml` — a ordem dos comandos a reproduzir.

### Dependent Files

- As seis features das tasks 1 a 3 — consumidas aqui, alteradas só se a verificação achar defeito.

### Related ADRs

- [ADR-007](../frontend-cruds/adrs/adr-007.md) — a decisão que mantinha `/blocos` como placeholder, agora superada pela tela dedicada.
- [ADR-002](../frontend-cruds/adrs/adr-002.md) — a matriz de papéis contra a qual o gating é verificado.

## Deliverables

- Seis rotas registradas e alcançáveis.
- Comentário sobre `/blocos` coerente com a realidade.
- Testes de rota e de permissão para as seis.
- Pipeline verde: lint, typecheck, testes e build.
- Contagem atualizada de quantos itens de menu seguem em placeholder.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Este workflow não tem `_tests.md`. Escreva:

- [ ] Cada uma das seis rotas renderiza a tela real e **não** o `PlaceholderPage`.
- [ ] Cada uma das seis nega acesso a um papel sem a permissão correspondente.
- [ ] A navegação lateral mostra os seis itens para ADMIN e os esconde de quem não tem a permissão.
- [ ] Os itens de menu ainda não implementados continuam levando ao placeholder — o conjunto `IMPLEMENTED` não passou a esconder nada indevidamente.
- [ ] Regressão: as cinco rotas já existentes seguem funcionando.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run lint` sai zero
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero
- `npm --prefix frontend run build` sai zero
- As seis rotas renderizam tela real no navegador, não placeholder
- O relatório final diz quantos dos 22 itens de menu seguem sem tela
