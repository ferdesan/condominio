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
│   │   ├── config/         # Configurações
│   │   ├── database/       # Migrations, seeds
│   │   ├── modules/        # Módulos da aplicação
│   │   │   ├── auth/       # Autenticação
│   │   │   ├── users/      # Usuários
│   │   │   ├── condominios/# Condomínios
│   │   │   ├── unidades/   # Unidades
│   │   │   ├── moradores/  # Moradores
│   │   │   └── reservas/   # Reservas
│   │   ├── middleware/     # Middlewares Express
│   │   ├── utils/          # Utilidades
│   │   └── server.ts       # Entrada da aplicação
│   ├── tests/              # Testes
│   ├── Dockerfile          # Container backend
│   └── package.json        # Dependências
│
├── frontend/                # SPA React/Vite
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── pages/          # Páginas
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # Serviços HTTP
│   │   ├── context/        # Context API
│   │   ├── utils/          # Utilidades
│   │   ├── App.tsx         # Componente raiz
│   │   └── main.tsx        # Entrada da aplicação
│   ├── public/             # Assets estáticos
│   ├── Dockerfile          # Container frontend
│   ├── nginx.conf          # Configuração Nginx
│   └── package.json        # Dependências
│
├── docs/                    # Documentação
│   ├── DOCKER.md           # Guia Docker completo
│   └── API.md              # Documentação API
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
├── QUICKSTART.md           # Quick start 3 minutos
├── DOCKER.md               # Guia Docker detalhado
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
- Push para `main` ou `develop`
- Pull requests para `main` ou `develop`

## 📚 Documentação Completa

- 📖 [Guia Docker Completo](./docs/DOCKER.md)
- ⚡ [Quick Start 3 Minutos](./QUICKSTART.md)
- 🔧 [Configuração Detalhada](./DEVOPS-STATUS.md)
- 📝 [Relatório Técnico Fase 8](./FASE8-RELATORIO.md)

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

Última atualização: 2026-09-12
