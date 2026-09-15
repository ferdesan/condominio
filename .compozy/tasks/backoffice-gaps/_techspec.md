# TechSpec: Lacunas do back-office — endpoints sem interface

O menu fechou em 22 de 22 telas no `frontend-tier3`. O que sobrou não é "tela
não construída": são **rotas que o servidor expõe e nenhuma tela chama**.

Este workflow tem origem numa auditoria feita em **2026-09-14**, que comparou
cada rota de `backend/src/modules/*/*.routes.ts` com os literais de caminho em
`frontend/src`. O inventário abaixo é o resultado dessa comparação, não uma
lista de desejos.

> **`/perfil` já saiu daqui.** Era o primeiro item do inventário e foi entregue
> antes deste workflow começar, em `frontend/src/features/profile/`. Ele serve
> de referência: é o precedente mais próximo de tela que consome rotas de
> `/auth` sem passar pela fábrica de CRUD. Ver [`## Precedente`](#precedente).

## O inventário

| # | Lacuna | Rotas ociosas | Task |
|---|---|---|---|
| 1 | Recuperação de senha | `POST /auth/forgot-password`, `POST /auth/reset-password` | task_01 |
| 2 | Configurações da administradora | `GET /tenants/me`, `PATCH /tenants/me` | task_02 |
| 3 | Papéis e permissões | `/roles` (CRUD), `GET /roles/permissions` | task_03 |
| 4 | Quatro leituras órfãs | ver task_04 | task_04 |
| 5 | Tempo real | Socket.IO — nove eventos, nenhum ouvinte | task_05 |
| — | Registro das rotas e verificação | — | task_06 |

## O que está deliberadamente fora

**Portal do morador.** `POST /polls/:id/vote`, `GET /polls/:id/votes`,
`GET /financial/charges/my` e `GET /residents/my-unit` existem e continuam sem
tela. Este frontend é de back-office: a tela de Assembleias **conduz** a votação
(abre, apura) e não vota. Quem votaria é um portal que não existe, e construí-lo
é outro produto — não uma lacuna desta interface.

**`POST /auth/register`.** Auto-cadastro de administradora. É uma decisão
comercial (quem pode criar tenant, sob que plano), não uma tela faltando.

**Preferências de notificação.** `users.preferences.emailNotifications` e
`pushNotifications` são semeadas por `user.service.ts` e **nenhum código do
backend as lê** — não há despachante de e-mail nem de push. A tela de perfil as
omitiu de propósito: um interruptor ligado a nada é pior que um campo ausente.
Ligar os dois é trabalho de backend, e a decisão de fazê-lo é do dono do
produto. O mesmo vale para `preferences.locale`, sem i18n que o consuma.

**`avatarUrl`.** O servidor aceita uma URL válida e não há rota de upload. Um
campo que só aceita endereço colado de outro lugar não é a funcionalidade.

## Precedente

`frontend/src/features/profile/` foi entregue imediatamente antes deste
workflow e estabeleceu duas coisas que as tasks abaixo herdam:

- **Rota de `/auth` não passa pela fábrica do ADR-008.** Ela monta as seis
  operações de um roteador CRUD sobre um recurso; `/auth` não tem recurso —
  são rotas avulsas que agem sobre o portador do token. `profile-hooks.ts`
  escreve `useQuery`/`useMutation` à mão, e explica no cabeçalho por quê.
- **Tela sem recurso não usa `CrudLayout`.** O perfil é uma pilha de `Card`,
  um por rota, porque os efeitos não se misturam. Vale para task_02 também.

Herdadas sem alteração e **não** re-decididas: ADR-002 (personas), ADR-004
(diálogo, sem rota de detalhe), ADR-006 (excluídos visíveis e restauráveis),
ADR-008 (`lib/crud/`), ADR-009 (a tabela), ADR-010 (testes mockam `@/lib/api`).
Todas em [`../frontend-cruds/adrs/`](../frontend-cruds/adrs/).

## Os contratos, conferidos no código

### task_01 — Recuperação de senha

```
POST /auth/forgot-password   { email, tenantSlug? }  → 202
POST /auth/reset-password    { token, password }     → 204
```

Ambas são **públicas** e passam por `authRateLimiter`.

- `forgotPassword` **sempre responde sucesso**, exista a conta ou não
  (`auth.service.ts:264`) — é proteção contra enumeração de contas. A tela
  **não pode** revelar se o e-mail existe, nem variar a mensagem.
- A resposta traz `token` **apenas fora de produção**. A tela **não pode**
  depender dele para nada: em produção ele não vem.
- `resetPassword` recusa token usado, expirado ou desconhecido com
  `BadRequestError` (400) e a mensagem "Token de recuperacao invalido ou
  expirado." — uma só mensagem para os três casos, também de propósito.
- `resetPassword` chama `revokeAllForUser`: redefinir derruba toda sessão
  aberta. É o mesmo efeito de `changePassword`, já tratado no perfil.
- `password` obedece `passwordSchema`: 8–72 caracteres, com maiúscula,
  minúscula e número.

`tenantSlug` fica de fora da tela pelo mesmo motivo que já fica no login:
`auth-provider.tsx` envia só e-mail e senha. Tratar o caso de um e-mail em dois
tenants é uma mudança de fluxo de login inteiro, não um campo a mais aqui.

### task_02 — Configurações da administradora

```
GET   /tenants/me    tenant:read
PATCH /tenants/me    tenant:update
```

`updateTenantSchema` é `createTenantSchema.partial()`, então **aceita mais do
que a tela pode oferecer**. `tenantService.update:67-81` recusa com **403**, para
quem não é super-admin, qualquer um destes cinco:

> `plan`, `status`, `maxCondominiums`, `maxUsers`, `slug`

São campos comerciais. Oferecê-los faria todo salvamento falhar. A tela edita
o resto: `name`, `document` (CNPJ), `email`, `phone`, `logoUrl` e `settings`.

**`settings` é o que dá sentido a esta tela.** Três dos seis campos são lidos de
verdade, em `charge.service.ts:310-312`:

| Campo | Quem lê | O que faz |
|---|---|---|
| `chargeGraceDays` | `applyLateFees` | dias de carência antes do encargo |
| `latePenaltyPercent` | `applyLateFees` | multa, padrão 2% |
| `lateInterestPercent` | `applyLateFees` | juros, padrão 1% |
| `timezone`, `locale` | — | semeados, sem leitor |
| `primaryColor` | — | semeado, sem leitor |

Ou seja: **hoje não há onde configurar a política de encargos que o botão
"aplicar encargos" da tela de Financeiro aplica.** Os valores vêm da semente ou
do padrão embutido. Esta é a justificativa da task, e ela é concreta.

`settings` é **mesclado** no servidor (`{ ...current.settings, ...dto.settings }`),
então enviar só o que a tela oferece não apaga o resto.

### task_03 — Papéis e permissões

```
GET    /roles              role:read     (roteador CRUD padrão)
POST   /roles              role:create
GET    /roles/:id          role:read
PATCH  /roles/:id          role:update
DELETE /roles/:id          role:delete
GET    /roles/permissions  role:read     → { permissions: string[] }
```

- `/roles/permissions` devolve `{ permissions: ['*', ...PERMISSION_CATALOG] }` —
  um objeto, não um array solto.
- `roleService.assertPermissions` recusa conceder `*` a quem não é super-admin,
  com `BusinessRuleError`. O catálogo **inclui** `*`; a tela precisa tratar isso.
- `/roles` já é consumido por `user-hooks.ts:56`, que alimenta o seletor de
  papel da tela de Usuários. A nova tela **não pode** quebrar esse consumo.

### task_04 — As quatro leituras órfãs

```
GET  /dashboard/incidents-by-category  dashboard:read  ?condominiumId
GET  /financial/payments               payment:read    (paginado)
GET  /visitors/access-code/:code       visitor:read
GET  /announcements/board              announcement:read  ?condominiumId
POST /announcements/:id/read           announcement:read
```

`/dashboard/incidents-by-category` é irmã de `/expenses-by-category`, que o
painel já renderiza — mesma forma de resposta, mesmo parâmetro.

`/financial/payments` é somente leitura: a baixa acontece pela cobrança
(`POST /financial/charges/:id/payments`). O que falta é **ver** os pagamentos de
uma cobrança.

### task_05 — Tempo real

`socket.io-client` **já está em `frontend/package.json:44`** e nenhum arquivo o
importa. O servidor (`backend/src/realtime/socket-server.ts`):

- Handshake em `path: '/socket.io'`, credencial em `handshake.auth.token` — o
  mesmo access token do REST. Sem token, `UNAUTHORIZED`.
- Na conexão o socket entra sozinho nas salas do tenant, do usuário, dos
  condomínios do vínculo e da unidade. **Não há topico público.**
- `subscribe:condominium` / `unsubscribe:condominium` deixam acompanhar um
  condomínio específico a que já se tem acesso — é o gancho para o seletor do
  shell.
- Nove eventos: `notification:new`, `announcement:published`,
  `reservation:updated`, `correspondence:received`, `visitor:arrived`,
  `incident:updated`, `charge:updated`, `poll:updated`, `dashboard:refresh`.

## Ordem e paralelismo

As arestas de [`_tasks.md`](_tasks.md) formam uma **cadeia**. Isto é
intencional e não é cautela genérica: no `frontend-tier2` duas execuções em
ondas paralelas falharam — a primeira no resolvedor de conflitos, a segunda por
timeout com três agentes disputando a máquina durante a verificação. Sequencial
é mais lento no relógio e não falhou nenhuma vez.

`app-router.tsx` e `navigation.ts` são de **task_06**, e de mais ninguém. As
tasks 01–03 criam telas e **não** as registram — foi assim que o tier 2 evitou
que quatro tasks disputassem o mesmo arquivo.

## Verificação

A sequência que vale como verde, na ordem de `.github/workflows/ci-cd.yml`:

```
npm --prefix frontend run lint        # 5 avisos conhecidos, 0 erros
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run build
npm --prefix backend  run typecheck
npm --prefix backend  run test        # precisa de MySQL e Redis
```

Baseline ao abrir este workflow, medido em 2026-09-14 **depois** da entrega do
perfil: frontend **69 arquivos / 810 casos**; backend **16 suites / 151 casos**.
Os 5 avisos de lint são anteriores a todo este esforço e **não devem aumentar**:
`no-explicit-any` em `data-table.tsx` (3) e `filter-panel.tsx` (1),
`only-export-components` em `test/render.tsx` (1).
