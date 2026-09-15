---
status: completed
title: Recuperação de senha
type: frontend
complexity: medium
---

# Task 1: Recuperação de senha

## Overview

Hoje quem esquece a senha depende de um administrador abrir `/usuarios` e usar
o reset administrativo. As duas rotas de auto-atendimento existem no servidor
desde sempre e a tela de login não as oferece: não há link "Esqueci minha
senha", nem rota que receba o token de recuperação.

São **duas telas públicas**, fora da área autenticada: pedir o link e redefinir
com o token.

<critical>
- ALWAYS READ the TechSpec before starting — os contratos e as três armadilhas estão lá
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar `frontend/src/features/auth/forgot-password-page.tsx` e `reset-password-page.tsx`, ao lado de `login-page.tsx`, com export nomeado e sem barrel.
- MUST acrescentar um link "Esqueci minha senha" na tela de login, apontando para a rota de pedido.
- MUST manter as duas telas **públicas** — fora do `ProtectedRoute`, como `/login`. Quem já tem sessão não precisa delas.
- MUST responder **exatamente a mesma coisa** exista ou não a conta. `forgotPassword` sempre devolve 202 para impedir enumeração de contas; variar a mensagem, o tempo ou o estado da tela desfaz essa proteção no cliente.
- MUST **NÃO** usar o campo `token` que a resposta traz fora de produção. Em produção ele não vem, e uma tela que o consome funciona em desenvolvimento e falha no deploy.
- MUST ler o token de redefinição da query string (`?token=`), e tratar sua ausência como estado próprio da tela, e não como formulário vazio.
- MUST espelhar `passwordSchema` do servidor: 8–72 caracteres, com maiúscula, minúscula e número, mais confirmação conferida no cliente.
- MUST dizer, na tela de redefinição, que a troca encerra as sessões abertas — `resetPassword` chama `revokeAllForUser`.
- MUST tratar a recusa de token inválido/expirado/usado (400) como estado da tela, com caminho de volta para pedir um novo link.
- MUST **NÃO** oferecer campo `tenantSlug`. O `auth-provider.tsx` também não o envia no login; tratar e-mail repetido entre tenants é mudança do fluxo de login inteiro, e não desta tela.
- ~~MUST **NÃO** tocar `frontend/src/routes/app-router.tsx` nem `navigation.ts`. O registro é da task_06.~~ **Revogado**, como nas tasks 02 e 03: execução manual e sequencial, sem task concorrente. `/esqueci-senha` e `/redefinir-senha` foram registradas aqui, públicas e fora da navegação, com cobertura em `routes.test.tsx`.
- MUST declarar tipos novos, se houver, em `frontend/src/types/profile.ts` ou arquivo próprio — **nunca** em `types/api.ts`.
</requirements>

## Subtasks

- [x] 1.1 Tela de pedido: campo de e-mail, envio, e o estado de "enviamos, se existir".
- [x] 1.2 Link "Esqueci minha senha" na tela de login.
- [x] 1.3 Tela de redefinição: lê o token da query, nova senha e confirmação.
- [x] 1.4 Estados de recusa: token ausente, token inválido/expirado, e o caminho de volta.
- [x] 1.5 Sucesso da redefinição leva ao login com a orientação de entrar com a nova senha.
- [x] 1.6 Testes das duas telas, incluindo as recusas e a não-enumeração.

## Implementation Details

`frontend/src/features/profile/` é o precedente mais próximo: tela que consome
`/auth` sem a fábrica do ADR-008, com `useMutation` à mão e o motivo escrito no
cabeçalho do módulo de hooks. Reaproveitar a forma, não o conteúdo.

A tela de login (`login-page.tsx`) já tem a moldura visual das telas públicas —
título, cartão centralizado, alternador de tema. As duas telas novas são irmãs
dela e devem parecer irmãs.

O servidor é a fonte de verdade dos contratos:
`backend/src/modules/auth/auth.routes.ts` e `auth.schema.ts`. Antes de assumir a
forma da resposta de `forgot-password`, leia `authController.forgotPassword` —
ela responde **202** com um corpo próprio, e não o `ok()` das demais.

### Relevant Files

- `frontend/src/features/auth/login-page.tsx` — a moldura das telas públicas e o padrão de formulário com `react-hook-form` + `zodResolver`.
- `frontend/src/features/profile/` — tela que consome `/auth` sem a fábrica; `profile-hooks.ts` e `profile-schema.ts` são a referência direta.
- `frontend/src/features/profile/components/password-form.tsx` — o espelho cliente de `passwordSchema` e o aviso de que a troca desloga.
- `frontend/src/lib/form-errors.ts` — `applyApiError`, para levar a recusa ao campo certo.
- `frontend/src/routes/protected-route.tsx` — para entender o que torna uma rota pública.
- `backend/src/modules/auth/` — rotas, schema, controller e service.

### Dependent Files

- ~~task_06 — registra `/esqueci-senha` e `/redefinir-senha`.~~ Feito nesta task.

### Related ADRs

- [ADR-010](../frontend-cruds/adrs/adr-010.md) — testes mockam `@/lib/api`, e só a camada de transporte.

## O que a execução descobriu

**A não-enumeração precisa de um teste que compare os dois casos.** Verificar
que "algo aparece" depois do envio não prova nada: o que protege a informação
é as duas respostas serem **idênticas**. O caso escrito captura o texto
renderizado para uma conta existente e para uma inexistente, normaliza o
endereço digitado — o único trecho que legitimamente difere — e compara os
dois. Uma diferença de título, de frase ou de caminho quebraria o teste.

**A moldura das telas públicas virou componente.** `login-page.tsx` carregava
alternador de tema, marca e cartão centrado inline; com mais duas telas no
mesmo lugar, três cópias divergiriam na primeira mudança de marca — e
divergiriam justamente no fluxo em que a pessoa já está com um problema.
`components/auth-shell.tsx` passou a ser usado pelas três. O `h1` continua
sendo a marca; cada tela tem o próprio `h2`.

**Token curto demais recebe o mesmo tratamento do ausente.** O servidor exige
dez caracteres; um link truncado por um cliente de e-mail produziria um 400
genérico. A tela confere o comprimento antes e mostra "Link incompleto", que
explica o que aconteceu e oferece a saída.

**400 na redefinição é sobre o token, e nunca sobre a senha digitada.**
Apontar a mensagem a um campo culparia o que a pessoa escreveu. O aviso fica no
formulário, com o link de pedir um token novo — a única saída para as três
causas que o servidor não distingue (desconhecido, usado, expirado).

**Nenhuma das duas redireciona sessão existente.** O link chega por e-mail e
precisa funcionar independentemente do que o navegador guardou; mandar um
usuário logado para o painel quebraria justamente quem pediu a recuperação de
outro dispositivo. Não há guarda de anonimato neste roteador — o login a
implementa por dentro — e duplicá-la duas vezes não se pagaria.

## Verificação da execução

Sequência completa, na ordem do CI, em 2026-09-14:

```
lint       5 avisos, 0 erros   (o teto conhecido, inalterado)
typecheck  zero
test       72 arquivos / 893 casos   (baseline 71 / 869; +19 das telas, +5 de rotas)
build      zero
backend typecheck  zero
backend test       nao executado -- precisa de MySQL e Redis, e o backend nao foi tocado
```

## Deliverables

- Duas telas públicas, com o link a partir do login.
- Nenhuma dependência da resposta `token` de desenvolvimento.
- `/esqueci-senha` e `/redefinir-senha` registradas como públicas, fora do menu, cobertas por `routes.test.tsx`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

- [x] Pedido: e-mail válido dispara `POST /auth/forgot-password` com o endereço digitado.
- [x] Pedido: e-mail inexistente e e-mail existente produzem **a mesma** tela e a mesma mensagem — a asserção deve comparar os dois casos, e não só verificar que "algo aparece".
- [x] Pedido: e-mail malformado é barrado antes de chegar ao servidor.
- [x] Pedido: duplo clique dispara uma requisição só.
- [x] Redefinição: token na query é enviado junto da nova senha.
- [x] Redefinição: sem `?token=` na URL, a tela explica e oferece pedir um novo link, sem formulário de senha.
- [x] Redefinição: token recusado (400) mostra a mensagem do servidor e o caminho de volta.
- [x] Redefinição: senha fraca é barrada com a regra que faltou, sem ir ao servidor.
- [x] Redefinição: confirmação divergente é barrada no cliente.
- [x] Redefinição: o aviso de que as sessões serão encerradas está na tela antes do envio.
- [x] Login: o link "Esqueci minha senha" existe e aponta para a rota de pedido.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run lint` continua com **5 avisos e 0 erros**
- `npm --prefix frontend run test` sai zero, incluindo os 810 casos já existentes
- `git diff --name-only` **não** inclui `frontend/src/types/api.ts` nem `frontend/src/routes/navigation.ts` — as rotas são públicas e não entram no menu. `app-router.tsx` entrou nesta task (ver o requisito revogado acima)
- Nenhuma dependência de runtime nova
- Nenhuma alteração no backend
