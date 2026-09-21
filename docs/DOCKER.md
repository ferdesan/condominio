# Guia Docker - Plataforma SaaS Condomínio

## 📋 Índice
- [Requisitos](#requisitos)
- [Configuração Inicial](#configuração-inicial)
- [Execução Local](#execução-local)
- [Comandos Úteis](#comandos-úteis)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Troubleshooting](#troubleshooting)
- [Produção](#produção)

## 🔧 Requisitos

- **Docker**: v24.0+
- **Docker Compose**: v2.20+
- **Node.js**: v20.0+ (para desenvolvimento local sem Docker)
- **Git**: v2.30+

### Verificar instalação:
```bash
docker --version
docker compose version
```

## ⚙️ Configuração Inicial

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/condominio.git
cd condominio
```

### 2. Configurar variáveis de ambiente
```bash
# Gerar o .env com secrets aleatórios desta máquina
npm run secrets

# Editar conforme necessário
nano .env  # ou seu editor preferido
```

O `.env.example` é um template com os secrets em branco — `npm run secrets`
preenche `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD` e `DB_ROOT_PASSWORD`
com valores aleatórios. Copiar o template com `cp` não serve: sem esses quatro
valores o `docker compose` para com `defina no .env (rode npm run secrets)`.

### 3. Estrutura de volumes
Os dados serão armazenados em volumes Docker gerenciados:
- `mysql-data`: Dados do banco de dados MySQL
- `redis-data`: Cache Redis

Para persistência em máquina local (desenvolvimento):
```bash
docker volume ls
docker volume inspect condominio-mysql-data
```

## 🚀 Execução Local

### Iniciar ambiente completo
```bash
npm run docker:up
```

Este comando irá:
1. Buildear as imagens (se necessário)
2. Iniciar todos os serviços
3. Executar health checks
4. Exibir status dos containers

### Verificar status
```bash
npm run docker:ps
```

Output esperado:
```
NAME                  STATUS
condominio-db         Up (healthy)
condominio-redis      Up (healthy)
condominio-api        Up (healthy)
condominio-web        Up (healthy)
```

### Acessar a aplicação
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3333
- **API Docs (Swagger)**: http://localhost:3333/api-docs
- **Database**: localhost:3306

### Parar os serviços
```bash
# Manter volumes
npm run docker:down

# Remover tudo incluindo volumes
npm run docker:down:all
```

## 📝 Comandos Úteis

### Logs
```bash
# Logs do API e Web
npm run docker:logs

# Todos os logs
npm run docker:logs:all

# Log de um serviço específico
docker compose logs -f api
docker compose logs -f web
docker compose logs -f db
```

### Terminal interativo
```bash
# Acessar shell do API (Node)
npm run docker:bash:api

# Acessar shell do Web (Nginx)
npm run docker:bash:web

# Acessar MySQL
npm run docker:bash:db
```

### Build
```bash
# Build (usa cache)
npm run docker:build

# Rebuild sem cache
npm run docker:rebuild
```

### Limpeza
```bash
# Remover containers parados
npm run docker:prune

# Remover volume específico
docker volume rm condominio-mysql-data
docker volume rm condominio-redis-data
```

## 🌐 Variáveis de Ambiente

### Database
```env
DB_HOST=db              # Nome do serviço Docker
DB_PORT=3306
DB_USER=admin
DB_NAME=condominio_db
DB_PASSWORD=            # gerado por `npm run secrets`
DB_ROOT_PASSWORD=       # gerado por `npm run secrets`
```

### Redis
```env
REDIS_HOST=redis        # Nome do serviço Docker
REDIS_PORT=6379
```

### API
```env
NODE_ENV=development
API_PORT=3333
API_URL=http://localhost:3333
JWT_SECRET=             # gerado por `npm run secrets`
JWT_REFRESH_SECRET=     # gerado por `npm run secrets`
```

### Frontend
```env
WEB_PORT=3000
VITE_API_URL=http://localhost:3333
```

### AWS S3 (Opcional)
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=sua-chave
AWS_SECRET_ACCESS_KEY=sua-secreta
AWS_S3_BUCKET=seu-bucket
```

### Email (Opcional)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
SMTP_FROM=noreply@condominio.com
```

## 🔧 Troubleshooting

### "Port already in use"
```bash
# Liberar porta
# Linux/Mac:
lsof -i :3333
kill -9 <PID>

# Windows:
netstat -ano | findstr :3333
taskkill /PID <PID> /F

# Ou alterar porta no .env
API_PORT=3334
WEB_PORT=3001
DB_PORT=3307
```

### "Cannot connect to database"
```bash
# Verificar logs do banco
docker compose logs db

# Conectar diretamente
docker compose exec db mysql -uadmin -p"$DB_PASSWORD" condominio_db

# Health check
docker compose ps
```

### "Frontend não conecta ao API"
```bash
# Verificar logs
npm run docker:logs:all

# Verificar rede
docker network ls
docker network inspect condominio-condominio-network

# Testar conectividade
docker compose exec web ping api
docker compose exec api curl http://localhost:3333/api/v1/health/ready
```

### Build falha
```bash
# Limpar cache
docker compose build --no-cache

# Verificar logs detalhados
docker compose build api --progress=plain
```

### Resetar tudo
```bash
# Remover tudo
npm run docker:down:all

# Limpar cache Docker
npm run docker:prune

# Reconstruir
npm run docker:up
```

## 🏭 Produção

### Build para produção
```bash
# Editar variáveis para produção
API_PORT=3333
NODE_ENV=production
VITE_API_URL=https://api.seu-dominio.com
```

Os segredos não entram nesse arquivo em produção: gere um conjunto com

```bash
node scripts/generate-secrets.mjs --print
```

e cole o resultado no gerenciador de segredos do seu ambiente (Docker secrets,
AWS Secrets Manager, Vault). A API recusa subir em produção com os valores de
exemplo que já circularam por este repositório.

### Deploy com Docker Swarm
```bash
docker swarm init
docker stack deploy -c docker-compose.yml condominio
```

### Deploy com Kubernetes
```bash
# Gerar manifests a partir do compose
kompose convert -f docker-compose.yml

# Ou usar Helm Chart (recomendado para produção)
```

### Exemplo docker-compose para produção
```yaml
# docker-compose.prod.yml
version: '3.9'
services:
  api:
    image: ghcr.io/seu-usuario/condominio-api:v1.0.0
    environment:
      NODE_ENV: production
      # ... outras configs
  web:
    image: ghcr.io/seu-usuario/condominio-web:v1.0.0
    # ... outras configs
```

### Backup do banco de dados
```bash
# Gerar dump
docker compose exec db mysqldump -uadmin -p"$DB_PASSWORD" condominio_db > backup.sql

# Restaurar dump
docker compose exec -T db mysql -uadmin -p"$DB_PASSWORD" condominio_db < backup.sql
```

### Monitoramento em produção
```bash
# Verificar uso de recursos
docker compose stats

# Health check
for service in api web db redis; do
  docker compose exec $service healthcheck-command
done
```

## 📚 Documentação Adicional

- [Docker Official Docs](https://docs.docker.com/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Security Best Practices](https://docs.docker.com/engine/security/)

## 📞 Suporte

Para issues ou dúvidas:
1. Verifique os logs: `npm run docker:logs:all`
2. Abra uma issue no GitHub
3. Contate o time de DevOps
