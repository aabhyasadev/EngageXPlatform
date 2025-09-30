# EngageX Docker Stack Shutdown Script for Windows
# PowerShell script to stop all EngageX services

param(
    [switch]$Volumes,
    [switch]$Quick,
    [switch]$Help
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DevopsDir = Split-Path -Parent $ScriptDir

# Functions for colored output
function Write-Header {
    Write-Host "================================" -ForegroundColor Blue
    Write-Host "   EngageX Stack Shutdown" -ForegroundColor Blue
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
    Write-Host "Usage: .\stop.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Volumes    Remove volumes (deletes all data)"
    Write-Host "  -Quick      Quick stop (don't remove containers)"
    Write-Host "  -Help       Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\stop.ps1           # Stop and remove containers"
    Write-Host "  .\stop.ps1 -Quick    # Just stop services"
    Write-Host "  .\stop.ps1 -Volumes  # Stop and remove everything including data"
    exit 0
}

function Stop-Services {
    Write-Info "Stopping services..."
    Set-Location $DevopsDir
    
    try {
        $runningContainers = docker compose ps --quiet
        if ($runningContainers) {
            docker compose stop
            Write-Success "Services stopped"
        }
        else {
            Write-Info "No running services found"
        }
    }
    catch {
        Write-Warning "Error stopping services: $_"
    }
    
    Write-Host ""
}

function Remove-Containers {
    Write-Info "Removing containers..."
    Set-Location $DevopsDir
    
    try {
        docker compose down
        Write-Success "Containers removed"
    }
    catch {
        Write-ErrorMsg "Error removing containers: $_"
    }
    
    Write-Host ""
}

function Remove-Volumes {
    Write-Warning "This will DELETE all data including:"
    Write-Host "  - Database data"
    Write-Host "  - Redis data"
    Write-Host "  - Media files"
    Write-Host "  - Logs"
    Write-Host ""
    
    $confirm = Read-Host "Are you sure? (yes/no)"
    
    if ($confirm -eq "yes") {
        Set-Location $DevopsDir
        try {
            docker compose down -v
            Write-Success "Volumes removed"
        }
        catch {
            Write-ErrorMsg "Error removing volumes: $_"
        }
    }
    else {
        Write-Info "Volume removal cancelled"
    }
    
    Write-Host ""
}

function Show-Resources {
    Write-Info "Docker resources:"
    Write-Host ""
    
    # Count running containers
    $running = (docker ps -q | Measure-Object).Count
    Write-Host "  Running containers: $running"
    
    # Show volumes
    Write-Host "  EngageX volumes:"
    try {
        $volumes = docker volume ls | Select-String "engagex"
        if ($volumes) {
            $volumes | ForEach-Object { Write-Host "    $_" }
        }
        else {
            Write-Host "    (none)"
        }
    }
    catch {
        Write-Host "    (none)"
    }
    
    Write-Host ""
}

# Main execution
function Main {
    if ($Help) {
        Show-Help
    }
    
    Write-Header
    
    # Check if Docker is available
    try {
        $null = docker --version
    }
    catch {
        Write-ErrorMsg "Docker is not installed"
        exit 1
    }
    
    # Execute shutdown
    if ($Quick) {
        Stop-Services
    }
    elseif ($Volumes) {
        Stop-Services
        Remove-Volumes
    }
    else {
        Stop-Services
        Remove-Containers
    }
    
    Show-Resources
    
    Write-Success "Shutdown complete!"
}

# Run main function
Main
