---
status: completed
title: Tempo real (Socket.IO)
type: frontend
complexity: high
---

# Task 5: Tempo real (Socket.IO)

## Overview

O servidor tem um canal de tempo real inteiro: handshake autenticado, salas por
tenant, usuário, condomínio e unidade, e nove eventos emitidos pelos serviços de
domínio. `socket.io-client` **já está instalado** no frontend
(`package.json:44`) e **nenhum arquivo o importa**.

Hoje as listas e os contadores acompanham a própria ação, por invalidação do
React Query. O que não acontece é acompanhar a ação **de outra pessoa**: uma
correspondência registrada na portaria não aparece na tela de quem está no
escritório até ele recarregar.

<critical>
- ALWAYS READ the TechSpec before starting — o handshake e as salas estão lá
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST **invalidar consultas**, e não escrever no cache a partir do payload do evento. A arquitetura de dados do produto é "servidor é a verdade, cliente invalida": aplicar o payload direto cria um segundo caminho de escrita que diverge do primeiro no primeiro campo calculado.
- MUST conectar **apenas dentro da área autenticada** e com o access token do momento. Conexão antes do login é recusada com `UNAUTHORIZED` pelo handshake.
- MUST reconectar depois do refresh de token. O access token expira; a conexão precisa sobreviver a isso ou ser refeita, e não morrer em silêncio.
- MUST desconectar no logout, e **não** deixar o socket vivo com a credencial de uma sessão encerrada.
- MUST acompanhar o seletor de condomínio do shell com `subscribe:condominium` / `unsubscribe:condominium` — é para isso que os dois eventos existem no servidor.
- MUST degradar em silêncio quando o canal não estiver disponível. Se o socket não conectar, **tudo continua funcionando** como hoje: nenhuma tela pode depender dele para carregar. Um erro de conexão não vira toast.
- MUST **NÃO** disparar uma tempestade de invalidações. Vários eventos em sequência sobre o mesmo recurso precisam de contenção (agrupamento no tempo), ou uma operação em lote no servidor vira dezenas de requisições no cliente.
- MUST mapear cada um dos nove eventos para a chave de consulta que ele realmente afeta, e **deixar de fora** o evento que não tiver destino claro — com o motivo escrito, não em silêncio.
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx` nem `navigation.ts`.
- MUST **NÃO** alterar `frontend/src/providers/query-provider.tsx` de forma a mudar o comportamento de `retry`, `staleTime` ou o `onError` global.
- MUST testar sem abrir socket de verdade: o duble fica na fronteira, como o `@/lib/api` no ADR-010.
</requirements>

## Subtasks

- [x] 5.1 Cliente de socket: conexão autenticada, reconexão e desconexão.
- [x] 5.2 Provedor dentro da área autenticada, com o ciclo de vida ligado à sessão.
- [x] 5.3 Assinatura do condomínio selecionado, acompanhando o shell.
- [x] 5.4 Mapa evento → chave de consulta, com a contenção no tempo.
- [x] 5.5 Degradação silenciosa quando o canal não conecta.
- [x] 5.6 Testes do ciclo de vida e do mapeamento, sem socket real.

## Implementation Details

O servidor é a fonte de verdade do contrato:
`backend/src/realtime/socket-server.ts` (handshake, salas, os dois eventos de
assinatura) e `realtime.service.ts` (a lista dos nove eventos e as quatro
fachadas de emissão). Leia os dois antes de escrever qualquer coisa.

~~`frontend/src/providers/` é onde o provedor novo mora.~~ **Não houve
provedor**: nada consome contexto, então virou o hook `hooks/use-realtime.ts`,
montado em `AppShell` como `useAccountTheme`. Isso resolveu a ordem sem tocar
`app-router.tsx` e sem acrescentar um contexto sem leitores. A ordem importa: ele
precisa do usuário (`AuthProvider`), do `QueryClient` (`QueryProvider`) e do
condomínio selecionado (`CondominiumProvider`) — e `CondominiumProvider` já vive
dentro da área autenticada, em `app-router.tsx`. Decida a posição e **escreva o
porquê**, como os demais provedores fazem.

`frontend/src/lib/api.ts` já resolve o refresh de token e dispara
`auth:session-expired` no `window` quando ele falha de vez. O
`auth-provider.tsx` escuta esse evento — é o gancho pronto para derrubar o
socket junto da sessão.

As chaves de consulta de cada feature estão nos `*-hooks.ts` correspondentes,
exportadas como `<RECURSO>_KEY`. O mapa de eventos usa essas constantes, e não
strings repetidas.

**Sobre o nono evento.** `dashboard:refresh` não corresponde a um recurso: ele
pede o recarregamento de um painel inteiro. Trate-o explicitamente — ou como
invalidação da chave do painel, ou como fora de escopo com o motivo escrito.

### Relevant Files

- `backend/src/realtime/socket-server.ts` — handshake, salas, `subscribe:condominium`.
- `backend/src/realtime/realtime.service.ts` — os nove eventos e quem os emite.
- `frontend/src/lib/api.ts` — `tokenStorage`, o refresh e `auth:session-expired`.
- `frontend/src/providers/auth-provider.tsx` — o ciclo de vida da sessão e o ouvinte de expiração.
- `frontend/src/providers/condominium-provider.tsx` — o condomínio selecionado.
- `frontend/src/providers/query-provider.tsx` — o `QueryClient` e suas políticas.
- `frontend/src/features/*/[recurso]-hooks.ts` — as constantes de chave de consulta.
- ~~`frontend/src/test/render.tsx` — o harness; provavelmente precisa acomodar o provedor novo.~~ Não precisou: sem provedor, o harness ficou intocado.

### Dependent Files

- Nenhum. Esta task não cria rota nem item de menu.

### Related ADRs

- [ADR-010](../frontend-cruds/adrs/adr-010.md) — o duble fica na fronteira de transporte, e só nela.

## O que a execução descobriu

### `dashboard:refresh` é declarado e **nunca emitido**

Está no union de `RealtimeEvent` e `grep` por ele no backend inteiro encontra
só a própria declaração — nenhum serviço o dispara. Mapeá-lo seria escrever,
testar e manter um caminho que nunca executa. Ficou **fora do mapa**, com o
motivo escrito em `lib/realtime-events.ts` e um teste afirmando que ele não
invalida nada. Quando alguém passar a emiti-lo, a linha entra.

### `visitor:arrived` quase nunca chega a este frontend

`visitorService.checkIn` o emite com `emitToUnit(visitor.unitId, ...)`, e o
servidor só põe um socket na sala de uma unidade quando a conta tem `unitId` —
ou seja, quando é de morador. Um administrador ou porteiro **nunca entra nessa
sala**, e portanto nunca recebe o evento.

O mapeamento ficou assim mesmo: está correto, custa uma linha e vale no dia em
que existir o portal do morador ou o servidor passar a emitir também para o
condomínio. O que não se deve é **esperar** que ele chegue aqui — por isso a
observação está escrita em `UNIT_SCOPED_EVENTS`, e não suposta.

### A reconexão após renovação de token não precisou de plumbing

`lib/api.ts` renova o access token **em silêncio**, dentro do interceptor, e
não avisa ninguém. Em vez de inventar um evento para isso, o cliente passa
`auth` como **função**: o socket.io a chama em toda tentativa de conexão,
inclusive nas reconexões, e ela lê `tokenStorage` na hora. Token expirado
derruba a conexão, o socket.io repete com recuo, e a tentativa seguinte já sai
com o token que o interceptor renovou.

### Cinco dos oito eventos também invalidam o painel

Só onde um número dele realmente muda: visitantes dentro, ocorrências abertas,
reservas pendentes, correspondências a retirar e a posição financeira.
Comunicado publicado, notificação nova e votação não movem indicador nenhum.
Invalidar uma chave que ninguém observa é barato — o React Query só marca como
obsoleta —, mas mapear o que não muda seria escrever uma relação falsa.

### O lint pegou duas coisas que os testes não pegariam

`console.debug` não é permitido pela configuração (só `warn` e `error`), e
`console.warn` a cada tentativa de reconexão seria ruído — o ouvinte de
`connect_error` ficou deliberadamente inerte, registrado apenas para o erro não
subir como evento sem dono. E `ref.current` usado na limpeza de um efeito lê o
valor do momento da limpeza, e não o da execução: as duas referências foram
copiadas para variáveis locais dentro do efeito.

## Verificação da execução

Sequência completa, na ordem do CI, em 2026-09-14:

```
lint       5 avisos, 0 erros   (o teto conhecido, inalterado)
typecheck  zero
test       74 arquivos / 945 casos   (baseline 73 / 919; +26)
build      zero
backend typecheck  zero
backend test       nao executado -- precisa de MySQL e Redis, e o backend nao foi tocado
```

**Nenhuma suíte existente precisou mudar.** O canal só se liga dentro do shell
autenticado, e nenhuma tela passou a depender dele — que era o risco nomeado na
abertura desta task.

## Deliverables

- Canal de tempo real ligado, invalidando consultas.
- Degradação silenciosa comprovada: com o canal fora, nada muda.
- `app-router.tsx` e `navigation.ts` intocados.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

- [x] Sem sessão, nenhuma conexão é tentada.
- [x] Com sessão, a conexão leva o access token no handshake.
- [x] Logout desconecta o socket.
- [x] `auth:session-expired` desconecta o socket.
- [x] Trocar o condomínio no shell emite `unsubscribe:condominium` do anterior e `subscribe:condominium` do novo.
- [x] Cada evento mapeado invalida a chave de consulta correspondente, e **apenas** ela — um caso por evento tratado.
- [x] Vários eventos do mesmo recurso em sequência rápida produzem **uma** invalidação, e não uma por evento.
- [x] Falha de conexão não produz toast, não lança, e não impede nenhuma tela de carregar.
- [x] Um evento sem mapeamento não derruba o cliente.
- [x] **Não-regressão:** a suíte inteira passa sem alteração de asserção; nenhuma tela existente passou a depender do socket para carregar.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run lint` continua com **5 avisos e 0 erros**
- `npm --prefix frontend run test` sai zero, incluindo os casos já existentes
- `npm --prefix frontend run build` sai zero
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx`, `frontend/src/routes/navigation.ts` nem `frontend/src/types/api.ts`
- **Nenhuma dependência de runtime nova** — `socket.io-client` já está no `package.json`
- Nenhuma alteração no backend
