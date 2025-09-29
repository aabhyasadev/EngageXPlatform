# EngageX Deployment Script for Windows PowerShell
# Usage: .\deploy.ps1 [command]

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Service = ""
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if Docker is installed
function Test-Docker {
    try {
        $null = Get-Command docker -ErrorAction Stop
        $null = Get-Command docker-compose -ErrorAction Stop
        return $true
    }
    catch {
        Write-Error "Docker or Docker Compose is not installed. Please install Docker Desktop first."
        exit 1
    }
}

# Function to create environment file if it doesn't exist
function New-EnvFile {
    if (-not (Test-Path ".env")) {
        Write-Warning ".env file not found. Creating template..."
        
        $envContent = @"
# Database Configuration
DATABASE_URL=postgresql://engagex_user:engagex_password@db:5432/engagex

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Django Configuration
SECRET_KEY=your-secret-key-here-change-in-production
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,frontend

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# Payment Configuration (Stripe)
STRIPE_SECRET_KEY=your-stripe-secret-key
VITE_STRIPE_PUBLIC_KEY=your-stripe-public-key

# Add other environment variables as needed
"@
        
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Warning "Please update .env file with your actual values before deploying."
    }
}

# Function to build containers
function Invoke-Build {
    Write-Status "Building Docker containers..."
    docker-compose build
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Build completed successfully!"
    } else {
        Write-Error "Build failed!"
        exit 1
    }
}

# Function to start the application
function Start-Application {
    Write-Status "Starting EngageX application..."
    New-EnvFile
    docker-compose up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Application started successfully!"
        Write-Status "Frontend: http://localhost"
        Write-Status "Backend API: http://localhost:8000"
        Write-Status "Database: localhost:5432"
    } else {
        Write-Error "Failed to start application!"
        exit 1
    }
}

# Function to stop the application
function Stop-Application {
    Write-Status "Stopping EngageX application..."
    docker-compose down
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Application stopped successfully!"
    } else {
        Write-Error "Failed to stop application!"
        exit 1
    }
}

# Function to restart the application
function Restart-Application {
    Write-Status "Restarting EngageX application..."
    docker-compose restart
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Application restarted successfully!"
    } else {
        Write-Error "Failed to restart application!"
        exit 1
    }
}

# Function to view logs
function Show-Logs {
    param([string]$ServiceName)
    
    if ([string]::IsNullOrEmpty($ServiceName)) {
        Write-Status "Showing logs for all services..."
        docker-compose logs -f
    } else {
        Write-Status "Showing logs for service: $ServiceName"
        docker-compose logs -f $ServiceName
    }
}

# Function to check application status
function Show-Status {
    Write-Status "Application Status:"
    docker-compose ps
}

# Function to clean up everything
function Invoke-Clean {
    Write-Warning "This will remove all containers, networks, and volumes."
    $confirm = Read-Host "Are you sure? (y/N)"
    
    if ($confirm -match "^[yY]") {
        Write-Status "Cleaning up Docker resources..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        Write-Success "Cleanup completed!"
    } else {
        Write-Status "Cleanup cancelled."
    }
}

# Function to run database migrations
function Invoke-Migrate {
    Write-Status "Running database migrations..."
    docker-compose exec backend python manage.py migrate
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Migrations completed!"
    } else {
        Write-Error "Migration failed!"
        exit 1
    }
}

# Function to create superuser
function New-Superuser {
    Write-Status "Creating Django superuser..."
    docker-compose exec backend python manage.py createsuperuser
}

# Function to collect static files
function Invoke-CollectStatic {
    Write-Status "Collecting static files..."
    docker-compose exec backend python manage.py collectstatic --noinput
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Static files collected!"
    } else {
        Write-Error "Failed to collect static files!"
        exit 1
    }
}

# Function to show help
function Show-Help {
    Write-Host ""
    Write-Host "EngageX Deployment Script for Windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\deploy.ps1 [command]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  build           Build Docker containers"
    Write-Host "  start           Start the application"
    Write-Host "  stop            Stop the application"
    Write-Host "  restart         Restart the application"
    Write-Host "  status          Show application status"
    Write-Host "  logs [service]  Show logs (optionally for specific service)"
    Write-Host "  migrate         Run database migrations"
    Write-Host "  createsuperuser Create Django superuser"
    Write-Host "  collectstatic   Collect static files"
    Write-Host "  clean           Clean up all Docker resources"
    Write-Host "  help            Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Green
    Write-Host "  .\deploy.ps1 start           # Start the application"
    Write-Host "  .\deploy.ps1 logs backend    # Show backend logs"
    Write-Host "  .\deploy.ps1 migrate         # Run migrations"
    Write-Host ""
}

# Main script logic
function Main {
    # Check if Docker is available
    Test-Docker
    
    switch ($Command.ToLower()) {
        "build" {
            Invoke-Build
        }
        "start" {
            Start-Application
        }
        "stop" {
            Stop-Application
        }
        "restart" {
            Restart-Application
        }
        "status" {
            Show-Status
        }
        "logs" {
            Show-Logs -ServiceName $Service
        }
        "migrate" {
            Invoke-Migrate
        }
        "createsuperuser" {
            New-Superuser
        }
        "collectstatic" {
            Invoke-CollectStatic
        }
        "clean" {
            Invoke-Clean
        }
        "help" {
            Show-Help
        }
        default {
            Write-Error "Unknown command: $Command"
            Show-Help
            exit 1
        }
    }
}

# Run the main function
Main