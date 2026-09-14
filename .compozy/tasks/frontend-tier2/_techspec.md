# TechSpec: Telas Tier 2

Oito telas que reusam o padrão verificado em
[`../frontend-cruds/`](../frontend-cruds/) e [`../frontend-tier1/`](../frontend-tier1/),
acrescentando **um fluxo de domínio cada**. Este documento não redesenha nada —
nomeia os recursos, seus contratos e o que cada um tem de diferente.

## Herança de desenho

Valem sem alteração e não devem ser re-decididos: ADR-002 (personas de
back-office), ADR-004 (diálogo, sem rota de detalhe), ADR-006 (excluídos
visíveis e restauráveis), ADR-008 (`lib/crud/`), ADR-009 (a tabela), ADR-010
(testes mockam `@/lib/api`). Todos em [`../frontend-cruds/adrs/`](../frontend-cruds/adrs/).

**Implementação de referência:** `frontend/src/features/reservations/`. É a única
existente que combina CRUD com ações de fluxo na linha (aprovar, recusar,
cancelar) — exatamente a forma das oito telas aqui.

## Os oito recursos

Seis são CRUD uniforme mais ações; dois não são CRUD.

| Recurso | Rota | Busca por | Filtros | Ordem |
|---|---|---|---|---|
| Visitantes | `/visitors` | name, document, company, vehiclePlate, badgeNumber | unitId, status, type, authorizedById | createdAt DESC |
| Correspondências | `/correspondences` | description, carrier, trackingCode, receivedBy | unitId, residentId, status, type | receivedAt DESC |
| Comunicados | `/announcements` | title, content | status, category, audience, pinned | publishedAt DESC |
| Ocorrências | `/incidents` | protocol, title, description, location | unitId, status, category, priority, assignedToId, reportedById | createdAt DESC |
| Manutenções | `/maintenances` | title, description, assetName | status, type, recurrence, serviceProviderId, responsibleId | scheduledFor ASC |
| Usuários | `/users` | name, email, phone | status, roleId, unitId | name ASC |
| Auditoria | `/audit-logs` | — | (ver abaixo) | — |
| Notificações | `/notifications` | — | (ver abaixo) | — |

Todos escopados por `condominiumId`, **exceto Usuários e Auditoria**, que são
por tenant. Visitantes e Correspondências trazem `unit` aninhada; Usuários traz
`role` e `condominiums`.

## O fluxo de cada um

Estas são as ações que distinguem estas telas de um CRUD puro. Todas são
`POST` e todas exigem permissão própria — a interface **não deve oferecer** o
que o papel não pode executar.

| Recurso | Ações | Permissão | Leitura auxiliar |
|---|---|---|---|
| Visitantes | `/:id/check-in`, `/:id/check-out` | `visitor:update` | `/inside-count`, `/access-code/:code` |
| Correspondências | `/:id/deliver` | `correspondence:update` | `/pending-count` |
| Comunicados | `/:id/publish`, `/:id/archive` | `announcement:update` | `/board` |
| Ocorrências | `/:id/status` | `incident:update` | `/summary` |
| Ocorrências | `/:id/assign` | **`incident:manage`** | — |
| Manutenções | `/:id/start`, `/:id/complete`, `/:id/cancel` | `maintenance:update` | `/upcoming` |
| Usuários | `/:id/reset-password` | **`user:manage`** | — |
| Notificações | `/read` (marcar lidas) | `notification:update` | `/unread-count` |

Atribuir ocorrência e resetar senha exigem `manage`, não `update` — papéis com
update veem as outras ações mas não estas.

## Os dois que não são CRUD

**Auditoria** (`/audit-logs`) não tem rotas de escrita. Duas leituras: a lista
geral e `/:resource/:resourceId`, que traz o histórico de um registro
específico. A tela é somente leitura — sem criar, editar, excluir ou restaurar,
e sem diálogo de formulário.

**Notificações** (`/notifications`) também não tem criação pela interface. A
tela lista o que o servidor gerou, mostra a contagem de não lidas e permite
marcar como lidas. O backend já emite eventos em tempo real e grava
`actionUrl` apontando para a tela de origem — **seguir esses links é desejável**,
mas realtime continua fora de escopo.

## Contadores

`/inside-count`, `/pending-count` e `/unread-count` devolvem um número pronto.
Use-os em vez de `meta.total` — são endpoints dedicados e mais baratos.
`/summary` e `/upcoming` devolvem estruturas próprias; leia o serviço antes de
assumir a forma.

## O que NÃO muda

- Nenhuma alteração no backend.
- Nenhuma dependência de runtime nova.
- `lib/crud/`, a tabela, os primitivos de formulário e o harness ficam como
  estão. Se algum precisar mudar, a tela está fugindo do padrão — pare e
  reavalie.

## Registro de rotas

**Nenhuma task de tela toca `frontend/src/routes/app-router.tsx`.** As oito
rotas são registradas de uma vez pela última task.

Duas execuções anteriores quebraram por arquivos compartilhados entre tasks
paralelas: primeiro o roteador, depois `types/api.ts`. Por isso, além do
roteador, **cada task adiciona seus tipos em um arquivo próprio** —
`frontend/src/types/<recurso>.ts` — em vez de todas editarem `types/api.ts`.
A última task consolida, se valer a pena.
