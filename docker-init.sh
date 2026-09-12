#!/bin/bash

# Script de inicialização Docker para Plataforma SaaS Condomínio
# Uso: ./docker-init.sh [start|stop|restart|clean|health]

set -e

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_NAME="condominio"
ENV_FILE=".env"

log_info() {
    echo -e "${COLOR_BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${COLOR_GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${COLOR_RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${COLOR_YELLOW}⚠️  $1${NC}"
}

check_prerequisites() {
    log_info "Verificando pré-requisitos..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado. Instale em: https://www.docker.com/products/docker-desktop"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não encontrado"
        exit 1
    fi

    log_success "Docker e Docker Compose encontrados"
}

setup_env() {
    log_info "Configurando variáveis de ambiente..."

    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Arquivo .env não encontrado"
        if [ -f ".env.example" ]; then
            log_info "Criando .env a partir do .env.example..."
            cp .env.example .env
            log_success ".env criado (verifique as credenciais padrão)"
        else
            log_error "Arquivo .env.example não encontrado"
            exit 1
        fi
    else
        log_success ".env já existe"
    fi
}

start_services() {
    log_info "Iniciando serviços Docker..."
    docker compose up -d --build

    log_info "Aguardando serviços ficarem saudáveis..."
    sleep 5

    check_health

    log_success "Todos os serviços iniciados!"
    print_access_info
}

stop_services() {
    log_info "Parando serviços Docker..."
    docker compose down
    log_success "Serviços parados"
}

restart_services() {
    log_info "Reiniciando serviços..."
    stop_services
    sleep 2
    start_services
}

clean() {
    log_warning "Removendo TODOS os dados (containers, volumes, networks)..."
    read -p "Tem certeza? (s/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        docker compose down -v
        log_success "Limpeza concluída"
    else
        log_info "Operação cancelada"
    fi
}

check_health() {
    log_info "Verificando saúde dos serviços..."

    services=("db" "redis" "api" "web")
    for service in "${services[@]}"; do
        status=$(docker compose ps $service --format "{{.Status}}")
        if [[ $status == *"healthy"* ]] || [[ $status == *"Up"* ]]; then
            log_success "$service: $status"
        else
            log_error "$service: $status"
        fi
    done
}

print_access_info() {
    echo ""
    log_info "📱 Acessar a aplicação:"
    echo "  ${COLOR_GREEN}Frontend:    http://localhost:3000${NC}"
    echo "  ${COLOR_GREEN}API Backend: http://localhost:3333${NC}"
    echo "  ${COLOR_GREEN}Database:    localhost:3306${NC}"
    echo "  ${COLOR_GREEN}Redis:       localhost:6379${NC}"
    echo ""
    log_info "🔧 Comandos úteis:"
    echo "  ${COLOR_BLUE}npm run docker:logs${NC}    - Ver logs"
    echo "  ${COLOR_BLUE}npm run docker:ps${NC}      - Status dos containers"
    echo "  ${COLOR_BLUE}npm run docker:bash:api${NC} - Terminal do API"
    echo "  ${COLOR_BLUE}npm run docker:down${NC}    - Parar serviços"
    echo ""
}

show_usage() {
    echo "Uso: $0 [COMANDO]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  start     - Iniciar todos os serviços"
    echo "  stop      - Parar todos os serviços"
    echo "  restart   - Reiniciar todos os serviços"
    echo "  health    - Verificar saúde dos serviços"
    echo "  clean     - Remover todos os containers e volumes"
    echo "  help      - Mostrar esta mensagem"
    echo ""
}

main() {
    local command="${1:-start}"

    case "$command" in
        start)
            check_prerequisites
            setup_env
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        health)
            check_health
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Comando desconhecido: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
