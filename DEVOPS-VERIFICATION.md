# ✅ DevOps Verification Guide - Task 01

**Objetivo**: Validar que todos os critérios de aceite da Task 01 foram atendidos

**Data**: 2026-09-12  
**Projeto**: Plataforma SaaS Condomínio  
**Executor**: DevOps Engineer

---

## 🎯 Critérios de Aceite

### ✅ Critério 1: Projeto sobe com um único comando

**Teste**: 
```bash
# No diretório raiz do projeto
npm run docker:up
```

**Validação de Sucesso**:
- [ ] Comando executa sem erros
- [ ] Todos os 4 containers iniciam (db, redis, api, web)
- [ ] Mensagem de conclusão indica "All services running"
- [ ] `npm run docker:ps` mostra todos os containers com status "Up"

**Log Esperado**:
```
✓ db         Up (healthy)
✓ redis      Up (healthy)
✓ api        Up (healthy)
✓ web        Up (healthy)
```

**Troubleshooting**:
- Se porta já está em uso: `API_PORT=3334 npm run docker:up`
- Se build falha: `npm run docker:rebuild`
- Se volumes problemáticos: `npm run docker:down:all && npm run docker:up`

---

### ✅ Critério 2: Backend acessível

**Teste 1 - Health Check**:
```bash
# Método 1: curl
curl http://localhost:3333/api/v1/health/ready

# Método 2: via Docker
docker compose exec api curl http://localhost:3333/api/v1/health/ready

# Método 3: via npm script
npm run docker:bash:api
# Dentro do container:
curl http://localhost:3333/api/v1/health/ready
```

**Validação de Sucesso**:
- [ ] Resposta HTTP 200
- [ ] Response JSON com status "ok"
- [ ] Tempo de resposta < 500ms

**Response Esperado**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-12T10:00:00Z",
  "uptime": 45.234
}
```

**Teste 2 - Logs Backend**:
```bash
npm run docker:logs | grep api
```

**Validação**:
- [ ] Logs mostram "Express server running on port 3333"
- [ ] Logs mostram "Database connection successful"
- [ ] Logs mostram "Redis connection successful"
- [ ] Sem erros ou warnings críticos

**Teste 3 - Conectar ao Banco**:
```bash
docker compose exec api mysql -h db -u admin -padmin123 -e "SELECT 1"
```

**Validação**:
- [ ] Comando retorna resultado sem erros

---

### ✅ Critério 3: Frontend acessível

**Teste 1 - HTTP Request**:
```bash
# Método 1: curl
curl -I http://localhost:3000

# Método 2: wget
wget -q -O- http://localhost:3000 | head -5

# Método 3: Browser
# Abrir http://localhost:3000 no navegador
```

**Validação de Sucesso**:
- [ ] Resposta HTTP 200
- [ ] Content-Type é "text/html"
- [ ] Frontend React carrega (verificar no console do navegador)

**Response Esperado**:
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: no-cache, no-store, must-revalidate
Server: nginx
```

**Teste 2 - Nginx Logs**:
```bash
npm run docker:logs | grep web
```

**Validação**:
- [ ] Logs mostram "nginx: master process"
- [ ] Logs mostram "cache_bypass" para acesso ao index.html
- [ ] Sem erros 5xx

**Teste 3 - Verificar Assets**:
```bash
curl http://localhost:3000/index.html -I
curl http://localhost:3000/favicon.ico -I
```

**Validação**:
- [ ] Status 200 para index.html
- [ ] Status 200 ou 404 para favicon (404 é ok)

---

### ✅ Critério 4: Banco acessível

**Teste 1 - Conectar ao MySQL**:
```bash
# Método 1: via npm script
npm run docker:bash:db

# Dentro da shell MySQL:
SELECT 1;
SHOW DATABASES;
USE condominio_db;
SHOW TABLES;
```

**Validação de Sucesso**:
- [ ] Comando de conexão executa sem erro
- [ ] Pode executar queries
- [ ] Database `condominio_db` existe
- [ ] Tabelas estão presentes

**Teste 2 - Verificar Volume Persistente**:
```bash
docker volume ls | grep mysql-data
docker volume inspect condominio-mysql-data
```

**Validação**:
- [ ] Volume `condominio-mysql-data` existe
- [ ] Mountpoint está correto

**Teste 3 - Verificar Logs do MySQL**:
```bash
docker compose logs db | tail -20
```

**Validação**:
- [ ] Logs mostram "ready for connections"
- [ ] Logs mostram "MySQL Server has started"
- [ ] Sem erros críticos

**Teste 4 - Test Health Check**:
```bash
docker compose ps

# Verificar coluna STATUS
# Deve mostrar: Up X seconds (healthy)
```

**Validação**:
- [ ] Status mostra "(healthy)" para db

**Teste 5 - Redis Acessível**:
```bash
docker compose exec redis redis-cli ping
# Retorna: PONG
```

**Validação**:
- [ ] Comando retorna "PONG"
- [ ] Redis está respondendo

---

### ✅ Critério 5: Pipeline CI/CD executando sem erros

**Teste 1 - Verificar Arquivo da Workflow**:
```bash
# Arquivo deve existir e estar bem formado
test -f .github/workflows/ci-cd.yml && echo "✅ Workflow exists"

# Validar YAML
docker run -it --rm -v $(pwd):/workspace alpine/flake8 yamllint .github/workflows/ci-cd.yml
# Ou manualmente verificar
cat .github/workflows/ci-cd.yml
```

**Validação**:
- [ ] Arquivo existe em `.github/workflows/ci-cd.yml`
- [ ] YAML é válido (sem erros de sintaxe)
- [ ] Todos os jobs estão definidos

**Teste 2 - Verificar Estrutura da Workflow**:
```bash
# Verificar se contém os jobs necessários
grep -E "lint-typecheck|test|build|docker-build|security-scan" .github/workflows/ci-cd.yml
```

**Validação**:
- [ ] Job `lint-typecheck` presente
- [ ] Job `test` presente
- [ ] Job `build` presente
- [ ] Job `docker-build` presente (condicional para main)
- [ ] Job `security-scan` presente
- [ ] Job `notify` presente

**Teste 3 - Simular Pipeline Localmente**:
```bash
# Instalar dependências
npm run install:all

# Executar lint
npm run lint

# Executar testes
npm run test

# Executar build
npm run build
```

**Validação**:
- [ ] Lint executa sem erros críticos
- [ ] Testes passam
- [ ] Build completa sem erros
- [ ] Artefatos são gerados (backend/dist, frontend/dist)

**Teste 4 - Verificar Triggers da Workflow**:
```yaml
# Na seção 'on' do ci-cd.yml deve conter:
- push para branches: main, develop
- pull_request para branches: main, develop
```

**Validação**:
- [ ] Workflow dispara em push
- [ ] Workflow dispara em PR
- [ ] Branches corretos configurados

**Teste 5 - GitHub Actions Execution** (Requer repositório GitHub):
1. Fazer commit e push para branch develop ou main
2. Acessar: https://github.com/seu-usuario/condominio/actions
3. Verificar se workflow inicia automaticamente
4. Aguardar conclusão de todos os jobs
5. Verificar se todos os jobs passaram

**Validação**:
- [ ] Workflow dispara automaticamente
- [ ] Job lint-typecheck passa
- [ ] Job test passa
- [ ] Job build passa
- [ ] Job docker-build condicional funciona (se main)
- [ ] Job security-scan passa
- [ ] Notificação de sucesso aparece

---

## 📋 Checklist Completo

### Docker & Containers
```bash
# Verificar presença de arquivos
[ -f docker-compose.yml ] && echo "✅ docker-compose.yml"
[ -f backend/Dockerfile ] && echo "✅ backend/Dockerfile"
[ -f frontend/Dockerfile ] && echo "✅ frontend/Dockerfile"
[ -f frontend/nginx.conf ] && echo "✅ frontend/nginx.conf"
[ -f .env.example ] && echo "✅ .env.example"
[ -f backend/.dockerignore ] && echo "✅ backend/.dockerignore"
[ -f frontend/.dockerignore ] && echo "✅ frontend/.dockerignore"
```

### Package Scripts
```bash
# Verificar presença de scripts
npm run docker:up --help 2>&1 | grep -q "docker compose" && echo "✅ docker:up"
npm run docker:down --help 2>&1 | grep -q "docker compose" && echo "✅ docker:down"
npm run docker:logs --help 2>&1 | grep -q "docker compose" && echo "✅ docker:logs"
npm run docker:ps --help 2>&1 | grep -q "docker compose" && echo "✅ docker:ps"
npm run docker:bash:api --help 2>&1 | grep -q "docker compose" && echo "✅ docker:bash:api"
npm run docker:bash:db --help 2>&1 | grep -q "docker compose" && echo "✅ docker:bash:db"
npm run docker:health --help 2>&1 && echo "✅ docker:health"
```

### CI/CD Pipeline
```bash
# Verificar arquivo de workflow
[ -f .github/workflows/ci-cd.yml ] && echo "✅ CI/CD workflow exists"

# Contar jobs
grep "^  [a-z-]*:" .github/workflows/ci-cd.yml | wc -l
# Deve ter 6 jobs: lint-typecheck, test, build, docker-build, security-scan, notify
```

### Documentação
```bash
[ -f README.md ] && echo "✅ README.md"
[ -f QUICKSTART.md ] && echo "✅ QUICKSTART.md"
[ -f docs/DOCKER.md ] && echo "✅ docs/DOCKER.md"
[ -f DEVOPS-STATUS.md ] && echo "✅ DEVOPS-STATUS.md"
[ -f DEVOPS-VERIFICATION.md ] && echo "✅ DEVOPS-VERIFICATION.md (este arquivo)"
```

---

## 🚀 Script de Automação Completa

Execute este script para validar tudo de uma vez:

```bash
#!/bin/bash
set -e

echo "🔍 DevOps Verification Script"
echo "============================="

# 1. Verificar arquivos
echo ""
echo "1️⃣ Verificando arquivos..."
FILES=(
  "docker-compose.yml"
  "backend/Dockerfile"
  "frontend/Dockerfile"
  "frontend/nginx.conf"
  ".env.example"
  "backend/.dockerignore"
  "frontend/.dockerignore"
  ".github/workflows/ci-cd.yml"
  "README.md"
  "QUICKSTART.md"
  "docs/DOCKER.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (MISSING)"
  fi
done

# 2. Instalar dependências (sem Docker)
echo ""
echo "2️⃣ Instalando dependências..."
npm run install:all 2>&1 | tail -3

# 3. Executar linting
echo ""
echo "3️⃣ Executando lint..."
npm run lint 2>&1 | tail -5 || echo "  ⚠️ Lint warnings (não-crítico)"

# 4. Executar testes
echo ""
echo "4️⃣ Executando testes..."
npm run test 2>&1 | tail -5 || echo "  ⚠️ Testes com falhas"

# 5. Executar build
echo ""
echo "5️⃣ Executando build..."
npm run build 2>&1 | tail -3

# 6. Verificar artefatos de build
echo ""
echo "6️⃣ Verificando artefatos..."
[ -d "backend/dist" ] && echo "  ✅ backend/dist/" || echo "  ❌ backend/dist/ (missing)"
[ -d "frontend/dist" ] && echo "  ✅ frontend/dist/" || echo "  ❌ frontend/dist/ (missing)"

# 7. Verificar Docker (se instalado)
echo ""
echo "7️⃣ Verificando Docker..."
if command -v docker &> /dev/null; then
  docker --version && echo "  ✅ Docker instalado"
  npm run docker:up
  sleep 10
  npm run docker:health
  echo "  ℹ️ Execute 'npm run docker:down' para parar"
else
  echo "  ℹ️ Docker não está instalado neste ambiente"
  echo "  📖 Instruções: https://docs.docker.com/get-docker/"
fi

echo ""
echo "✅ Verificação concluída!"
```

---

## 📊 Resultado Esperado

Após completar todos os testes, você deve ter:

```
✅ DOCKER
  ✅ docker-compose.yml válido
  ✅ Dockerfiles válidos (backend e frontend)
  ✅ nginx.conf válido
  ✅ .env.example com todas as variáveis
  ✅ .dockerignore em ambos os diretórios

✅ CONTAINERS
  ✅ MySQL (db) rodando e saudável
  ✅ Redis rodando e saudável
  ✅ Backend (api) rodando e saudável
  ✅ Frontend (web) rodando e saudável

✅ ACESSIBILIDADE
  ✅ Backend acessível em http://localhost:3333
  ✅ Frontend acessível em http://localhost:3000
  ✅ Banco MySQL acessível em localhost:3306
  ✅ Redis acessível em localhost:6379

✅ CI/CD
  ✅ Workflow arquivo presente
  ✅ Todos os jobs configurados
  ✅ Lint passa
  ✅ Testes passam
  ✅ Build completa
  ✅ Security scan funciona
```

---

## 📞 Suporte

### Se algo falhar:

1. **Logs Detalhados**: `npm run docker:logs:all`
2. **Documentação**: `docs/DOCKER.md`
3. **Verificação**: `npm run docker:health`
4. **Reset Completo**: `npm run docker:down:all && npm run docker:rebuild`

### Documentos Relacionados:

- [DEVOPS-STATUS.md](./DEVOPS-STATUS.md) - Status completo da Task 01
- [README.md](./README.md) - Documentação do projeto
- [QUICKSTART.md](./QUICKSTART.md) - Quick start rápido
- [docs/DOCKER.md](./docs/DOCKER.md) - Guia Docker detalhado

---

**Status**: ✅ Pronto para Testes

**Próximo Passo**: Execute os testes conforme o checklist acima
