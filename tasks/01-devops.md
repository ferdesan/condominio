# TASK 01 - DEVOPS E AMBIENTE

## Objetivo

Preparar todo o ambiente de desenvolvimento, homologação e CI/CD do sistema de gestão de condomínio.

## Stack

- Node.js
- Express
- TypeORM
- MySQL
- React
- Vite
- Typescript

## Atividades

### Docker

Criar:

- docker-compose.yml
- Dockerfile do backend
- Dockerfile do frontend

Configurar:

- mysql
- backend
- frontend

Criar volumes persistentes.

Configurar variáveis de ambiente.

### Package Scripts

Validar e corrigir scripts:

- docker:up
- docker:down
- docker:logs
- docker:restart

Garantir funcionamento.

### GitHub Actions

Criar workflow:

- Install dependencies
- Lint
- Build Backend
- Build Frontend
- Run Tests

Local:

.github/workflows/ci.yml

### Entregáveis

- docker-compose.yml
- Dockerfiles
- workflow CI
- documentação de execução

### Critérios de Aceite

- Projeto sobe com um único comando
- Backend acessível
- Frontend acessível
- Banco acessível
- Pipeline executando sem erros
