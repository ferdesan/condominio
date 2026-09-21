# Script de inicialização Docker para Plataforma SaaS Condomínio
# Uso: .\docker-init.ps1 -Command start

param(
    [ValidateSet('start', 'stop', 'restart', 'health', 'clean')]
    [string]$Command = 'start'
)

# Cores
$ColorGreen = 'Green'
$ColorRed = 'Red'
$ColorYellow = 'Yellow'
$ColorCyan = 'Cyan'

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor $ColorCyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $ColorGreen
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $ColorRed
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $ColorYellow
}

function Check-Prerequisites {
    Write-Info "Verificando pré-requisitos..."

    try {
        $dockerVersion = docker --version
        Write-Success "Docker encontrado: $dockerVersion"
    } catch {
        Write-Error-Custom "Docker não encontrado. Instale em: https://www.docker.com/products/docker-desktop"
        exit 1
    }

    try {
        $composeVersion = docker compose version
        Write-Success "Docker Compose encontrado"
    } catch {
        Write-Error-Custom "Docker Compose não encontrado"
        exit 1
    }
}

function Setup-Env {
    Write-Info "Configurando variáveis de ambiente..."

    if (-not (Test-Path '.env')) {
        Write-Warning-Custom "Arquivo .env não encontrado"
        Write-Info "Gerando .env com secrets aleatórios..."
        node scripts/generate-secrets.mjs
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Falha ao gerar o .env"
            exit 1
        }
        Write-Success ".env criado com secrets próprios desta máquina"
    } else {
        Write-Success ".env já existe"
    }
}

function Start-Services {
    Write-Info "Iniciando serviços Docker..."
    docker compose up -d --build

    Write-Info "Aguardando serviços ficarem saudáveis..."
    Start-Sleep -Seconds 5

    Check-Health

    Write-Success "Todos os serviços iniciados!"
    Print-AccessInfo
}

function Stop-Services {
    Write-Info "Parando serviços Docker..."
    docker compose down
    Write-Success "Serviços parados"
}

function Restart-Services {
    Write-Info "Reiniciando serviços..."
    Stop-Services
    Start-Sleep -Seconds 2
    Start-Services
}

function Clean-Services {
    Write-Warning-Custom "Removendo TODOS os dados (containers, volumes, networks)..."
    $response = Read-Host "Tem certeza? (s/n)"

    if ($response -eq 's' -or $response -eq 'S') {
        docker compose down -v
        Write-Success "Limpeza concluída"
    } else {
        Write-Info "Operação cancelada"
    }
}

function Check-Health {
    Write-Info "Verificando saúde dos serviços..."

    $services = @('db', 'redis', 'api', 'web')
    foreach ($service in $services) {
        $status = docker compose ps $service --format "{{.Status}}"
        if ($status -match "healthy|Up") {
            Write-Success "$service`: $status"
        } else {
            Write-Error-Custom "$service`: $status"
        }
    }
}

function Print-AccessInfo {
    Write-Host "`n"
    Write-Info "📱 Acessar a aplicação:"
    Write-Host "  Frontend:    http://localhost:3000" -ForegroundColor $ColorGreen
    Write-Host "  API Backend: http://localhost:3333" -ForegroundColor $ColorGreen
    Write-Host "  Database:    localhost:3306" -ForegroundColor $ColorGreen
    Write-Host "  Redis:       localhost:6379" -ForegroundColor $ColorGreen
    Write-Host "`n"
    Write-Info "🔧 Comandos úteis:"
    Write-Host "  npm run docker:logs      - Ver logs" -ForegroundColor $ColorCyan
    Write-Host "  npm run docker:ps        - Status dos containers" -ForegroundColor $ColorCyan
    Write-Host "  npm run docker:bash:api  - Terminal do API" -ForegroundColor $ColorCyan
    Write-Host "  npm run docker:down      - Parar serviços" -ForegroundColor $ColorCyan
    Write-Host "`n"
}

function Show-Usage {
    Write-Host "Uso: .\docker-init.ps1 -Command [COMANDO]`n"
    Write-Host "Comandos disponíveis:"
    Write-Host "  start     - Iniciar todos os serviços"
    Write-Host "  stop      - Parar todos os serviços"
    Write-Host "  restart   - Reiniciar todos os serviços"
    Write-Host "  health    - Verificar saúde dos serviços"
    Write-Host "  clean     - Remover todos os containers e volumes`n"
}

# Main
switch ($Command) {
    'start' {
        Check-Prerequisites
        Setup-Env
        Start-Services
    }
    'stop' {
        Stop-Services
    }
    'restart' {
        Restart-Services
    }
    'health' {
        Check-Health
    }
    'clean' {
        Clean-Services
    }
    default {
        Write-Error-Custom "Comando desconhecido: $Command"
        Show-Usage
        exit 1
    }
}
