---
status: pending
title: Registro das oito rotas e verificação final
type: frontend
complexity: low
---

# Task 5: Registro das oito rotas e verificação final

## Overview

Liga as oito telas construídas pelas tasks 1 a 4 ao roteador, de uma vez, e
confirma que o pipeline segue verde. Com isso o menu passa a ter 19 das 22
telas — sobram apenas Financeiro, Assembleias e Documentos, que são
genuinamente diferentes e ficam para um esforço próprio.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST registrar as oito rotas em `frontend/src/routes/app-router.tsx` e acrescentar os oito caminhos ao conjunto `IMPLEMENTED`, seguindo a forma já usada: cada tela no seu próprio `ProtectedRoute` com a permissão do item de navegação.
- MUST notar que `/notificacoes` é o único item **sem permissão declarada** em `navigation.ts`; a rota dele não recebe guard de permissão, apenas o de autenticação.
- MUST verificar que cada rota renderiza a tela real e não o `PlaceholderPage`.
- MUST consolidar os tipos: as tasks 1 a 4 criaram `frontend/src/types/<recurso>.ts` para evitar conflito entre execuções concorrentes. Avalie se vale reexportá-los de `types/api.ts` para manter um ponto de entrada único, ou deixar como está. **Decida e registre o motivo** — não deixe metade em cada lugar sem explicação.
- MUST rodar a sequência do pipeline na ordem do CI — lint, typecheck, testes, build — e todos MUST passar.
- MUST NÃO alterar as telas entregues pelas tasks 1 a 4, exceto se a verificação revelar defeito; nesse caso, corrigir e dizer o que foi corrigido.
- MUST NÃO adicionar dependência de runtime.
</requirements>

## Subtasks

- [ ] 5.1 Registrar as oito rotas e atualizar o conjunto `IMPLEMENTED`.
- [ ] 5.2 Tratar `/notificacoes`, que não tem permissão declarada.
- [ ] 5.3 Decidir e executar a consolidação dos tipos, registrando o motivo.
- [ ] 5.4 Testar que cada uma das oito rotas renderiza a tela real.
- [ ] 5.5 Testar o gating por permissão nas sete que têm permissão.
- [ ] 5.6 Rodar lint, typecheck, testes e build, nessa ordem, e corrigir o que falhar.
- [ ] 5.7 Relatar quantos dos 22 itens de menu seguem sem tela.

## Implementation Details

O arquivo é `frontend/src/routes/app-router.tsx`. Ele gera rotas de placeholder
para todo item de navegação **fora** do conjunto `IMPLEMENTED`, então registrar
uma tela é sempre duas coisas: declarar a rota real e acrescentar o caminho ao
conjunto.

Os oito caminhos e suas permissões já estão em `frontend/src/routes/navigation.ts`:

| Caminho | Permissão |
|---|---|
| `/visitantes` | `visitor:read` |
| `/correspondencias` | `correspondence:read` |
| `/comunicados` | `announcement:read` |
| `/ocorrencias` | `incident:read` |
| `/manutencoes` | `maintenance:read` |
| `/usuarios` | `user:read` |
| `/auditoria` | `audit-log:read` |
| `/notificacoes` | **nenhuma** |

O item de notificações não declara permissão, e o predicado do frontend trata
permissão ausente como liberada — por isso ele aparece para todos hoje. Mantenha
esse comportamento; não invente uma permissão que o servidor não exige.

Sobre os tipos: a fragmentação em arquivos por recurso foi uma medida contra
conflito de merge entre tasks concorrentes, não uma decisão de arquitetura. Com
tudo integrado, ela pode ou não valer a pena manter. Qualquer que seja a
escolha, o resultado deve ser coerente — ou tudo central, ou tudo por recurso
com `types/api.ts` reexportando.

### Relevant Files

- `frontend/src/routes/app-router.tsx` — o arquivo desta task.
- `frontend/src/routes/navigation.ts` — os itens e permissões, já declarados.
- `frontend/src/lib/permissions.ts` — onde permissão ausente é tratada como liberada.
- `frontend/src/types/api.ts` e `frontend/src/types/<recurso>.ts` — a consolidação a decidir.
- `frontend/src/test/role-matrix.test.tsx`, `authorization.test.tsx` — os testes transversais a estender.
- `.github/workflows/ci-cd.yml` — a ordem dos comandos a reproduzir.

### Dependent Files

- As oito features das tasks 1 a 4 — consumidas aqui, alteradas só se a verificação achar defeito.

### Related ADRs

- [ADR-002](../frontend-cruds/adrs/adr-002.md) — a matriz de papéis contra a qual o gating é verificado.
- [ADR-001](../frontend-cruds/adrs/adr-001.md) — sem mudança no backend; a permissão ausente de notificações é do servidor, não a inventamos.

## Deliverables

- Oito rotas registradas e alcançáveis.
- Tipos consolidados de forma coerente, com o motivo registrado.
- Testes de rota e de permissão para as oito.
- Pipeline verde: lint, typecheck, testes e build.
- Contagem atualizada de quantos dos 22 itens seguem sem tela.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Este workflow não tem `_tests.md`. Escreva:

- [ ] Cada uma das oito rotas renderiza a tela real e **não** o `PlaceholderPage`.
- [ ] As sete com permissão negam acesso a um papel que não a tem.
- [ ] `/notificacoes` é alcançável por qualquer papel autenticado, e negada a quem não está autenticado.
- [ ] A navegação lateral mostra os oito itens para ADMIN.
- [ ] Os itens ainda não implementados — Financeiro, Assembleias, Documentos — continuam levando ao placeholder.
- [ ] Regressão: as onze rotas já existentes seguem funcionando.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run lint` sai zero
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run test` sai zero
- `npm --prefix frontend run build` sai zero
- As oito rotas renderizam tela real, não placeholder
- Os tipos estão coerentes num só esquema, com o motivo registrado
- O relatório final diz quantos dos 22 itens seguem sem tela
