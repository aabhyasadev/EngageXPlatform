#!/bin/bash
set -e

# EngageX Docker Stack Startup Script
# This script starts all EngageX services using Docker Compose

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVOPS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DEVOPS_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}   EngageX Stack Startup${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_success "Docker Compose is installed"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker daemon is running"
    
    echo ""
}

# Check environment file
check_env_file() {
    print_info "Checking environment configuration..."
    
    if [ ! -f "$DEVOPS_DIR/.env" ]; then
        print_warning ".env file not found"
        
        if [ -f "$DEVOPS_DIR/.env.example" ]; then
            print_info "Creating .env from .env.example..."
            cp "$DEVOPS_DIR/.env.example" "$DEVOPS_DIR/.env"
            print_warning "Please edit $DEVOPS_DIR/.env with your configuration"
            print_info "Press Enter to continue after editing, or Ctrl+C to exit..."
            read
        else
            print_error "No .env.example file found. Please create .env manually."
            exit 1
        fi
    else
        print_success ".env file exists"
    fi
    
    echo ""
}

# Pull images
pull_images() {
    print_info "Pulling latest base images..."
    cd "$DEVOPS_DIR"
    docker compose pull postgres redis nginx || true
    print_success "Base images pulled"
    echo ""
}

# Build images
build_images() {
    print_info "Building application images..."
    cd "$DEVOPS_DIR"
    
    if [ "$1" = "--no-cache" ]; then
        print_info "Building with --no-cache flag..."
        docker compose build --no-cache
    else
        docker compose build
    fi
    
    print_success "Images built successfully"
    echo ""
}

# Start services
start_services() {
    print_info "Starting services..."
    cd "$DEVOPS_DIR"
    
    # Start database and Redis first
    print_info "Starting database and Redis..."
    docker compose up -d postgres redis
    
    # Wait for database to be healthy
    print_info "Waiting for database to be ready..."
    timeout 60 bash -c 'until docker compose exec -T postgres pg_isready -U ${POSTGRES_USER:-engagex_user} &> /dev/null; do sleep 2; done'
    print_success "Database is ready"
    
    # Wait for Redis to be ready
    print_info "Waiting for Redis to be ready..."
    timeout 30 bash -c 'until docker compose exec -T redis redis-cli ping &> /dev/null; do sleep 2; done'
    print_success "Redis is ready"
    
    # Start backend
    print_info "Starting backend API..."
    docker compose up -d backend
    sleep 5
    
    # Start Celery workers
    print_info "Starting Celery workers..."
    docker compose up -d celery-worker celery-beat flower
    sleep 3
    
    # Start frontend
    print_info "Starting frontend..."
    docker compose up -d frontend
    sleep 3
    
    # Start Nginx
    print_info "Starting Nginx..."
    docker compose up -d nginx
    
    print_success "All services started"
    echo ""
}

# Run migrations
run_migrations() {
    print_info "Running database migrations..."
    cd "$DEVOPS_DIR"
    
    if docker compose exec -T backend python manage.py migrate --noinput; then
        print_success "Migrations completed"
    else
        print_warning "Migration failed or not needed"
    fi
    echo ""
}

# Collect static files
collect_static() {
    print_info "Collecting static files..."
    cd "$DEVOPS_DIR"
    
    if docker compose exec -T backend python manage.py collectstatic --noinput --clear; then
        print_success "Static files collected"
    else
        print_warning "Static collection failed or not needed"
    fi
    echo ""
}

# Show service status
show_status() {
    print_info "Service status:"
    cd "$DEVOPS_DIR"
    docker compose ps
    echo ""
}

# Show service URLs
show_urls() {
    echo -e "${GREEN}Services are now running!${NC}"
    echo ""
    echo -e "${BLUE}Available services:${NC}"
    echo "  Frontend:       http://localhost:5000"
    echo "  Backend API:    http://localhost:8001"
    echo "  Flower:         http://localhost:5555 (admin/admin)"
    echo "  PostgreSQL:     localhost:5432"
    echo "  Redis:          localhost:6379"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "  View logs:      docker compose -f $DEVOPS_DIR/docker-compose.yml logs -f"
    echo "  Stop services:  $SCRIPT_DIR/stop.sh"
    echo "  Shell access:   docker compose -f $DEVOPS_DIR/docker-compose.yml exec backend bash"
    echo ""
}

# Main execution
main() {
    print_header
    
    # Parse arguments
    BUILD_FLAG=""
    SKIP_MIGRATIONS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-cache)
                BUILD_FLAG="--no-cache"
                shift
                ;;
            --skip-migrations)
                SKIP_MIGRATIONS=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --no-cache         Build images without using cache"
                echo "  --skip-migrations  Skip running database migrations"
                echo "  --help, -h         Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Execute steps
    check_prerequisites
    check_env_file
    pull_images
    build_images "$BUILD_FLAG"
    start_services
    
    if [ "$SKIP_MIGRATIONS" = false ]; then
        run_migrations
        collect_static
    fi
    
    show_status
    show_urls
    
    print_success "EngageX stack is up and running!"
}

# Run main function
main "$@"
