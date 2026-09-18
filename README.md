# 🏢 Plataforma SaaS - Gestão de Condomínios

[![CI/CD Pipeline](https://github.com/seu-usuario/condominio/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/seu-usuario/condominio/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-%3E%3D24.0-blue)](https://www.docker.com/)

Sistema multi-tenant completo para gestão de condomínios com autenticação, autorização baseada em roles (RBAC), gestão de unidades, moradores, serviços, reservas de espaços comuns e muito mais.

## 🎯 Características Principais

- ✅ **Multi-Tenant SaaS**: Suporte completo para múltiplos condomínios isolados
- ✅ **Autenticação JWT**: Segurança com tokens JWT e refresh tokens
- ✅ **RBAC**: Controle de acesso baseado em roles (Admin, Sindico, Morador)
- ✅ **Banco de Dados**: MySQL 8.0 com TypeORM
- ✅ **Cache**: Redis para performance
- ✅ **API REST**: Express.js com documentação Swagger
- ✅ **Frontend Moderno**: React 18 com Vite e Tailwind CSS
- ✅ **Validação**: Zod para validação de schemas
- ✅ **CI/CD Automatizado**: GitHub Actions com testes e segurança
- ✅ **Docker**: Ambiente containerizado pronto para produção
- ✅ **Conformidade LGPD**: Pedido de exclusão, anonimização em cascata, exportação de dados e registro de consentimento
- ✅ **Trilha de Auditoria**: Registro *append-only* de quem mudou o quê e quando

## 📱 Módulos Implementados

A navegação tem **25 telas**, todas ligadas à API — nenhuma é protótipo. Cada
item do menu é guardado pela mesma permissão que o servidor exige na rota
correspondente, então um papel sem acesso não vê o item nem alcança a URL.

| Área | Telas |
| --- | --- |
| **Visão geral** | Dashboard |
| **Estrutura** | Condomínios · Blocos e torres · Unidades |
| **Pessoas** | Moradores · Dependentes · Funcionários · Prestadores |
| **Portaria** | Visitantes · Veículos · Correspondências |
| **Convivência** | Áreas comuns · Reservas · Assembleias · Comunicados |
| **Operação** | Financeiro · Ocorrências · Manutenções · Documentos |
| **Administração** | Notificações · Usuários · Papéis · Auditoria · Configurações |
| **Privacidade** | LGPD |

O backend expõe **27 módulos** sob `/api/v1`, incluindo os que não têm tela
própria: `auth`, `dashboard` e `health`.

### Recortes que valem saber

- **Multi-tenant por administradora.** Quase todo recurso é escopado por
  condomínio e segue o seletor do topo. As exceções são por *tenant* e não
  seguem esse seletor: `Usuários`, `Papéis`, `Auditoria`, `Configurações` e
  `LGPD`.
- **A trilha de auditoria não tem escrita.** São duas rotas, ambas de leitura:
  a trilha é *append-only* por exigência da LGPD (art. 37) e da prestação de
  contas. Não existe criar, editar nem excluir — nem no servidor, nem na tela.
- **Documentos têm matriz de visibilidade própria.** Cinco níveis
  (`PUBLIC`, `RESIDENTS`, `OWNERS`, `STAFF`, `ADMIN`) decidem quem baixa o quê,
  e o arquivo só é servido pela rota autenticada de download.

## 🛠 Stack Tecnológico

### Backend
- **Runtime**: Node.js 22 LTS
- **Framework**: Express.js 4
- **ORM**: TypeORM 0.3
- **Database**: MySQL 8.0
- **Cache**: Redis 7
- **Auth**: JWT (jsonwebtoken)
- **Validation**: Zod
- **Testing**: Jest + Supertest
- **Linting**: ESLint + Prettier
- **Docs**: Swagger UI

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **UI Components**: Radix UI
- **Form State**: React Hook Form
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Validation**: Zod
- **Testing**: Vitest + Testing Library
- **Routing**: React Router 6

### DevOps & CI/CD
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Security Scanning**: Trivy
- **Registry**: GitHub Container Registry (GHCR)
- **Monitoring**: Docker health checks

## 📦 Pré-requisitos

- **Docker**: v24.0+ ([Download](https://www.docker.com/products/docker-desktop))
- **Docker Compose**: v2.20+ (incluído no Docker Desktop)
- **Git**: v2.30+ ([Download](https://git-scm.com/))
- **Node.js**: v20.0+ (apenas para desenvolvimento sem Docker)

### Verificar Instalação

```bash
docker --version          # Docker version 24.0.0+
docker compose version    # Docker Compose version 2.20.0+
git --version            # git version 2.30.0+
```

## 🚀 Quick Start

### 1️⃣ Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/condominio.git
cd condominio
```

### 2️⃣ Configurar Ambiente

```bash
# Copiar variáveis de exemplo
cp .env.example .env

# Opcionalmente, editar .env conforme necessário
# nano .env
```

### 3️⃣ Iniciar com Docker (Recomendado)

```bash
# Opção A: Comando simples (Recomendado)
npm run docker:up

# Opção B: Script automatizado
# Linux/Mac
./docker-init.sh start

# Windows PowerShell
.\docker-init.ps1 -Command start
```

### 4️⃣ Acessar a Aplicação

- 🌐 **Frontend**: [http://localhost:3000](http://localhost:3000)
- 🔌 **API**: [http://localhost:3333](http://localhost:3333)
- 📚 **API Docs**: [http://localhost:3333/api-docs](http://localhost:3333/api-docs)
- 🗄️ **Banco de Dados**: localhost:3306

## 📋 Comandos Essenciais

### Gerenciamento de Serviços

```bash
npm run docker:up              # Inicia todos os serviços
npm run docker:down            # Para serviços (mantém volumes)
npm run docker:down:all        # Para e remove tudo
npm run docker:ps              # Status dos containers
npm run docker:health          # Verificar saúde dos serviços
npm run docker:logs            # Logs de API e Web (tempo real)
npm run docker:logs:all        # Todos os logs
```

### Desenvolvimento

```bash
npm run dev                    # Inicia backend e frontend em paralelo (sem Docker)
npm run install:all            # Instala dependências (root, backend, frontend)
npm run build                  # Build backend e frontend
npm run test                   # Executa testes
npm run lint                   # Lint em ambos
npm run format                 # Formata código com Prettier
npm run docker:bash:api        # Terminal do backend
npm run docker:bash:web        # Terminal do frontend
npm run docker:bash:db         # Terminal MySQL
```

### Build & Deploy

```bash
npm run docker:build           # Build com cache
npm run docker:rebuild         # Build sem cache (mais lento)
npm run docker:prune           # Limpeza de volumes e imagens
```

## 🔑 Credenciais Padrão

⚠️ **NUNCA use essas credenciais em produção!**

| Serviço | Host | Usuário | Senha |
|---------|------|---------|-------|
| Frontend | localhost:3000 | - | - |
| API | localhost:3333 | - | - |
| MySQL | localhost:3306 | admin | admin123 |
| Redis | localhost:6379 | - | - |

### Entrar na aplicação

O seed cria um usuário por papel, todos com a senha `Demo@1234` e o *tenant*
`demo`. Entrar com papéis diferentes é a forma mais rápida de ver o RBAC em
ação: o menu encolhe e as rotas passam a negar acesso.

| Papel | E-mail |
| --- | --- |
| Super admin | `super@condominio.app` |
| Administrador | `admin@horizonte.com.br` |
| Síndico | `sindico@parqueflores.com.br` |
| Portaria | `portaria@parqueflores.com.br` |
| Morador | `morador@parqueflores.com.br` |

## 🌍 Variáveis de Ambiente

Veja `.env.example` para lista completa de variáveis. Principais:

```env
# Database
DB_HOST=db
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=admin123
DB_NAME=condominio_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=seu-secret-key-aqui
JWT_REFRESH_SECRET=seu-refresh-secret-aqui

# URLs
API_URL=http://localhost:3333
VITE_API_URL=http://localhost:3333
```

## 📁 Estrutura do Projeto

```
condominio/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── config/         # Configuração e variáveis de ambiente
│   │   ├── database/       # Migrations e seeds
│   │   ├── modules/        # Os 27 módulos, um por recurso
│   │   │   ├── auth/       # Autenticação e recuperação de senha
│   │   │   ├── audit/      # Trilha append-only
│   │   │   ├── lgpd/       # Exclusão, exportação e consentimento
│   │   │   ├── documents/  # Upload com matriz de visibilidade
│   │   │   └── ...         # condominiums, units, residents, financial, ...
│   │   ├── middlewares/    # Auth, validação, upload, rate limit
│   │   ├── shared/         # Entidades base, fábrica de CRUD, constantes
│   │   ├── realtime/       # Canal de eventos
│   │   ├── jobs/           # Rotinas agendadas
│   │   ├── routes/         # Montagem do router da API
│   │   ├── app.ts          # Aplicação Express
│   │   └── server.ts       # Entrada do processo
│   ├── tests/
│   │   ├── integration/    # Suítes por módulo, sobre SQLite em memória
│   │   ├── unit/           # Regras isoladas
│   │   └── helpers/        # Contexto de teste e personas
│   ├── Dockerfile          # Container backend
│   └── package.json        # Dependências
│
├── frontend/                # SPA React/Vite
│   ├── src/
│   │   ├── features/       # Uma pasta por módulo: página, hooks, schema
│   │   ├── components/     # ui/ (primitivos), common/, layout/, charts/
│   │   ├── providers/      # Auth, tema, React Query, condomínio
│   │   ├── routes/         # Navegação, router e guarda de permissão
│   │   ├── hooks/          # Hooks compartilhados
│   │   ├── lib/            # Cliente HTTP, permissões, formatação, CRUD
│   │   ├── types/          # Contratos espelhados do backend
│   │   ├── test/           # Harness de render e dublês de transporte
│   │   ├── App.tsx         # Componente raiz
│   │   └── main.tsx        # Entrada da aplicação
│   ├── public/             # Assets estáticos
│   ├── Dockerfile          # Container frontend
│   ├── nginx.conf          # Configuração Nginx
│   └── package.json        # Dependências
│
├── docs/                   # Documentação
│   ├── QUICKSTART.md       # Quick start 3 minutos
│   ├── DOCKER.md           # Guia Docker completo
│   ├── DEVOPS-STATUS.md    # Configuração do ambiente
│   └── historico/          # Registros datados de entregas passadas
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # GitHub Actions CI/CD
│
├── docker-compose.yml      # Orquestração dos serviços
├── .env.example            # Variáveis de exemplo
├── .dockerignore            # Arquivos ignorados no Docker
├── .gitignore              # Arquivos ignorados no Git
├── package.json            # Scripts root
└── README.md               # Este arquivo
```

## 🧪 Testes

### Rodar Testes

```bash
# Testes backend
npm --prefix backend run test

# Testes frontend
npm --prefix frontend run test

# Com cobertura
npm --prefix backend run test:cov
npm --prefix frontend run test:cov
```

### Testes no Docker

```bash
# Backend com banco de testes
docker compose exec api npm run test

# Frontend
docker compose exec web npm run test
```

## 🔐 Segurança

- ✅ JWT para autenticação
- ✅ RBAC para autorização
- ✅ Helmet.js para headers HTTP
- ✅ CORS configurado
- ✅ Rate limiting
- ✅ Validação de entrada com Zod
- ✅ Dependências atualizadas regularmente
- ✅ Scanning de vulnerabilidades com Trivy

## 🚢 CI/CD Pipeline

GitHub Actions executa automaticamente:

1. **Lint & Type Check**: ESLint + TypeScript
2. **Testes**: Jest (backend) + Vitest (frontend)
3. **Build**: Compilação de ambos os serviços
4. **Docker Build**: Construção de imagens (apenas main)
5. **Security Scan**: Trivy para vulnerabilidades
6. **Notificação**: Status do pipeline

### Triggerar Pipeline

O workflow executa automaticamente em:
- Push para `master`
- Pull requests para `master`

Também pode ser disparado à mão pela aba Actions (`workflow_dispatch`).

## 📚 Documentação Completa

- 📖 [Guia Docker Completo](./docs/DOCKER.md)
- ⚡ [Quick Start 3 Minutos](./docs/QUICKSTART.md)
- 🔧 [Configuração Detalhada](./docs/DEVOPS-STATUS.md)
- 🗂️ [Histórico de entregas](./docs/historico/) — registros datados, não documentação atual

## 🐛 Troubleshooting

### "Port already in use"

```bash
# Alterar portas no .env
API_PORT=3334
WEB_PORT=3001
DB_PORT=3307
```

### "Cannot connect to database"

```bash
# Verificar logs do banco
docker compose logs db

# Conectar diretamente
docker compose exec db mysql -uadmin -padmin123 condominio_db
```

### "Frontend não conecta ao API"

```bash
# Verificar logs
npm run docker:logs:all

# Testar conectividade
docker compose exec web curl http://api:3333/api/v1/health/ready
```

### "Build falha"

```bash
# Limpar e reconstruir
npm run docker:down:all
npm run docker:rebuild
npm run docker:up
```

Para mais problemas, veja [Guia Docker Completo](./docs/DOCKER.md#-troubleshooting).

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

Para reportar issues ou sugestões:
1. Abra uma [issue no GitHub](https://github.com/seu-usuario/condominio/issues)
2. Verifique os [logs](docs/DOCKER.md#-troubleshooting)
3. Consulte a [documentação](./docs/DOCKER.md)

## 🙋 Contato

**Email**: dev@condominio.com  
**Documentação**: [GitHub Wiki](https://github.com/seu-usuario/condominio/wiki)

---

**Pronto para começar?** Execute: `npm run docker:up` 🚀

Última atualização: 2026-09-17
