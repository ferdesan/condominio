---
status: completed
title: Registro das rotas e verificação do pipeline
type: frontend
complexity: low
---

# Task 6: Registro das rotas e verificação do pipeline

> **Absorvida pelas tasks 01, 02 e 03.** As três rodaram de forma manual e
> sequencial, sem nenhuma task concorrente, e cada uma registrou a própria rota
> em vez de deixar uma tela inalcançável esperando por esta. As tasks 04 e 05
> não criam rota nenhuma — são acréscimos a telas existentes e um canal de
> tempo real —, então **não sobra registro a fazer aqui**.
>
> A regra do dono único continua valendo para execução em paralelo, que é o
> caso contra o qual ela foi escrita: no `frontend-tier2`, quatro tasks sobre o
> mesmo roteador foi exatamente o que a motivou. Numa cadeia sequencial ela
> cobra o preço de uma tela inalcançável e não compra nada.
>
> O que esta task garantia continua garantido, e por um mecanismo melhor:
> `src/test/routes.test.tsx` compara a contagem de rotas registradas com
> `NAV_ITEMS.length` e renderiza cada caminho de verdade. Registrar uma rota sem
> acrescentá-la a `IMPLEMENTED` — o descuido que esta task existia para pegar —
> quebra o teste na hora.

## Overview

Era a dona única de `app-router.tsx` e `navigation.ts`, na forma da `task_05` do
`frontend-tier2`. A execução sequencial tornou o arranjo desnecessário; o que
sobrou registrado aqui é o **rastro**: o que cada task fez e onde a verificação
ficou.

## O que cada task registrou

| Rota | Guarda | Menu | Task |
|---|---|---|---|
| `/esqueci-senha` | pública | não | task_01 |
| `/redefinir-senha` | pública | não | task_01 |
| `/configuracoes` | `tenant:read` | Administração | task_02 |
| `/papeis` | `role:read` | Administração | task_03 |

## Verificação ao fim da cadeia registrada

Depois de task_01, task_02 e task_03, em 2026-09-14:

```
lint       5 avisos, 0 erros   (o teto conhecido, inalterado)
typecheck  zero
test       72 arquivos / 893 casos   (69 / 810 na abertura do workflow)
build      zero
backend typecheck  zero
backend test       nao executado -- precisa de MySQL e Redis, e o backend nao foi tocado
```

<critical>
- ALWAYS READ the TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST registrar as rotas das tasks 01–03, cada uma com a guarda que lhe cabe:
  - **públicas, fora do `ProtectedRoute`**: pedido de recuperação e redefinição de senha (task_01);
  - ~~**`tenant:read`**: configurações da administradora (task_02);~~ **feito na própria task_02**;
  - ~~**`role:read`**: papéis e permissões (task_03);~~ **feito na própria task_03**.
- MUST **NÃO** acrescentar ao menu as rotas de task_01: elas são públicas e não pertencem à navegação de quem já entrou. Os itens de task_02 e task_03 já estão na seção **Administração**.
- MUST acrescentar cada caminho registrado ao conjunto `IMPLEMENTED` de `app-router.tsx`. Registrar a rota sem isso deixa o item levando ao `PlaceholderPage` — é exatamente o descuido que `routes.test.tsx` existe para pegar.
- MUST atualizar `frontend/src/test/routes.test.tsx`: a lista `REGISTERED` é escrita à mão de propósito, e a contagem é comparada com `NAV_ITEMS.length`.
- MUST acrescentar a `AUXILIARY_READS` do mesmo teste toda leitura que as telas novas fazem na montagem — uma URL não prevista responde 422 e a tela renderiza o próprio estado de erro, o que faz o caso passar pelo motivo errado.
- MUST manter `/perfil` fora da navegação: ele é alcançado pelo menu do usuário na topbar, e o teste já afirma isso.
- MUST **NÃO** alterar comportamento de nenhuma tela. Esta task registra e verifica; se algo precisar de correção, corrija o mínimo e registre o quê e o porquê.
- MUST rodar a sequência de verificação inteira e **anexar a saída real**, não um resumo.
</requirements>

## Subtasks

- [x] 6.1 ~~Registrar as rotas públicas de recuperação de senha.~~ Feito na task_01.
- [x] 6.2 ~~Registrar `/configuracoes` sob `tenant:read`, com o item de menu.~~ Feito na task_02.
- [x] 6.3 ~~Registrar `/papeis` sob `role:read`, com o item de menu.~~ Feito na task_03.
- [x] 6.4 Atualizar `IMPLEMENTED` e `REGISTERED`, com as leituras auxiliares.
- [x] 6.5 Rodar a sequência de verificação e registrar as contagens novas.
- [x] 6.6 Atualizar `tasks/README.md` e a memória do workflow com o que saiu do aberto.

## Implementation Details

`frontend/src/routes/app-router.tsx` já mostra as três formas de guarda que esta
task usa: rota pública (`/login`), rota sob permissão (a maioria) e rota
autenticada sem permissão (`/notificacoes` e `/perfil`, cada uma com o motivo
escrito no comentário acima dela). Siga o padrão e escreva o motivo.

`frontend/src/routes/navigation.ts` é a fonte única do menu: a barra lateral
renderiza a partir dele e o roteador cria uma rota de placeholder para todo item
que não esteja em `IMPLEMENTED`.

`frontend/src/test/routes.test.tsx` tem três mecanismos que precisam continuar
funcionando — leia o cabeçalho dele antes de editar:

1. `REGISTERED` escrito à mão, comparado em **contagem** com `NAV_ITEMS.length`;
2. cada caminho renderizado de verdade, afirmando que não é o placeholder;
3. cada rota com permissão negando acesso a um papel que não a tem.

### Relevant Files

- `frontend/src/routes/app-router.tsx` — o registro.
- `frontend/src/routes/navigation.ts` — o menu.
- `frontend/src/test/routes.test.tsx` — a rede de segurança.
- `frontend/src/routes/protected-route.tsx` — as guardas.
- `tasks/README.md` — a seção "O que ainda está em aberto".
- `.github/workflows/ci-cd.yml` — a ordem canônica da verificação.

### Dependent Files

- Nenhum. É a última task da cadeia.

### Related ADRs

- Nenhum novo.

## Deliverables

- Todas as rotas das tasks 01–03 registradas e alcançáveis.
- Nenhum item de menu novo: os de task_02 e task_03 já foram.
- `routes.test.tsx` cobrindo os caminhos novos.
- `tasks/README.md` com a seção de abertos atualizada.
- Saída real da sequência de verificação.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

- [ ] Cada caminho novo renderiza a tela real, e **não** o `PlaceholderPage`.
- [ ] Cada rota com permissão nega acesso a um papel que não a tem.
- [ ] As rotas de recuperação de senha são alcançáveis **sem sessão**.
- [ ] As rotas de recuperação de senha **não** aparecem na navegação lateral.
- [ ] A contagem de `REGISTERED` continua igual a `NAV_ITEMS.length`.
- [ ] A navegação lateral mostra todos os itens para o administrador, cada um com o `href` certo.
- [ ] `/perfil` continua fora da navegação e alcançável por sessão sem permissão declarada.
- [ ] Nenhum item do menu leva ao placeholder.

## Success Criteria

- Every assigned test case implemented and passing
- A sequência inteira sai zero, na ordem do CI:
  - `npm --prefix frontend run lint` — **5 avisos, 0 erros**
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run build`
  - `npm --prefix backend run typecheck`
  - `npm --prefix backend run test` (precisa de MySQL e Redis)
- As contagens novas de arquivos e casos registradas na memória do workflow — a baseline ao abrir era frontend **69 / 810**; task_02 levou a 70 / 837 e task_03 a **71 / 869**; backend segue em **16 / 151**
- Nenhuma dependência de runtime nova
- Nenhuma alteração no backend
