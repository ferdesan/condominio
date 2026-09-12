# 🚀 Quick Start - Plataforma SaaS Condomínio

## ⚡ 3 Minutos para Começar

### 1️⃣ Configuração Inicial
```bash
# Clone e entre no diretório
git clone https://github.com/seu-usuario/condominio.git
cd condominio

# Copie o arquivo de variáveis
cp .env.example .env
```

### 2️⃣ Inicie os Serviços
```bash
# Opção A: Script automatizado (Recomendado)
# Linux/Mac:
./docker-init.sh start

# Windows (PowerShell):
.\docker-init.ps1 -Command start

# Opção B: Comando direto
npm run docker:up
```

### 3️⃣ Acesse a Aplicação
- 🌐 **Frontend:** http://localhost:3000
- 🔌 **API:** http://localhost:3333
- 📚 **API Docs:** http://localhost:3333/api-docs
- 🗄️ **Banco de Dados:** localhost:3306

---

## 📋 Comandos Essenciais

### Gerenciamento
```bash
npm run docker:ps         # Ver status dos containers
npm run docker:health     # Verificar saúde dos serviços
npm run docker:logs       # Ver logs em tempo real
npm run docker:down       # Parar serviços (mantém volumes)
npm run docker:down:all   # Parar e remover tudo
```

### Desenvolvimento
```bash
npm run docker:bash:api   # Terminal do backend
npm run docker:bash:web   # Terminal do frontend
npm run docker:bash:db    # MySQL shell
```

### Limpeza
```bash
npm run docker:rebuild    # Rebuild sem cache
npm run docker:prune      # Limpeza do sistema Docker
```

---

## 🔑 Credenciais Padrão

| Serviço | Host | User | Password |
|---------|------|------|----------|
| **Frontend** | localhost:3000 | - | - |
| **API** | localhost:3333 | - | - |
| **MySQL** | localhost:3306 | admin | admin123 |
| **Redis** | localhost:6379 | - | - |

⚠️ **Nunca use em produção!**

---

## 📂 Estrutura do Projeto

```
condominio/
├── frontend/          # React + Vite
├── backend/           # Node.js + Express
├── docs/              # Documentação
├── docker-compose.yml # Orquestração
├── .env.example       # Template env
└── package.json       # Scripts root
```

---

## 🆘 Problemas Comuns

### Porta já em uso?
```bash
# Altere no .env
API_PORT=3334
WEB_PORT=3001
DB_PORT=3307
```

### Banco de dados não conecta?
```bash
docker compose logs db
docker compose ps
```

### Frontend não carrega API?
```bash
docker compose logs api
npm run docker:bash:web
# Teste: curl http://api:3333/api/v1/health/ready
```

### Remover tudo e recomeçar?
```bash
npm run docker:down:all
npm run docker:prune
npm run docker:up
```

---

## 📚 Documentação Completa

Para informações detalhadas, veja:
- 📖 [`docs/DOCKER.md`](./docs/DOCKER.md) - Guia Docker completo
- 📋 [`FASE8-RELATORIO.md`](./FASE8-RELATORIO.md) - Relatório técnico
- 🏗️ [`docker-compose.yml`](./docker-compose.yml) - Configuração dos serviços
- 📚 [`README.md`](./README.md) - Visão geral do projeto

---

## 💡 Tips

✅ Use `npm run docker:logs:all` para debug  
✅ Volumes Docker persistem dados entre restarts  
✅ Health checks garantem serviços saudáveis  
✅ GitHub Actions roda testes automaticamente  

---

**Pronto para começar? Execute:** `npm run docker:up` 🚀
