# Plano de Implementação — SaaS de Gestão de Condomínios

> Gerado em 2026-09-11 a partir da análise do código-fonte atual (não de suposições).
> Base do escopo: `task-condominio-completo.md`. Ver também `code-review.md` (prompt de auditoria de qualidade — objetivo diferente deste documento, que é **o que falta implementar**).

---

## 1. Resumo do estado atual

### Backend (`backend/`) — maduro, é a parte mais avançada do projeto
Stack conforme especificado (Node + Express + TypeScript + TypeORM + MySQL 8 + Redis + JWT + Socket.IO + Swagger + Docker).

- **~25 módulos de domínio** completos com entity → repository → service → schema (zod) → controller/routes: `tenants`, `roles`, `users`, `auth` (JWT + refresh token + reset de senha), `condominiums`, `blocks`, `units`, `residents`, `dependents`, `employees`, `service-providers`, `vehicles`, `visitors`, `correspondences`, `common-areas`, `reservations`, `financial` (categorias, cobranças, pagamentos, despesas), `assemblies` + `polls` + `votes`, `announcements`, `incidents`, `maintenances`, `documents`, `notifications`, `audit`, `dashboard`.
- RBAC completo (`shared/constants/{resources,permissions,roles}.ts`) com wildcard `*` e `<recurso>:manage`, escopo multi-tenant (`tenant-scoped.entity.ts`) e guarda de referência cruzada (`reference-guard.ts`).
- Realtime via Socket.IO (`realtime/socket-server.ts`, `realtime.service.ts`) e job agendado de inadimplência (`jobs/overdue.job.ts`).
- Swagger/OpenAPI publicado (`config/swagger.ts`, `/api/v1/docs`), health check, rate limit (Redis com fallback em memória), cache service, upload de arquivos (`multer` + `/uploads` estático).
- Migration inicial única e abrangente (`database/migrations/1757600000000-InitialSchema.ts`, ~830 linhas) + seed de demonstração (`database/seeds/seed.ts`).
- **Testes**: 8 specs de integração (auth, segurança/RBAC/multi-tenant, estrutura de condomínio, reservas, financeiro, assembleias, operação, dashboard/admin) + 7 specs unitárias. Cobertura boa nos fluxos centrais.
- `backend/Dockerfile` existe.

Conclusão: o backend cobre **toda** a lista de requisitos funcionais do escopo. O trabalho que resta aqui é QA/cobertura de teste e amarração de DevOps — não construção de features novas (ver seção 2.5–2.6).

### Frontend (`frontend/`) — fundação pronta, telas de produto pendentes
Stack conforme especificado (React + Vite + TS + Tailwind + Radix/shadcn-style + React Query + React Router + Framer Motion (instalado) + Recharts).

- Fundação sólida: `AppShell` (sidebar + topbar), tema claro/escuro (`theme-provider`), auth provider com refresh automático de token (`lib/api.ts`), `CondominiumProvider` (seletor de condomínio/tenant), `ProtectedRoute` por permissão, React Query configurado, Sonner (toasts) já plugado no `App.tsx`.
- Navegação **já mapeia os 21 módulos** do produto em `routes/navigation.ts`, cada item com sua permissão (`condominium:read`, `resident:read`, `charge:read` etc.) — é a fonte única que gera o menu e as rotas.
- Único ponto de dado real hoje: **Login** e **Dashboard** (`features/dashboard`, com stat cards, gráfico financeiro, gráfico de despesas e feed de atividade, tudo consumindo `/dashboard/*`).
- **Todos os outros 21 itens de menu renderizam `PlaceholderPage`** (`features/misc/placeholder-page.tsx`), cujo próprio texto confirma o gap: *"A API de {módulo} já está disponível; a tela ainda será implementada."*
- Kit de UI (`components/ui/`) só tem: `button`, `input`, `label`, `select`, `dropdown-menu`, `skeleton`, `avatar`, `card`, `badge`. **Faltam** os componentes que toda tela de CRUD vai precisar (ver 2.2), mesmo já estando instalados como dependência do Radix (`@radix-ui/react-dialog`, `-checkbox`, `-popover`, `-switch`, `-tabs`, `-tooltip`).
- `types/api.ts` só tipa `AuthUser`, `Condominium` (parcial) e os DTOs do dashboard — faltam os tipos dos ~20 domínios restantes.
- **Zero arquivos de teste** (`*.test.*`/`*.spec.*`) apesar de Vitest + Testing Library configurados e com `test/setup.ts` pronto.

### DevOps / Documentação — pendente
- **Não existe `docker-compose.yml`** em lugar nenhum do repositório. Os scripts `docker:up` / `docker:down` / `docker:logs` do `package.json` raiz chamam `docker compose` e **vão falhar hoje** por falta do arquivo — é uma inconsistência ativa, não só um item faltante.
- **Não existe `Dockerfile` no frontend** (o backend tem; o frontend não).
- **Não existe `.github/workflows`** — não há CI/CD (GitHub Actions é requisito explícito do escopo).
- `README.md` na raiz contém apenas dois comandos `compozy exec` — não é o "README completo" pedido nos entregáveis.
- Não há `.env.example` na raiz (existe em `backend/` e `frontend/` individualmente, o que é suficiente para rodar sem Docker, mas o Compose vai precisar de variáveis próprias).

---

## 2. Pendências detalhadas

### 2.1 Telas de módulo (frontend) — 21 pendentes

Todas têm API pronta; é "somente" construir a UI. Ordem sugerida de prioridade de negócio na tabela:

| # | Módulo | Rota | Permissão | Endpoints backend |
|---|--------|------|-----------|--------------------|
| 1 | Condomínios | `/condominios` | `condominium:read` | `/condominiums` |
| 2 | Blocos e torres | `/blocos` | `block:read` | `/blocks` |
| 3 | Unidades | `/unidades` | `unit:read` | `/units` |
| 4 | Moradores | `/moradores` | `resident:read` | `/residents` |
| 5 | Dependentes | `/dependentes` | `dependent:read` | `/dependents` |
| 6 | Funcionários | `/funcionarios` | `employee:read` | `/employees` |
| 7 | Prestadores | `/prestadores` | `service-provider:read` | `/service-providers` |
| 8 | Visitantes | `/visitantes` | `visitor:read` | `/visitors` |
| 9 | Veículos | `/veiculos` | `vehicle:read` | `/vehicles` |
| 10 | Correspondências | `/correspondencias` | `correspondence:read` | `/correspondences` |
| 11 | Áreas comuns | `/areas-comuns` | `common-area:read` | `/common-areas` |
| 12 | Reservas | `/reservas` | `reservation:read` | `/reservations` |
| 13 | Assembleias (+ votação) | `/assembleias` | `assembly:read` | `/assemblies`, `/polls` |
| 14 | Comunicados | `/comunicados` | `announcement:read` | `/announcements` |
| 15 | Financeiro | `/financeiro` | `charge:read` | `/financial/*` (categorias, cobranças, pagamentos, despesas) |
| 16 | Ocorrências | `/ocorrencias` | `incident:read` | `/incidents` |
| 17 | Manutenções | `/manutencoes` | `maintenance:read` | `/maintenances` |
| 18 | Documentos | `/documentos` | `document:read` | `/documents` (upload) |
| 19 | Notificações | `/notificacoes` | — (todo usuário) | `/notifications` (+ Socket.IO) |
| 20 | Usuários | `/usuarios` | `user:read` | `/users`, `/roles` |
| 21 | Auditoria | `/auditoria` | `audit-log:read` | `/audit-logs` |
| — | Meu perfil | `/perfil` | — (todo usuário) | `/auth/me`, troca de senha |

### 2.2 Kit de UI incompleto (bloqueia a 2.1)
Componentes que precisam existir em `components/ui/` antes de sair construindo telas (todas as libs já são dependência, só falta o wrapper shadcn-style):
- `dialog.tsx` (modais de criar/editar/confirmar exclusão)
- `table.tsx` + um componente `data-table` (paginação, ordenação, busca — todo módulo lista dados paginados, o backend já devolve `meta` de paginação)
- `form.tsx` (wrapper de `react-hook-form` + `zod` via `@hookform/resolvers`, já nas dependências mas sem uso ainda)
- `textarea.tsx`, `checkbox.tsx`, `switch.tsx`, `tabs.tsx`, `tooltip.tsx`, `popover.tsx`
- Um `combobox`/`command` para selects com busca (ex.: escolher unidade/morador em formulários)
- Um `date-picker` (reservas, assembleias, manutenções recorrentes)
- `confirm-dialog.tsx` (excluir/desativar — soft delete no backend)
- `pagination.tsx` alinhado ao formato `PaginationMeta` de `lib/api.ts`

### 2.3 Tipos e camada de API do frontend
- Estender `types/api.ts` (ou dividir por feature) com os tipos de todos os domínios da tabela 2.1 — hoje só há `AuthUser`, `Condominium` e os DTOs de dashboard.
- Criar, por módulo, um `api.ts` de feature com as chamadas via `apiGet/apiPost/apiPatch/apiDelete` (já existem e tratam envelope + paginação + erro).

### 2.4 Testes automatizados do frontend (zero hoje)
- Configurar smoke tests dos providers (`auth-provider`, `condominium-provider`, `theme-provider`).
- Testes de `ProtectedRoute` (nega acesso sem permissão, redireciona sem sessão).
- Testes de cada tela nova ao menos no fluxo: lista carrega, cria, edita, exclui (mock do axios ou MSW).

### 2.5 Backend — lacunas de cobertura de teste (confirmadas por busca no código)
Não há `describe`/rota testada em `backend/tests/integration` para:
- `documents` (upload/listagem/remoção)
- `dependents`
- `employees`
- `service-providers`
- `common-areas` (CRUD da área em si — hoje só `reservations.spec.ts` testa a **reserva** sobre a área, não o cadastro da área)

### 2.6 Backend — itens a confirmar com o dono do produto
- **LGPD**: existe base (soft delete via `deleted_at`, anonimato opcional em ocorrências), mas **não há endpoint de exportação/anonimização de dados pessoais a pedido do titular**. Confirmar se o escopo exige isso explicitamente antes de implementar.
- Não há pasta `.github/workflows`, então nenhum gate automático de lint/typecheck/test roda hoje em PRs.

### 2.7 DevOps — Docker Compose (ausente)
Precisa orquestrar: `mysql:8`, `redis`, `api` (build `backend/Dockerfile`), `web` (build de um Dockerfile novo do frontend), e idealmente um volume de `uploads` e healthchecks. Os scripts `docker:up/down/logs` do `package.json` raiz já esperam esse arquivo no lugar certo.

### 2.8 DevOps — Dockerfile do frontend (ausente)
Build multi-stage (Vite build → Nginx ou `serve`) servindo os estáticos e com proxy reverso para `/api/v1` até o serviço `api`.

### 2.9 DevOps — CI/CD (ausente)
`.github/workflows/ci.yml`: lint + typecheck + test para `backend` e `frontend` em paralelo, cache de `npm`, matriz mínima de Node 20. Opcional: workflow de build/push de imagem Docker.

### 2.10 Documentação
`README.md` real: como subir com Docker Compose e sem Docker, variáveis de ambiente, como rodar migrations/seed, como acessar Swagger, credenciais de demo (o seed já cria usuários — documentar).

---

## 3. Plano de implementação faseado

> Ordem pensada para não bloquear: primeiro a fundação de UI (2.2), depois os módulos por dependência de dados (estrutura → pessoas → operação), DevOps pode andar em paralelo a qualquer momento por outra pessoa/thread.

### Fase 0 — Fundação de UI no frontend
- [ ] Completar `components/ui/`: `dialog`, `table`/`data-table`, `form`, `textarea`, `checkbox`, `switch`, `tabs`, `tooltip`, `popover`, `pagination`, `confirm-dialog`, `date-picker`, `combobox`
- [ ] Padrão de feature: `features/<modulo>/{lista,form,api,types}` seguindo o estilo já usado em `features/dashboard`
- [ ] Hook genérico de CRUD sobre React Query (`useResourceList`, `useResourceMutation`) para não reescrever paginação/cache-invalidation em cada módulo

### Fase 1 — Estrutura
- [ ] Condomínios (`/condominios`) — CRUD + seletor já existente em `CondominiumProvider`
- [ ] Blocos e torres (`/blocos`)
- [ ] Unidades (`/unidades`) — incluir geração em lote (endpoint já suporta, conforme `condominium-structure.spec.ts`)

### Fase 2 — Pessoas
- [ ] Moradores (`/moradores`)
- [ ] Dependentes (`/dependentes`)
- [ ] Funcionários (`/funcionarios`)
- [ ] Prestadores (`/prestadores`)

### Fase 3 — Portaria
- [ ] Visitantes (`/visitantes`) — pré-autorização + check-in/check-out
- [ ] Veículos (`/veiculos`)
- [ ] Correspondências (`/correspondencias`) — registro + baixa de retirada

### Fase 4 — Convivência
- [ ] Áreas comuns (`/areas-comuns`) — cadastro (CRUD puro, hoje sem teste de backend — ver 2.5)
- [ ] Reservas (`/reservas`) — calendário/agenda, aprovação
- [ ] Assembleias + votação (`/assembleias`) — convocação, pautas, votação online em tempo real (considerar Socket.IO já disponível)
- [ ] Comunicados (`/comunicados`) — mural, segmentação por bloco

### Fase 5 — Operação
- [ ] Financeiro (`/financeiro`) — categorias, geração de cobranças em lote, rateio por fração ideal, baixa de pagamento, despesas recorrentes, inadimplência
- [ ] Ocorrências (`/ocorrencias`) — fluxo de status, anônimo, atribuição de responsável
- [ ] Manutenções (`/manutencoes`) — recorrência
- [ ] Documentos (`/documentos`) — upload/download (sem teste de backend — ver 2.5)

### Fase 6 — Administração
- [ ] Usuários (`/usuarios`) + Papéis/Permissões (tela de matriz de permissões usando o catálogo já exposto pela API)
- [ ] Notificações (`/notificacoes`) — lista + tempo real via Socket.IO (cliente `socket.io-client` já está instalado, sem uso ainda)
- [ ] Auditoria (`/auditoria`) — trilha somente leitura, filtros
- [ ] Meu perfil (`/perfil`) — dados da conta, troca de senha (`/auth/me` já existe)

### Fase 7 — Testes automatizados
- [ ] Frontend: testes dos providers, `ProtectedRoute`, e ao menos um teste de fluxo completo por módulo novo
- [ ] Backend: cobrir os módulos sem spec (`documents`, `dependents`, `employees`, `service-providers`, `common-areas`)

### Fase 8 — DevOps e entrega
- [ ] `docker-compose.yml` (mysql, redis, api, web, volumes, healthchecks)
- [ ] `frontend/Dockerfile` (build + Nginx)
- [ ] `.github/workflows/ci.yml` (lint + typecheck + test, backend e frontend)
- [ ] `README.md` completo (setup com/sem Docker, migrations, seed, Swagger, credenciais demo)
- [ ] Checklist de produção: revisar segredos do `.env.example`, `SCHEDULER_ENABLED` em múltiplas réplicas, backups do MySQL

---

## 4. Definition of Done por tela de módulo (Fases 1–6)
Para considerar um módulo "pronto" no frontend:
- [ ] Listagem paginada com busca/filtro e estado de loading/empty/erro (usar `EmptyState` já existente)
- [ ] Criar / editar via modal ou rota, com validação `zod` + `react-hook-form` espelhando o `schema` do backend
- [ ] Exclusão (soft delete) com `confirm-dialog`
- [ ] Toast de sucesso/erro (Sonner já plugado) usando `ApiError.fieldErrors` para erros de validação por campo
- [ ] Item de menu já existe (`navigation.ts`) — só remover da lista `IMPLEMENTED`/roteamento placeholder em `app-router.tsx`
- [ ] Respeita a permissão do item (já mapeada) e não quebra em mobile (mobile-first) nem no dark mode

---

## 5. Riscos e observações
- Os scripts `docker:up/down/logs` na raiz **já estão quebrados hoje** por falta do compose file — corrigir cedo evita confusão em onboarding.
- Como a API já existe e está testada para quase tudo, o risco técnico do frontend é baixo; o maior risco é volume (21 módulos) — vale paralelizar por pessoa/módulo depois que a Fase 0 estabilizar os componentes compartilhados.
- Qualquer nova tela deve reaproveitar `lib/api.ts`, `lib/permissions.ts`, `hooks/use-condominium.ts` e o padrão de `PageHeader`/`EmptyState` já estabelecido pelo Dashboard — não recriar auth/paginação/erro por módulo.
