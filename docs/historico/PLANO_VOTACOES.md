# Plano: Recurso de Votação em Assembleias

> Planejamento aprovado — guardar para execução futura.
> Sessão anterior concluiu a UX das abas financeiras (commit `ac9adaa`, branch `feat/tema-verde-e-icones`).

## Objetivo

Implementar voto do morador + gestão manual (síndico/admin registra voto por unidade), na ordem: **backend → frontend → testes**.

## Decisões aprovadas

- Rota frontend: `/votacoes/:pollId`.
- Gestão manual: **por unidade**.
- Ordem: backend primeiro.

## Permissões (já existentes, sem edição)

- `vote` está em `RESOURCES` e fora da lista de exclusão de `OPERATIONAL_RESOURCES` (`roles.ts`).
- ADMIN e SINDICO têm `vote:manage` via `manageAll` (roles.ts:49 e :58).
- RESIDENT tem `vote:create`/`vote:read` (roles.ts:123-124).
- `hasPermission` honra `<recurso>:manage` (`permissions.ts:31-35`).
- Backend: `POST /polls/:id/vote` existente usa `ctx.actor.unitId`; notificação já tem `actionUrl: /votacoes/${poll.id}` (`poll.service.ts:117`) — manter.

## Convenções

- Frontend: Vite + React 18 + Tailwind + Radix + cva + vitest (`frontend/`).
- Backend: Express + TypeORM + MySQL + zod + jest (`backend/`).
- Tools exigem `{"filePath": "..."}` em read/edit; evitar loops repetidos de glob/grep.
- Comandos frontend: `npm run typecheck|lint|test` (workdir `frontend/`).
- Comandos backend: `npm run typecheck && npm run lint && npm test` (jest `--runInBand`, `NODE_ENV=test`).
- Testes frontend: mock de `@/lib/api` + `sonner`; fixtures em `test-utils.ts`; render via `renderWithProviders` (`src/test/render.tsx`).
- `Vote`: índice único `(tenantId, pollId, unitId)`; `voterId/voterName` nullable (voto secreto).
- Migration nova é execução manual no MySQL; testes usam `synchronize`.

---

## Fase 1 — Backend (EDITADA nesta sessão — precisa verificação)

### Feito

- `assembly.schema.ts`: `castProxyVoteSchema = { unitId, optionId }` + `CastProxyVoteDTO`.
- `vote.entity.ts`: coluna `registeredByUserId` (`registered_by_user_id`, nullable).
- `assembly.routes.ts`:
  - `POST /:id/votes` com `authorize('vote:manage')` → `pollService.castVoteOnBehalf`.
  - `GET /:id/my-vote` com `authorize('vote:read')` → `pollService.myVote`.
- `poll.service.ts`:
  - `persistVote` privado (transação/audit/realtime fora; resultados/realtime nos callers).
  - `castVoteOnBehalf`: valida OPEN/janela/unidade do mesmo condomínio/`hasVoted`/opção/peso por fração; `registeredByUserId = ctx.actor.userId`; auditoria com nº da unidade.
  - `myVote`: `{voted, optionId?, votedAt?}`; em voto secreto só `{voted: true}`.
  - import `CastProxyVoteDTO`.
- `backend/src/database/migrations/1758100000000-VoteRegisteredBy.ts` criada (`down` dropa a coluna).
- `swagger.ts`: docs de `/polls/{id}/votes` e `/polls/{id}/my-vote`.

### Pendências da Fase 1

1. **Limpar `persistVote`** (`poll.service.ts` ~linhas 268-270): remover código residual
   ```ts
   const { unitId, option: _ } = { unitId: data.unitId, option: option as never };
   void _; void unitId;
   ```
   e revisar o parâmetro `unit: { id: string }` (linha 256) — passado mas pouco usado.
2. **Revisar `voterId/voterName`** em `castVoteOnBehalf`: hoje `poll.isSecret ? null : null` (sempre null) — decidir se registra identidade em voto não-secreto ou mantém null (voto é da unidade).
3. Rodar em `backend/`:
   ```
   npm run typecheck && npm run lint && npm test
   ```
4. Executar manualmente no MySQL a migration `1758100000000-VoteRegisteredBy` quando subir ambiente.

---

## Testes backend (Fase 1 cont.)

Estender `backend/tests/integration/assemblies.spec.ts`:

- proxy cria voto → 201.
- morador sem `vote:manage` → 403.
- unidade já votou → 409.
- `GET /:id/my-vote` antes e depois de votar.
- voto secreto não expõe `optionId`.

---

## Fase 2 — Frontend: voto do morador

1. Tipos `MyVote` em `frontend/src/types/assembly.ts`.
2. Hooks em `assembly-hooks.ts`:
   - `useCastVote`, `useMyVote`, `useCastProxyVote` (keys `POLLS_KEY`).
3. Componente `poll-vote-dialog.tsx`.
4. Botão **"Votar"** em `assembly-polls-dialog.tsx`.
5. Rota `/votacoes/:pollId` em `app-router.tsx` + `VotePage`.
6. Registrar em `notification-links.ts` / `KNOWN_PATHS`.

---

## Fase 3 — Frontend: gestão manual (síndico/admin)

- `poll-proxy-votes-dialog.tsx`: lista unidades + situação de voto; mini-form por linha (unidade → opção).

---

## Fase 4 — Validação e entrega

1. Testes frontend: `npm test -- --run src/features/assemblies`.
2. Typecheck + lint completos (frontend e backend).
3. Commit + push (apenas quando solicitado).

## Arquivos-chave

| Área | Arquivo |
|---|---|
| Rotas backend | `backend/src/modules/assemblies/assembly.routes.ts` |
| Serviço | `backend/src/modules/assemblies/services/poll.service.ts` |
| Schema | `backend/src/modules/assemblies/schemas/assembly.schema.ts` |
| Entidade voto | `backend/src/modules/assemblies/entities/vote.entity.ts` |
| Migration | `backend/src/database/migrations/1758100000000-VoteRegisteredBy.ts` |
| Swagger | `backend/src/config/swagger.ts` |
| Permissões | `backend/src/shared/constants/roles.ts` (referência) |
| Testes backend | `backend/tests/integration/assemblies.spec.ts` |
| Tipos/hook frontend | `frontend/src/types/assembly.ts`, `frontend/src/features/assemblies/assembly-hooks.ts` |
| Diálogos | `frontend/src/features/assemblies/components/assembly-polls-dialog.tsx` (+ novos `poll-vote-dialog.tsx`, `poll-proxy-votes-dialog.tsx`) |
| Rota/notificação | `frontend/src/routes/app-router.tsx`, `frontend/src/features/notifications/notification-links.ts` |
| Labels/testes | `frontend/src/features/assemblies/assembly-labels.ts`, `test-utils.ts`, `assemblies-page.test.tsx` |
