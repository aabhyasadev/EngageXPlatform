# EngageX Docker Stack Startup Script for Windows
# PowerShell script to start all EngageX services using Docker Compose

param(
    [switch]$NoCache,
    [switch]$SkipMigrations,
    [switch]$Help
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DevopsDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $DevopsDir

# Functions for colored output
function Write-Header {
    Write-Host "================================" -ForegroundColor Blue
    Write-Host "   EngageX Stack Startup" -ForegroundColor Blue
    Write-Host "================================" -ForegroundColor Blue
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "! $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Show-Help {
    Write-Host "Usage: .\start.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -NoCache          Build images without using cache"
    Write-Host "  -SkipMigrations   Skip running database migrations"
    Write-Host "  -Help             Show this help message"
    exit 0
}

function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Docker
    try {
        $null = docker --version
        Write-Success "Docker is installed"
    }
    catch {
        Write-ErrorMsg "Docker is not installed. Please install Docker Desktop first."
        exit 1
    }
    
    # Check Docker Compose
    try {
        $null = docker compose version
        Write-Success "Docker Compose is installed"
    }
    catch {
        Write-ErrorMsg "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    }
    
    # Check if Docker daemon is running
    try {
        $null = docker info 2>&1
        Write-Success "Docker daemon is running"
    }
    catch {
        Write-ErrorMsg "Docker daemon is not running. Please start Docker Desktop first."
        exit 1
    }
    
    Write-Host ""
}

function Test-EnvFile {
    Write-Info "Checking environment configuration..."
    
    $envFile = Join-Path $DevopsDir ".env"
    $envExample = Join-Path $DevopsDir ".env.example"
    
    if (-not (Test-Path $envFile)) {
        Write-Warning ".env file not found"
        
        if (Test-Path $envExample) {
            Write-Info "Creating .env from .env.example..."
            Copy-Item $envExample $envFile
            Write-Warning "Please edit $envFile with your configuration"
            Write-Info "Press Enter to continue after editing, or Ctrl+C to exit..."
            Read-Host
        }
        else {
            Write-ErrorMsg "No .env.example file found. Please create .env manually."
            exit 1
        }
    }
    else {
        Write-Success ".env file exists"
    }
    
    Write-Host ""
}

function Get-Images {
    Write-Info "Pulling latest base images..."
    Set-Location $DevopsDir
    docker compose pull postgres redis nginx 2>&1 | Out-Null
    Write-Success "Base images pulled"
    Write-Host ""
}

function Build-Images {
    param([bool]$UseNoCache)
    
    Write-Info "Building application images..."
    Set-Location $DevopsDir
    
    if ($UseNoCache) {
        Write-Info "Building with --no-cache flag..."
        docker compose build --no-cache
    }
    else {
        docker compose build
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Images built successfully"
    }
    else {
        Write-ErrorMsg "Image build failed"
        exit 1
    }
    
    Write-Host ""
}

function Start-Services {
    Write-Info "Starting services..."
    Set-Location $DevopsDir
    
    # Start database and Redis first
    Write-Info "Starting database and Redis..."
    docker compose up -d postgres redis
    
    # Wait for database to be healthy
    Write-Info "Waiting for database to be ready..."
    $timeout = 60
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        try {
            $result = docker compose exec -T postgres pg_isready -U engagex_user 2>&1
            if ($LASTEXITCODE -eq 0) {
                break
            }
        }
        catch {}
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Write-Success "Database is ready"
    
    # Wait for Redis to be ready
    Write-Info "Waiting for Redis to be ready..."
    $timeout = 30
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        try {
            $result = docker compose exec -T redis redis-cli ping 2>&1
            if ($result -match "PONG") {
                break
            }
        }
        catch {}
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Write-Success "Redis is ready"
    
    # Start backend
    Write-Info "Starting backend API..."
    docker compose up -d backend
    Start-Sleep -Seconds 5
    
    # Start Celery workers
    Write-Info "Starting Celery workers..."
    docker compose up -d celery-worker celery-beat flower
    Start-Sleep -Seconds 3
    
    # Start frontend
    Write-Info "Starting frontend..."
    docker compose up -d frontend
    Start-Sleep -Seconds 3
    
    # Start Nginx
    Write-Info "Starting Nginx..."
    docker compose up -d nginx
    
    Write-Success "All services started"
    Write-Host ""
}

function Invoke-Migrations {
    Write-Info "Running database migrations..."
    Set-Location $DevopsDir
    
    try {
        docker compose exec -T backend python manage.py migrate --noinput
        Write-Success "Migrations completed"
    }
    catch {
        Write-Warning "Migration failed or not needed"
    }
    
    Write-Host ""
}

function Invoke-CollectStatic {
    Write-Info "Collecting static files..."
    Set-Location $DevopsDir
    
    try {
        docker compose exec -T backend python manage.py collectstatic --noinput --clear
        Write-Success "Static files collected"
    }
    catch {
        Write-Warning "Static collection failed or not needed"
    }
    
    Write-Host ""
}

function Show-Status {
    Write-Info "Service status:"
    Set-Location $DevopsDir
    docker compose ps
    Write-Host ""
}

function Show-URLs {
    Write-Host "Services are now running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available services:" -ForegroundColor Blue
    Write-Host "  Frontend:       http://localhost:5000"
    Write-Host "  Backend API:    http://localhost:8001"
    Write-Host "  Flower:         http://localhost:5555 (admin/admin)"
    Write-Host "  PostgreSQL:     localhost:5432"
    Write-Host "  Redis:          localhost:6379"
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Yellow
    Write-Host "  View logs:      docker compose -f $DevopsDir\docker-compose.yml logs -f"
    Write-Host "  Stop services:  .\stop.ps1"
    Write-Host "  Shell access:   docker compose -f $DevopsDir\docker-compose.yml exec backend bash"
    Write-Host ""
}

# Main execution
function Main {
    if ($Help) {
        Show-Help
    }
    
    Write-Header
    
    # Execute steps
    Test-Prerequisites
    Test-EnvFile
    Get-Images
    Build-Images -UseNoCache $NoCache
    Start-Services
    
    if (-not $SkipMigrations) {
        Invoke-Migrations
        Invoke-CollectStatic
    }
    
    Show-Status
    Show-URLs
    
    Write-Success "EngageX stack is up and running!"
}

# Run main function
Main
