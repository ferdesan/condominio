# Revisão Completa de Código — Condomínio SaaS

**Projeto:** `condominio-saas` — Plataforma SaaS multi-tenant para gestão de condomínios  
**Stack:** Express 5 + TypeORM + MySQL/PostgreSQL + Redis + Socket.IO (backend) · React 18 + TypeScript + Vite 5 + React Query (frontend)  
**Data da análise:** 22/09/2026  
**Método:** exploração integral do repositório (leitura de configs, módulos, testes e pipeline), verificação por execução de `typecheck`, buscas por padrões de segurança e contagens estatísticas.  
**Critérios avaliados (15):** arquitetura · qualidade · padrões de projeto · SOLID · clean code · segurança · performance · escalabilidade · manutenibilidade · testes · dívida técnica · duplicação · complexidade · tratamento de erros · organização de pastas.

---

## Visão Geral por Dimensão

### 1. Arquitetura da Aplicação

| Aspecto | Avaliação |
|---|---|
| Separação de responsabilidades | **Boa** — backend em módulos (`src/modules/<recurso>/{services,schemas,routes}`) + camada `shared/` (CRUD genérico, erros, utilitários); frontend em **feature folders** auto-contidos (30 features). |
| Organização das camadas | **Boa** — API REST com validação Zod, services com escopo multi-tenant (`CondominiumScopedService` + `RequestContext`), repositórios com `BaseRepository`. Frontend: transporte (axios) → estado de servidor (React Query) → UI. |
| Dependências entre módulos | **Boas** — features do frontend não importam outras features em produção; backend usa infraestrutura compartilhada sem ciclos aparentes. |
| Consistência dos padrões | **Alta** — CRUD genérico (`BaseCrudService`/`createCrudRouter`) e fábrica de hooks (`createResourceHooks`) aplicados de forma sistemática. |
| Escalabilidade | **Média/boa** — multi-tenant por coluna `tenant_id` com guard anti-IDOR; jobs com kill-switch `SCHEDULER_ENABLED`; ponto de atenção: sync de roles em loop no boot (N+1 por tenant) em `backend/src/server.ts:28-38`. |
| Facilidade de manutenção | **Média** — padrões claros, porém arquivos grandes (`seed.ts` 862 linhas, `charges-section.tsx` 518 linhas) e duplicação sistemática de boilerplate de listagem no frontend. |

**Estatísticas:** backend `src/` com **214 arquivos `.ts`** (~19k linhas); frontend `src/` com **441 arquivos `.ts`/`.tsx`** (~50k linhas de produção + ~27k de testes); **37 entidades**, 37 services, 28 arquivos de rotas no backend; 34 páginas e 24 componentes UI no frontend.

### 2. Qualidade do Código

- **Positivo:** TypeScript estrito nos dois lados, ESLint flat config passando, `AppError` hierárquico tipado, schemas Zod em todas as entradas, comentários-ADR explicando *por que* (incluindo por que *não* fazer coisas).
- **Negativo:** 78 `next(error)` redundantes no backend apesar do `express-async-errors`; ~56 blocos `try` em rotas; componentes/páginas “god components” (400–518 linhas); `any` pontuais em contratos compartilhados do frontend (`filter-panel.tsx`, `data-table.tsx`); código morto confirmado (`httpLoggerStream`, `writeRateLimiter`, `newId`, `safeCompare`, `useSidebarCollapsed` sem uso pela UI).
- **Métodos muito longos:** `seed.ts` (862), `InitialSchema.ts` (827), `swagger.ts` (630), `lgpd.service.ts` (517), `auth.service.ts` (517), `closing.service.ts` (510), `charges-section.tsx` (518), `maintenances-page.tsx` (437), `users-page.tsx` (432).

### 3. Padrões de Projeto Utilizados

| Padrão | Onde | Avaliação |
|---|---|---|
| CRUD genérico em 3 camadas | `shared/repositories`, `shared/services`, `createCrudRouter` | Forte — reduz duplicação por recurso |
| Escopo multi-tenant | `tenant_id` + `CondominiumScopedService` + `RequestContext` | Forte e consistente |
| Anti-IDOR | middleware `reference-guard` | Forte (precisa cobrir 100% das rotas) |
| Validação na borda | Zod + whitelists de sort/filter (`query-parser`) | Forte |
| Fábrica de hooks CRUD | `frontend/src/lib/crud/resource-hooks.ts` | Forte — invalidação por prefixo, cuidado com `onError` no RQ v5 |
| Container/Presenter | páginas orquestram; `*-row-actions`, `*-filters` são presenters | Forte |
| Design system (shadcn/Radix/CVA) | `components/ui` | Forte |
| Guardas compostas de rota | `ProtectedRoute` (sessão → permissão) | Forte — backend é autoridade |
| Strategy/whitelist de query | `query-parser` | Forte — mitiga injection em ordenação |
| Observer/realtime como acelerador | Socket.IO só **invalida** cache, nunca escreve payload | Forte |

### 4. Aderência aos Princípios SOLID

| Princípio | Situação | Evidência |
|---|---|---|
| **S** (Responsabilidade única) | Parcial | Módulos bem separados; violações: `ChargesSection` (6 responsabilidades), `auth.service.ts`/`lgpd.service.ts`/`closing.service.ts` >500 linhas misturando casos de uso, páginas de listagem repetindo esqueleto completo. |
| **O** (Aberto/fechado) | Bom | CRUD genérico e fábrica de hooks permitem novos recursos sem modificar o núcleo. |
| **L** (Substituição de Liskov) | Bom | `BaseCrudService`/`BaseRepository` estendidos de forma segura por módulos. |
| **I** (Inversão de dependências) | Bom | Services dependem de repositórios/abstrações; realtime atrás de serviço (`realtime.service.ts`). |
| **D** (Dependência de baixo nível) | Bom | Infraestrutura (Redis, DB, logger) isolada em `config/` com degradação graciosa. |

### 5. Clean Code

- **Nomes descritivos** na ampla maioria (pt-BR consistente, verbos de domínio).
- **Comentários** de alta qualidade (ADR-001…010 referenciados); praticamente nenhum comentário óbvio.
- **Código morto** (ver seção 11) e **ternário inerte** em `poll.service.ts:240` (`poll.isSecret ? null : null` — sempre `null`).
- **Formatação** unificada (Prettier 100 col + EditorConfig), porém `lint-staged` configurado e **nunca invocado** (Husky sem hooks de usuário).

### 6. Segurança

#### 6.1 Checklist

| Verificação | Resultado |
|---|---|
| SQL Injection | **Mitigado** — TypeORM parametrizado + whitelist de `sortBy`/filtros; testado em `security.spec.ts` (`sortBy=(SELECT 1)` ignorado). |
| XSS | **Bom no frontend** — zero `dangerouslySetInnerHTML`/`eval`; CSP no backend usa `scriptSrc 'unsafe-inline'` (Swagger) — enfraquece mitigação. |
| CSRF | **Parcial** — cookies `SameSite=Strict` + CORS restrito; sem token CSRF explícito (aceitável com SameSite, mas depende de configuração de navegador). |
| Secrets hardcoded | **Nenhum secret versionado** (verificado em 199 commits: `git ls-files`/`git log -S` limpos; `.env` gitignored). **Porém:** senha `Demo@1234` hardcoded no seed e executada **em produção** (crítico — abaixo). |
| Exposição de dados sensíveis | **Bom** — `passwordHash` nunca presente em respostas; `maskSensitive` na auditoria; `filePath` não exposto. **Ressalva:** `forgotPassword` devolve token fora de produção (`auth.service.ts`). |
| Autenticação | **Forte** — JWT access + refresh em cookie httpOnly com rotação e detecção de reuso; refinamento de senha bcrypt. **Falhas:** rate limit ausente em `/auth/refresh` e `/auth/logout`; `JWT_EXPIRES_IN=24h` no `.env` da raiz (janela de replay ampliada). |
| Autorização | **Forte em REST** (RBAC + `reference-guard` + testes de matriz). **Falhas:** wildcard `!auth.condominiumIds.length` no Socket.IO permite join em qualquer condomínio; roles com `'*'` criáveis por ADMIN; login sem exigência de `tenantSlug`. |
| Uso inseguro de bibliotecas | `multer@1.4.5-lts.1` (1.x EOL); `trivy-action@master` (ref mutável); `npm audit` inconclusivo (sem rede no momento da análise). |
| Logs com informações confidenciais | Auditoria mascarada; cuidado com stack em respostas de erro se `NODE_ENV` errado (`error.middleware`). |
| Infra exposta | **Redis sem senha** e portas MySQL/API/Web em `0.0.0.0` no `docker-compose.yml`. |

#### 6.2 Superfície de ataque resumida

1. Seed de produção → super-admin com senha pública (Crítico).  
2. Tokens em `localStorage` no frontend (Alto).  
3. Socket.IO wildcard de condomínio (Alto).  
4. Redis/MySQL publicados sem bind/autenticação (Alto).  
5. Rate limit incompleto nas rotas de sessão (Alto).

### 7. Performance

- **Backend:** paginação com teto (`MAX_PER_PAGE`), compression habilitado, healthchecks baratos; N+1 de roles no boot; `httpLogger` não filtra `/health/ready` (spam a cada 30s do healthcheck do Docker).
- **Frontend:** debounce 300ms, `keepPreviousData`, `staleTime` 30s, realtime com coalescing de 250ms, `manualChunks` de vendors — **porém sem `React.lazy`/code splitting por rota** (bundle monolítico; `chunkSizeWarningLimit: 900` mascara o problema), colunas de tabela e callbacks recriados a cada render (0 ocorrências de `React.memo`), `AnimatePresence mode="wait"` soma latência perceptível a cada navegação.

### 8. Escalabilidade

- Multi-tenant e escopo por condomínio prontos para SaaS; Redis opcional com fallback in-process (bem documentado).
- **Gargalos:** locks LGPD em `Map` in-memory (inseguro multi-réplica); corridas em `charges`/reservas sem constraints UNIQUE/exclusion; jobs embutidos exigem `SCHEDULER_ENABLED=false` em todas menos uma réplica; seletor de condomínios com `perPage: 100` (quebra acima de 100 prédios); seed/roles no boot com queries em loop.

### 9. Manutenibilidade

- Documentação operacional presente (`README.md`, `docs/DOCKER.md`, `docs/QUICKSTART.md`, ADRs no código).
- **Dificultadores:** arquivos >400–860 linhas; duplicação de boilerplate CRUD no frontend (~25 cópias de clamp de página, ~63 de `refreshOnRefusal`, trinco anti-duplo-clique em ~25 telas); `IMPLEMENTED` espelhando `NAV_ITEMS` à mão; `types/api.ts` legado (481 linhas) coexistindo com `types/<recurso>.ts`; Husky vazio (porta de qualidade local desligada).

### 10. Cobertura de Testes

| Métrica | Valor |
|---|---|
| Specs backend | **31** (13 unit + 18 integration) · **371** casos `it(` · ~7.6k linhas |
| Casos frontend | **1.106** em **95** arquivos `*.test.*` · ~27k linhas |
| E2E (Playwright/Cypress) | **0** |
| Cobertura backend (linhas) | ~77% (thresholds jest: lines 60 / branches 45 — modestos) |
| Thresholds frontend | **Inexistentes** no Vitest |
| Testes de segurança | Presentes (`security.spec.ts`, auth, documentos) — sem 429 real, sem path traversal, sem teste de seed/CORS |

**Qualidade:** AAA consistente, IDs rastreáveis (`IT-xxx`/`UT-xxx`), bordas de data/dinheiro, backend sem mocks (app real + SQLite em memória), frontend mockando **só** a camada de transporte (ADR-010). Harness do frontend com polyfills justificados e matriz de papéis espelhando o backend.

**Lacunas críticas:**
- `realtime/socket-server.ts` e `jobs/*` com **0%** de cobertura.
- Testes nunca rodam **migrations reais** (`synchronize: true` em sql.js) → divergência schema teste↔produção invisível.
- Sem E2E → contrato frontend↔backend validado só por mocks.
- `dashboard-page` sem teste próprio; `*-hooks` de feature sem unit direto.
- Asserções triviais pontuais (`financial.spec.ts`: `updated >= 0`).

### 11. Dívida Técnica

| Item | Esforço estimado de quitação |
|---|---|
| Build TypeScript quebrado (TS6133) | Minutos |
| Seed em produção / senha `Demo@1234` | Horas |
| Tokens em `localStorage` → cookie httpOnly | Dias (backend+front) |
| Duplicação de boilerplate CRUD (clamp, refresh, trinco, `useUnitOptions`) | Dias (2–3 hooks compartilhados) |
| `next(error)`/try redundantes (78 ocorrências) | Dias |
| Code splitting + ErrorBoundary | Dias |
| Testes de realtime/jobs/migrations + E2E | Semanas |
| Lockfiles fora do git (builds não reprodutíveis) | Horas + política de registry |
| `multer` 1.x EOL → 2.x | Horas/dias |
| `types/api.ts` legado → migração completa | Dias |
| Arquivos monolíticos (seed, swagger, serviços >500) | Semanas |

### 12. Duplicação de Código

**Backend:**
- 78× `next(error)` + helper local `handle(...)` duplicado em ≥6 arquivos de rotas (padrão deveria ser um `asyncHandler` único — `express-async-errors` já está ativo).
- `MAX_PER_PAGE` (200) duplicado em `query-parser` e `base.repository`.
- `castVote` / `castVoteOnBehalf` com regras de quórum/opção repetidas (`poll.service.ts`).

**Frontend (ocorrências confirmadas por grep):**
- Efeito de clamp `page > totalPages` → **~25 páginas**.
- `refreshOnRefusal` → **~63** referências.
- Trinco anti-duplo-clique (`useRef` + pending) → **~25 telas**.
- `useUnitOptions` byte a byte idêntico → **5 features**.
- `MutationCallbacks` + helpers de `onError` opcional → **4 redeclarações**.
- `unitLabel` com ≥3 semânticas diferentes; `STATUS_VARIANTS` locais ≥6.

### 13. Complexidade Excessiva

- `seed.ts` (862) mistura dados, lógica e segurança.
- `lgpd.service.ts` (517) junta export, apagamento, anonimização e lock.
- `closing.service.ts` (510) e `charge.service.ts` (382) concentram regras contábeis densas (bem comentadas, mas de difícil teste unitário isolado).
- `charges-section.tsx` (518) com filtros, colunas, 2 confirm dialogs e 3 diálogos embutidos — o próprio comentário admite a exceção ao padrão das demais features.
- Páginas de listagem 386–437 linhas repetindo o mesmo esqueleto (~70% código paralelo).

### 14. Tratamento de Erros e Exceções

**Pontos fortes:**
- `AppError` → `error.middleware` com contrato HTTP consistente e `requestId`.
- Frontend: `ApiError` normalizada com `fieldErrors`; `applyApiError` mapeia 422→campos e 409→mensagem + dica; toasts globais no React Query com exceção documentada de 401.
- Encerramento gracioso do servidor (SIGTERM/SIGINT, timeout de 10s) em `server.ts`.
- `unhandledRejection`/`uncaughtException` logados.

**Lacunas:**
- **Sem ErrorBoundary** em toda a árvore React (grep negativo) → qualquer erro de render derruba a SPA para tela branca, sem telemetria (`sourcemap: false` piora o diagnóstico).
- CORS rejeitado vira `callback(new Error(...))` → **HTTP 500** em vez de 403 (`app.ts:49`).
- Catch-all `app.get('*')` em produção devolve `index.html` **200** para `/api/v1/*` GET desconhecidas (`app.ts:93-95`) — `notFoundHandler` nunca alcança esses casos.
- 78 `next(error)` manuais criam regras divergentes entre módulos.
- Evento de sessão expirada via string mágica `'auth:session-expired'` em ≥3 arquivos (quebra silenciosa se renomeado).

### 15. Organização de Pastas e Responsabilidades

```
condominio/
├── backend/src/
│   ├── config/          # env (zod), data-source, logger, redis, swagger
│   ├── middlewares/     # auth, error, rate-limit, request-context, upload, validate, reference-guard
│   ├── modules/<recurso>/  # services · schemas · routes  ← padrão consistente
│   ├── shared/          # http, services, repositories, entities, errors, utils
│   ├── realtime/ · jobs/ · database/ (migrations, seeds, InitialSchema)
│   └── server.ts · app.ts
├── frontend/src/
│   ├── components/{ui,common,layout}
│   ├── features/<30 domínios>/  # page · hooks · schema · labels · components · test
│   ├── lib/{api,crud,…} · providers/ · routes/ · hooks/ · types/ · test/
├── .github/workflows/ci-cd.yml · docker-compose.yml · scripts/
└── docs/ · tasks/
```

- **Clara e previsível** nos dois lados; responsibilities bem delegadas.
- Ressalvas: `types/api.ts` legado vs `types/<recurso>`; whitelists de filtro fragmentadas (`lib/crud/query-params.ts` vs `user-hooks.ts` vs `financial-hooks.ts`); seeds/rotas monolíticas; ADRs fora de `docs/` (em `.compozy/tasks/*/adrs/`).

---

## Identificação de Problemas (catálogo)

> Severidade: **Crítico · Alto · Médio · Baixo**. Trechos verificados por leitura/execução nesta análise.

### Crítico

#### C1 — Seed executado em produção cria super-admin com senha `Demo@1234`

| Campo | Detalhe |
|---|---|
| **Arquivo** | `backend/src/server.ts` (linhas 16–23) + `backend/src/database/seeds/seed.ts` (linhas 46, 211–217) |
| **Função** | `bootstrap()` / `runSeeds()` |
| **Descrição** | Quando `NODE_ENV === 'production'`, o bootstrap roda migrations **e** o seed completo, criando `super@condominio.app` com papel `SUPER_ADMIN` (`permissions: ['*']`) e senha hardcoded `Demo@1234`, documentada também no README. |
| **Impacto** | Comprometimento total do sistema em qualquer deploy de produção: qualquer pessoa que conheça o email obtém privilégio de plataforma. |
| **Evidência** | `server.ts:16-22` (`await runSeeds()`); `seed.ts:46` (`const DEMO_PASSWORD = 'Demo@1234'`); `seed.ts:211` (`email: 'super@condominio.app'`). |
| **Sugestão** | Remover `runSeeds()` do caminho de produção (rodar apenas via script manual); nunca incluir super-admin no seed; senha obrigatoriamente vinda de env com falha se ausente; exigir `tenantSlug` no login. |

```ts
// backend/src/server.ts:16-22 — NÃO deve existir em produção
if (env.NODE_ENV === 'production') {
  await AppDataSource.runMigrations();
  await runSeeds(); // cria super@condominio.app / Demo@1234
}
```

#### C2 — `npm run build` / `typecheck` quebrado (bloqueia CI e deploy)

| Campo | Detalhe |
|---|---|
| **Arquivo** | `backend/src/modules/assemblies/services/poll.service.ts:256` |
| **Função** | `persistVote` (parâmetro `unit`) |
| **Descrição** | Parâmetro declarado e nunca lido → `TS6133`. Verificado por execução real: `tsc --noEmit` falha. |
| **Impacto** | `npm run build` do backend falha; o job `typecheck` do CI falha; deploy bloqueado. (O ESLint não captura — não usa `noUnusedLocals` do TS.) |
| **Evidência** | `src/modules/assemblies/services/poll.service.ts(256,5): error TS6133: 'unit' is declared but its value is never read.` |
| **Sugestão** | Usar `unit` (validar que a unidade pertence ao condomínio/poll) ou remover o parâmetro; manter `typecheck` no gate. |

#### C3 — Voto nunca registra eleitor: ternário inerte `isSecret ? null : null`

| Campo | Detalhe |
|---|---|
| **Arquivo** | `backend/src/modules/assemblies/services/poll.service.ts:240-241` |
| **Função** | `castVoteOnBehalf` → `persistVote` |
| **Descrição** | `voterId: poll.isSecret ? null : null` avalia sempre para `null` — votos **não secretos** também ficam sem rastro de eleitor. |
| **Impacto** | Quebra rastreabilidade/auditoria de votações não secretas; a flag `isSecret` não tem efeito real (intenção de anonimato não implementada de fato). |
| **Evidência** | Linhas 240–241 do arquivo; linhas 268–270 com `void unitId; void _` mascaram o restante. |
| **Sugestão** | `voterId: poll.isSecret ? null : ctx.actor.userId` (ou equivalente); remover `void`s; adicionar teste de voto secreto × não secreto. |

### Alto

#### A1 — Access **e refresh tokens** em `localStorage` (frontend)

- **Arquivo/função:** `frontend/src/lib/api.ts` → `tokenStorage` (linhas 10–76).
- **Descrição:** ambos os tokens persistem em `localStorage`, legíveis por qualquer script da origem.
- **Impacto:** qualquer XSS (dep comprometida, gadget) rouba o refresh token e mantém sessão de longa duração; sistema com CPF/dados financeiros/LGPD.
- **Evidência:**

```ts
localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
```

- **Sugestão:** refresh em cookie `HttpOnly; Secure; SameSite=Strict` (o backend **já emite** o cookie em `auth.controller.ts` — o front ignora o cookie e grava no storage); access token em memória.

#### A2 — Socket.IO: wildcard permite escutar condomínio de outro tenant

- **Arquivo/função:** `backend/src/realtime/socket-server.ts:62-64` — handler `subscribe:condominium`.
- **Descrição:** `const allowed = auth.isSuperAdmin || !auth.condominiumIds.length || auth.condominiumIds.includes(condominiumId)` — usuário **sem** condomínios atribuídos (`length === 0`) pode entrar em **qualquer** room de condomínio conhecendo o UUID, sem checar `tenant_id`.
- **Impacto:** vazamento de eventos ao vivo (anúncios, ocorrências, votos) entre tenants.
- **Evidência:** trecho acima; handshake valida JWT corretamente, mas o subscribe não valida pertencimento ao tenant.
- **Sugestão:** carregar o condomínio e conferir `tenant_id` (+ permissão) antes de `join`; remover o ramo `!length` (wildcard).

#### A3 — Redis público sem autenticação + MySQL/API/Web em `0.0.0.0`

- **Arquivo:** `docker-compose.yml:13-14, 32-33, 83-84, 108-109`.
- **Descrição:** portas publicadas sem bind `127.0.0.1`; Redis sem `requirepass`.
- **Impacto:** em host compartilhado/CI/cloud, Redis exposto = cache/rate-limit/sessões manipuláveis; MySQL 3306 exposto amplia superfície.
- **Evidência:** `ports: ["${REDIS_PORT:-6379}:6379"]` sem senha; idem para `3306`.
- **Sugestão:** remover `ports` do Redis (rede interna); `127.0.0.1:${DB_PORT}:3306` para o banco; `--requirepass` se exposição for necessária.

#### A4 — Lockfiles fora do versionamento → builds não reprodutíveis

- **Arquivo:** `.gitignore:8` (`package-lock.json`); verificado: `git ls-files` não rastreia nenhum lockfile.
- **Descrição:** CI (`npm run install:all` → `npm install`) e Dockerfiles (`npm install`) resolvem versões novas a cada execução.
- **Impacto:** supply chain: comprometimento/typosquatting upstream muda o que é instalado entre runs; imagem de produção pode diferir da testada.
- **Sugestão:** versionar lockfiles e usar `npm ci`; resolver o problema do registry Artifactory com `.npmrc`/`--registry` por ambiente, não abandonando o lock.

#### A5 — Lint e Trivy não bloqueiam o CI

- **Arquivo:** `.github/workflows/ci-cd.yml:35-44` (`continue-on-error: true` em backend **e** frontend lint); `:233-238` (Trivy sem `exit-code: '1'`, fora do `needs` do `notify`).
- **Impacto:** código com erro de lint sobe; vulnerabilidades CRITICAL/HIGH passam com pipeline “✅ successful”.
- **Sugestão:** remover `continue-on-error`; `exit-code: '1'` + `severity: CRITICAL,HIGH` no Trivy; adicionar `coverage.thresholds` no Vitest.

#### A6 — Rate limit ausente em `/auth/refresh` e `/auth/logout`

- **Arquivo:** `backend/src/modules/auth/auth.routes.ts:26,39` (vs `:19,22,29,35` que usam `authRateLimiter`).
- **Impacto:** flooding no endpoint de refresh força verificação de hash/assinatura (CPU) — brute force/DoS de sessão.
- **Sugestão:** aplicar `authRateLimiter` (ou limiter dedicado) em todas as rotas de sessão.

#### A7 — CORS rejeitado vira HTTP 500; catch-all SPA devolve 200 em `/api/*`

- **Arquivos:** `backend/src/app.ts:49` (`callback(new Error('Origem nao permitida pelo CORS.'))`), `app.ts:93-95` (`app.get('*')` → `index.html` só em produção).
- **Impacto:** origem inválida → 500 + stack/log de erro (contrato errado, ruído no monitoramento); rota API GET inexistente → **200 com HTML** e `notFoundHandler` inalcançável.
- **Sugestão:** `callback(null, false)` ou `AppError.Forbidden`; restringir o catch-all a paths que não iniciam com `API_PREFIX` (ou registrar depois de um 404 JSON explícito da API).

#### A8 — Corridas concorrentes sem constraints (charges, reservas, update genérico)

- **Arquivos:** `financial/services/charge.service.ts` (check-then-insert da competência), `reservations/services/reservation.service.ts` (`findOverlapping` → create), `shared/repositories/base.repository.ts` (update read-modify-write).
- **Impacto:** faturas duplicadas em jobs paralelos/retry; double-booking de reserva; lost update.
- **Sugestão:** `UNIQUE (tenant_id, condominium_id, unit_id, reference_month, …)` em charges; `EXCLUDE USING gist` (range) ou `SELECT … FOR UPDATE` em reservas; transação/`@VersionColumn` no update genérico.

#### A9 — Ausência total de ErrorBoundary e de code splitting no frontend

- **Arquivos:** `frontend/src/App.tsx`, `frontend/src/routes/app-router.tsx`, `frontend/vite.config.ts` (grep: zero `ErrorBoundary`/`React.lazy`/`Suspense`).
- **Impacto:** erro de render → tela branca sem recuperação; bundle inicial carrega as ~30 páginas (incl. Recharts/financeiro) — TTIF pesado; `chunkSizeWarningLimit: 900` silencia o aviso.
- **Sugestão:** `react-error-boundary` em `AppRouter` e por rota; `React.lazy` por rota + `Suspense`; baixar o limite de warning para 300–500 KB.

#### A10 — LGPD: `limit` 500 em `findAllBy` + lock em `Map` in-memory

- **Arquivos:** `shared/repositories/base.repository.ts:72-81`, `modules/lgpd/services/lgpd.service.ts:74`.
- **Impacto:** titular com >500 registros → export/apagamento **incompleto** (não conformidade art. 18); duas réplicas executam o mesmo apagamento simultaneamente.
- **Sugestão:** paginação por cursor até esvaziar (streaming); lock distribuído via Redis `SET NX PX` (adapter já existe).

#### A11 — Testes nunca executam migrations reais

- **Arquivos:** `backend/src/config/data-source.ts` (em teste: `synchronize: true` + sql.js), `backend/tests/setup.ts`.
- **Impacto:** divergência schema teste↔produção (colunas, constraints, índices) passa despercebida; migration quebrada só aparece no deploy.
- **Sugestão:** job de CI com MySQL real + `migration:run` + suíte (o serviço MySQL **já existe** no workflow — falta ligar as migrations).

### Médio (síntese)

| ID | Problema | Arquivo | Impacto |
|---|---|---|---|
| M1 | Escalada de permissão: role com `'*'` criável por ADMIN | `roles/schemas/role.schema.ts`, `role.service.ts` | Privilege escalation horizontal no tenant |
| M2 | `SWAGGER_ENABLED` default `true` (inclusive prod) | `config/env.ts:54` | Superfície de API documentada exposta |
| M3 | CSP `scriptSrc 'unsafe-inline'` | `app.ts:33` | Enfraquece XSS defense |
| M4 | `forgotPassword` retorna token fora de produção | `auth.service.ts` | Vazamento se `NODE_ENV` errado em staging |
| M5 | `JWT_EXPIRES_IN=24h` no `.env` raiz (vs 15m no example) | `.env` | Janela de replay de access token |
| M6 | `Dockerfile` com `npm install` (não `npm ci`) | `backend/Dockerfile`, `frontend/Dockerfile` | Builds não reprodutíveis |
| M7 | `NODE_ENV` default `development` no compose | `docker-compose.yml:53` | Deploy “cru” sobe em modo dev |
| M8 | Mount de seeds em `/docker-entrypoint-initdb.d` é no-op (Postgres/MySQL só roda `.sql`/`.sh`) | `docker-compose.yml:17` | Seed “não roda sozinho” — confusão operacional |
| M9 | `backend/.env.example` com senha funcional `condominio` | `backend/.env.example:17` | Quem copia o template roda com senha fraca |
| M10 | Healthcheck MySQL com senha em `argv` | `docker-compose.yml:19` | Senha visível em `docker inspect`/`/proc` |
| M11 | `aquasecurity/trivy-action@master` (tag mutável) | `ci-cd.yml:233` | Supply chain do CI |
| M12 | Loop MySQL no CI sem timeout | `ci-cd.yml:98` | Job pendura até timeout global |
| M13 | Sem Dependabot/Renovate | `.github/` | Dependências sem scanning contínuo |
| M14 | `rimraf` em `dependencies`; `uuid` sem uso | `backend/package.json` | Imagem de produção inchada; código morto |
| M15 | Rate limit por IP atrás de proxy sem política de `trust proxy` documentada | `rate-limit.middleware.ts` | Bypass ou bloqueio em massa |
| M16 | Duplicação de boilerplate CRUD (clamp ×25, refresh ×63, trinco ×25, `useUnitOptions` ×5) | `frontend/src/features/**` | Cada tela nova custa 300–400 linhas paralelas |
| M17 | Páginas/Seção “god components” (386–518 linhas) | `charges-section.tsx`, `*-page.tsx` | Baixa coesão, teste caro |
| M18 | `any` em contratos compartilhados | `filter-panel.tsx`, `data-table.tsx` | Perda de checagem em refactors |
| M19 | Escape bloqueado em modal (`dismissible={false}`) | `resident-form-dialog.tsx`, `ui/dialog.tsx` | WCAG 2.1.2 (keyboard trap) |
| M20 | `IMPLEMENTED` espelha `NAV_ITEMS` à mão | `routes/app-router.tsx` | Duas fontes de verdade de rotas |
| M21 | Seletor de condomínios `perPage: 100` | `condominium-provider.tsx` | Acima de 100 prédios, some do select |
| M22 | `apiPost<T>` promete `T` mas pode devolver `undefined` | `lib/api.ts` | Type lie mascara contrato quebrado |
| M23 | `AnimatePresence mode="wait"` + `key={pathname}` | `app-shell.tsx` | Latência perceptível em cada navegação |
| M24 | Colunas/callbacks sem `useMemo`; `DataTable` sem `React.memo` | páginas + `data-table.tsx` | Re-renders garantidos de listas |
| M25 | Sem CSP no `index.html` | `frontend/index.html` | Defesa em profundidade XSS ausente |
| M26 | Whitelists de filtro fragmentadas (3 pontos de verdade) | `query-params.ts`, `user-hooks.ts`, `financial-hooks.ts` | Filtro “finge” filtrar se backend não aceitar |
| M27 | Evento `'auth:session-expired'` como string mágica | `api.ts`, `auth-provider`, `use-realtime` | Renomear quebra em silêncio |
| M28 | `ConfirmDialog` ignora tokens de tema (`text-yellow-600`) | `confirm-dialog.tsx` | Inconsistência visual no dark mode |
| M29 | Arquivos monolíticos (seed 862, schema 827, swagger 630, auth/lgpd/closing >500) | backend | Complexidade e coesão |
| M30 | Husky instalado sem hooks → `lint-staged` morto | `.husky/`, `package.json` | Qualidade local não enforceada |
| M31 | Falta `ErrorBoundary` coberto por A9; sem thresholds de cobertura | `vite.config.ts` | Cobertura pode cair sem sinal |
| M32 | Rate limit desativado em testes (`skip: () => isTest`) | `rate-limit.middleware.ts` | Regressão de 429 invisível |

### Baixo (síntese)

| ID | Problema | Arquivo |
|---|---|---|
| B1 | Código morto: `httpLoggerStream`, `writeRateLimiter`, `newId`, `safeCompare`, `useSidebarCollapsed`, `sleep`, `hasAnyPermission` | backend/frontend |
| B2 | Chaves de `localStorage` misturam convenções (`condomínio.` vs `condominio-sidebar-collapsed`) | `lib/api.ts`, providers, hooks |
| B3 | `VITE_SOCKET_URL`/`VITE_APP_NAME` no `.env` sem uso no código | `frontend/.env` |
| B4 | `MAX_PER_PAGE` duplicado | `query-parser`, `base.repository` |
| B5 | Stack de erro potencialmente exposta se `NODE_ENV` errado | `error.middleware.ts` |
| B6 | `docker-init.sh` exige binário legado `docker-compose` mas executa `docker compose` | `docker-init.sh:41,68` |
| B7 | `version: '3.9'` obsoleto no compose | `docker-compose.yml:1` |
| B8 | nginx do frontend roda como root | `frontend/Dockerfile` |
| B9 | Sem hardening de containers (`read_only`, `cap_drop`, `no-new-privileges`, log rotation) | `docker-compose.yml` |
| B10 | `LICENSE` inexistente apesar do badge MIT | `README.md` |
| B11 | Badge de CI com URL placeholder `seu-usuario` | `README.md:3` |
| B12 | Tag `latest` mutável em todo push da master | `ci-cd.yml` |
| B13 | `codecov-action@v3` defasado; `fail_ci_if_error: false` | `ci-cd.yml` |
| B14 | `dashboard-page` sem teste próprio; misc pages sem teste | `frontend/src/features` |
| B15 | `MobileBottomBar` com non-null assertion `findItem(...)!` | `sidebar.tsx` |
| B16 | Hardening de redirect pós-login (`from` sem validação `//`) | `login-page.tsx` |
| B17 | `recent-activity` do dashboard sem `condominiumId` na key | `dashboard-page.tsx` |
| B18 | ESLint sem plugins a11y/testing/react; sem Prettier integrado no frontend | `frontend/eslint.config.js` |
| B19 | `multer@1.x` EOL | `backend/package.json` |
| B20 | Cobertura 0% em `socket-server`, `jobs/*` | coverage |
| B21 | Exemplo de senha no Swagger (`Sindico@123`) | `swagger.ts:159` |
| B22 | Asserções triviais em testes (`updated >= 0`) | `financial.spec.ts:156` |
| B23 | Dependência de ordem entre casos de teste (mitigada por `--runInBand`) | `auth.spec.ts`, `operations.spec.ts`, `financial.spec.ts` |
| B24 | Timeouts de 120–180s em testes de página mascaram lentidão jsdom+Radix | `residents-page.test.tsx` etc. |
| B25 | `sourcemap: false` em produção | `vite.config.ts` |
| B26 | `types/api.ts` legado (481 linhas) coexistindo com migração parcial | `frontend/src/types/api.ts` |

---

## Arquitetura (avaliação consolidada)

**Separação de responsabilidades:** adequada nos dois níveis (módulos de domínio × infraestrutura compartilhada; features × design system). O principal desvio é a concentração de casos de uso em services únicos >500 linhas e em páginas/seções que misturam filtros, colunas, diálogos e estado.

**Camadas:** API → service (escopo tenant) → repository → TypeORM; frontend → axios/React Query → hooks de feature → componentes. Sem camadas espúrias; nada de lógica de negócio no controller espalhado (exceto orquestração fina).

**Dependências entre módulos:** saudáveis; criação de recurso CRUD é composição de infraestrutura pronta, não cópia.

**Escalabilidade:** pronta em modelo de dados e isolamento; travada por locks em memória, corridas sem constraint e jobs embutidos.

**Consistência:** alta — é o maior ativo arquitetural do projeto (padrões idênticos em 30 features e 15+ módulos backend).

**Manutenção:** viável no curto prazo com os hooks de listagem compartilhados; nos módulos financeiros/LGPD exige quebra por caso de uso.

---

## Testes (avaliação consolidada)

- **Existência:** sim — 31 specs backend + 95 arquivos frontend (~1.477 casos), incluindo suíte de segurança dedicada.
- **Cobertura dos principais fluxos:** auth (login/refresh/rotação/reuso), CRUD multi-tenant, RBAC, financeiro/fechamento, LGPD, reservas, documentos/upload, assembleias — **bem cobertos**.
- **Qualidade:** alta (AAA, IDs, bordas, mocks disciplinados, sem `.skip`/`.only`).
- **Casos não cobertos:** realtime (0%), jobs (0%), migrations reais, 429 HTTP, path traversal de upload, seed/CORS, corridas concorrentes, E2E ponta a ponta, `dashboard-page`, a11y automatizada.

---

# Resumo Executivo

O projeto é um **SaaS multi-tenant de gestão de condomínios com arquitetura madura e disciplina acima da média**: backend Express/TypeORM modular com CRUD genérico, escopo de tenant e anti-IDOR consistentes; frontend React com feature folders, design system, React Query e uma suíte de testes extensa (~1.500 casos) com harness de altíssimo cuidado; pipeline GitHub Actions com gates de typecheck e testes; zero secrets versionados em 199 commits e geração criptográfica de credenciais.

Apesar disso, **o repositório não está apto para produção como está**. Há **três bloqueadores críticos verificados por execução/leitura**: (1) o bootstrap de **produção roda o seed** e cria super-admin `super@condominio.app` com a senha pública `Demo@1234`; (2) o **build TypeScript do backend está quebrado** (`TS6133` em `poll.service.ts:256` — `tsc --noEmit` falha); (3) os votos de assembleia **nunca registram o eleitor** (`isSecret ? null : null`). Somam-se riscos **altos** de segurança (tokens em `localStorage`, wildcard de condomínio no Socket.IO, Redis/MySQL expostos no compose, lockfiles fora do git, lint/Trivy que não bloqueiam o CI, rate limit incompleto no refresh) e dívida técnica de **duplicação sistemática no boilerplate CRUD do frontend** (~25–63 cópias por padrão) e em arquivos monolíticos.

**Nota global de qualidade:** ★★★★☆ (4/5 em engenharia; 2/5 em prontidão de produção até que os itens críticos sejam resolvidos).

---

# Pontos Fortes

1. **Multi-tenant disciplinado** — `tenant_id` + `CondominiumScopedService` + `RequestContext` + middleware `reference-guard` (anti-IDOR), com testes de isolamento (`security.spec.ts`, `registerIsolatedTenant`).
2. **CRUD genérico bem extraído** — `BaseRepository` / `BaseCrudService` / `createCrudRouter` / `createResourceHooks` eliminam copiar-colar por recurso nos dois lados.
3. **Validação estruturada com Zod** em todas as entradas + **whitelists** de sort/filter (mitigação real de injection em query).
4. **Modelo de erro tipado** (`AppError` → middleware; `ApiError` + `fieldErrors` + `applyApiError` no front) com contrato HTTP e UX de formulário consistentes.
5. **Sessão acima da média** — refresh em cookie httpOnly + SameSite strict + rotação com detecção de reuso (roubo de sessão), refinamento bcrypt, guards de secret em produção (`env.ts`).
6. **Nenhum secret versionado** (histórico git limpo) + `npm run secrets` com `randomBytes(48)` e compose com `${VAR:?fail-fast}`.
7. **Testes extensos e de qualidade** — ~1.500 casos, backend sem mocks (caminho HTTP→DB real em SQLite), frontend mockando só transporte (ADR-010), harness com matriz de papéis e polyfills justificados; `pipeline-gate.test.ts` vigia a própria CI.
8. **Segurança testada** — suíte dedicada: multi-tenant, RBAC, injection em `sortBy`, vazamento de `passwordHash`/`filePath`, reuso de refresh.
9. **Tempo real bem desenhado** — socket só **invalida** cache (não escreve payload), com coalescing de 250ms e degradação silenciosa.
10. **Auditoria com mascaramento** (`maskSensitive`) e trilha de `PERMISSION_DENIED` como sinal de segurança.
11. **Regra contábil protegida** — `assertMonthOpen` (ADR-003) documentada e testada.
12. **Comentários/ADRs no código** explicando o porquê (inclusive por que *não* fazer) — raro em codebases desse porte.
13. **Docker backend hardened** — multi-stage, usuário não-root, `dumb-init`, healthcheck real, `.dockerignore` sem `.env*`.
14. **Acessibilidade e TypeScript estrito** no frontend (`aria-sort`, `role=alert`, `strict`, alias `@/`).
15. **Documentação operacional** (README, DOCKER, QUICKSTART) coerente com o comportamento real dos scripts.

---

# Problemas Críticos

> Exigem **ação imediata** antes de qualquer deploy de produção.

### 1. Seed de produção cria super-admin com senha `Demo@1234` — **Crítico**
- `backend/src/server.ts:16-22` executa `runSeeds()` quando `NODE_ENV === 'production'`.
- `backend/src/database/seeds/seed.ts:46,211` cria `super@condominio.app` + `DEMO_PASSWORD = 'Demo@1234'` com papel wildcard `*`.
- **Ação:** remover `runSeeds()` do bootstrap de produção; seed só via comando manual com senha de env obrigatória; rotacionar qualquer credencial já criada em ambiente real.

### 2. Build TypeScript quebrado — **Crítico**
- `backend/src/modules/assemblies/services/poll.service.ts:256` → `error TS6133: 'unit' is declared but its value is never read` (**confirmado por `tsc --noEmit`**).
- **Ação:** usar ou remover o parâmetro `unit`; garantir `npm run typecheck` verde antes de qualquer merge.

### 3. Votos sem rastro de eleitor (flag `isSecret` inerte) — **Crítico**
- `poll.service.ts:240-241`: `voterId: poll.isSecret ? null : null` — sempre `null`; linhas 268–270 mascaram com `void`.
- **Ação:** implementar a semântica real secreta × não secreta + teste; remover código morto.

### 4. Redis/MySQL expostos sem proteção adequada no compose — **Crítico/Alto**
- `docker-compose.yml` publica 3306/6379/3333/3000 em `0.0.0.0`; Redis sem `requirepass`.
- **Ação:** restringir bind a `127.0.0.1` (ou remover porta do Redis) e exigir senha.

### 5. Tokens de sessão em `localStorage` — **Alto (quase crítico para LGPD/financeiro)**
- `frontend/src/lib/api.ts:61-76` guarda access **e** refresh no `localStorage` (o backend **já** manda cookie httpOnly — o front não usa).
- **Ação:** passar a consumir o cookie httpOnly para refresh; access token em memória.

### 6. Locks/CI que não protegem — **Alto**
- Lockfiles fora do git (`.gitignore:8`) + lint com `continue-on-error` + Trivy sem `exit-code` → pipeline verde não significa código saudável.
- **Ação:** versionar locks/`npm ci`; ligar os gates.

---

# Melhorias Recomendadas

> Curto prazo (dias a ~2 semanas) — alto impacto, esforço contido.

1. **Corrigir os 3 bloqueadores críticos** (seed, TS6133, `voterId`) — horas.
2. **Remover `runSeeds()` da produção** e barrear `Demo@1234` em qualquer ambiente não-dev.
3. **Socket.IO:** validar `tenant_id` no `subscribe:condominium`; eliminar wildcard `!condominiumIds.length`.
4. **CORS → 403/`callback(null,false)`** e catch-all SPA que **não** responda `/api/*` (devolver 404 JSON).
5. **Rate limit** em `/auth/refresh` e `/auth/logout`; manter `JWT_EXPIRES_IN` curto (15m) no `.env` de produção.
6. **CI:** `continue-on-error: false` nos lints; Trivy `exit-code: '1'` + severidades CRITICAL/HIGH; thresholds de cobertura (backend 75→85 lines; frontend lines 70 / branches 60); adicionar `migration:run` no job de testes (MySQL já existe como service).
7. **Compose:** `127.0.0.1:` nas portas de db/api/web, remover porta do Redis (ou `--requirepass`); `NODE_ENV` default `production` no serviço api do compose de deploy; remover mount no-op de seeds.
8. **Versionar `package-lock.json`** e trocar `npm install` → `npm ci` em CI e Dockerfiles.
9. **Frontend:** `ErrorBoundary` + `React.lazy` por rota; baixar `chunkSizeWarningLimit`.
10. **Extrair hooks de listagem** compartilhados: `useClampPage`, `useInvalidateOnRefusal`, `useConfirmAction`, `useUnitsOptions` (elimina ~100+ ocorrências duplicadas).
11. **Remover code morto** (`httpLoggerStream`, `writeRateLimiter`, `newId`, `safeCompare`, `useSidebarCollapsed`, `uuid`, `rimraf`→dev).
12. **Upload:** `path.relative` + checagem de `..` em `resolveStoredPath` (hoje `startsWith` frágil).
13. **Habilitar Husky pre-commit** com o `lint-staged` já configurado (porta de qualidade local).
14. **LGPD:** paginação por cursor até esvaziar + lock Redis; teste de export >500 registros.
15. **Testes faltantes de alto risco:** 429 real, path traversal de upload, `socket-server`, `overdue.job`, voto secreto × não secreto, corrida de charges.

---

# Melhorias Estratégicas

> Médio e longo prazo — estrutural.

1. **Arquitetura de autenticação em cookie total** (ADR documentado): access token curto em memória + refresh exclusivamente httpOnly; alinhar hybrid `withCredentials` + eliminar `localStorage`.
2. **Controller de página CRUD compartilhado no frontend** (`useCrudPageController`) para colapsar o esqueleto repetido em ~30 telas; pages ficam só em colunas/labels — paga a próxima dezena de features.
3. **Quebra dos monolitos backend:** `auth` → login/password-reset/profile; `lgpd` → export/delete/lock; `closing`/`charge` por caso de uso; seed modular por domínio; swagger por arquivo de módulo.
4. **Integridade concorrentes via schema:** migrações com UNIQUE em charges, exclusion constraint em reservas, versionamento otimista no `BaseCrudService.update`.
5. **E2E com Playwright** — 3–5 jornadas (login→CRUD→persistência→logout, upload, fechamento de balancete); é a maior lacuna estrutural dado o volume de mocks de transporte.
6. **Testes de migrations e contrato OpenAPI** — diff `docs.json` × spec versionada; job com Postgres/MySQL real.
7. **Hardening de infra:** Dependabot/Renovate, actions pinnadas por SHA, `docker-compose.prod.yml` separado, containers com `read_only`/`cap_drop`/`no-new-privileges`, nginx unprivileged, secret manager para AWS/SMTP.
8. **Observabilidade:** ErrorBoundary → Sentry/reportError com sourcemaps hidden; `/health/ready` fora do httpLogger; remoção de stack da resposta em produção + `traceId`.
9. **RBAC reforçado:** negar `'*'` em criação de papel para não-super-admin (permissões do novo papel ⊆ baseline do criador); unificar fonte de permissão UI (derivar rotas de `NAV_ITEMS`).
10. **Acessibilidade contínua:** Escape sempre ativo em modais (mapear para `requestClose`), plugin `jsx-a11y`, testes axe.
11. **Migração conclusiva de `types/api.ts`** com `no-restricted-imports`.
12. **Atualização de dependências EOL** (`multer@2`) e auditoria contínua (`npm audit` + Trivy gate + CodeQL).

---

# Plano de Ação

| Prioridade | Item | Impacto | Esforço |
|---|---|---|---|
| **P0** | Remover `runSeeds()` do bootstrap de produção; eliminar senha `Demo@1234` de qualquer ambiente real | **Crítico** — evita comprometimento total | Baixo (horas) |
| **P0** | Corrigir TS6133 em `poll.service.ts:256` (usar ou remover `unit`) | **Crítico** — destrava build/CI/deploy | Muito baixo (minutos) |
| **P0** | Corrigir `voterId: isSecret ? null : null` + teste de votação | **Crítico** — integridade de assembleias | Baixo (horas) |
| **P0** | Bind `127.0.0.1` nas portas do compose; remover/restringir Redis | **Crítico/Alto** — reduz superfície de ataque | Baixo (minutos) |
| **P1** | Refresh token via cookie httpOnly (front parar de gravar no `localStorage`) | **Alto** — segurança de sessão/LGPD | Médio (2–4 dias) |
| **P1** | Validar tenant no `subscribe:condominium`; remover wildcard `!length` | **Alto** — isola tenants no realtime | Baixo (horas) |
| **P1** | Versionar lockfiles + `npm ci` em CI/Docker | **Alto** — reprodutibilidade/supply chain | Baixo (horas) |
| **P1** | Ligar gates: lint sem `continue-on-error`, Trivy `exit-code`, thresholds de cobertura | **Alto** — qualidade no pipeline | Baixo (horas) |
| **P1** | Rate limit em `/refresh` e `/logout`; CORS 403; catch-all SPA fora de `/api` | **Alto** — contrato e abuso de API | Baixo (horas) |
| **P1** | UNIQUE em charges + trava de reserva (migração) | **Alto** — evita duplicidade financeira/double-booking | Médio (1–2 dias) |
| **P1** | `ErrorBoundary` + `React.lazy` por rota | **Alto** — estabilidade e performance de UX | Médio (1–2 dias) |
| **P2** | Extrair `useClampPage` / `useInvalidateOnRefusal` / `useConfirmAction` / `useUnitsOptions` | **Médio** — corta ~100+ duplicações | Médio (2–3 dias) |
| **P2** | LGPD: cursor pagination + lock Redis + teste >500 | **Médio** — conformidade legal | Médio (2 dias) |
| **P2** | Testes: 429, traversal, socket, jobs, migrations no CI | **Médio** — fecha lacunas críticas | Médio (3–5 dias) |
| **P2** | Habilitar Husky pre-commit + `lint-staged` | **Médio** — qualidade local | Muito baixo (minutos) |
| **P2** | Remover código morto; `rimraf`→dev; Swagger default off em prod; CSP sem `unsafe-inline` onde possível | **Médio** — higiene/hardening | Baixo (dia) |
| **P2** | Negar `'*'` em roles para não-super-admin | **Médio** — fecha escalada lateral | Baixo (horas) |
| **P3** | E2E Playwright (3–5 jornadas) | **Médio/alto** — contrato ponta a ponta | Alto (1 semana) |
| **P3** | `useCrudPageController` + quebra de god components e monolitos backend | **Médio** — manutenibilidade escalonada | Alto (1–2 semanas) |
| **P3** | Dependabot + actions pinnadas + compose.prod + hardening de containers | **Médio** — maturidade operacional | Médio (3–5 dias) |
| **P3** | Unificar fonte de rotas/permissões (`NAV_ITEMS` → rotas) + migração `types/api.ts` | **Baixo/médio** — consistência | Médio (3 dias) |
| **P3** | Observabilidade: sourcemaps hidden, Sentry/ErrorBoundary reporting, `/health/ready` no logger | **Médio** — diagnóstico em prod | Médio (2 dias) |
| **P3** | `multer@2`, CodeQL, LICENSE, badge README, a11y (Escape, axe) | **Baixo** — polish/legal | Baixo (1–2 dias) |

---

**Arquivos-chave referenciados:**  
`backend/src/server.ts` · `backend/src/database/seeds/seed.ts` · `backend/src/modules/assemblies/services/poll.service.ts` · `backend/src/app.ts` · `backend/src/realtime/socket-server.ts` · `backend/src/modules/auth/auth.routes.ts` · `backend/src/middlewares/upload.middleware.ts` · `backend/src/middlewares/rate-limit.middleware.ts` · `backend/src/shared/repositories/base.repository.ts` · `backend/src/modules/lgpd/services/lgpd.service.ts` · `backend/src/config/env.ts` · `backend/jest.config.js` · `backend/tests/integration/security.spec.ts` · `frontend/src/lib/api.ts` · `frontend/src/App.tsx` · `frontend/src/routes/app-router.tsx` · `frontend/vite.config.ts` · `frontend/src/components/common/confirm-dialog.tsx` · `frontend/src/providers/condominium-provider.tsx` · `frontend/src/features/financial/components/charges-section.tsx` · `.github/workflows/ci-cd.yml` · `docker-compose.yml` · `.gitignore` · `package.json`

*Relatório gerado em 22/09/2026 · revisão completa do repositório · pronto para compartilhamento com a equipe técnica.*
