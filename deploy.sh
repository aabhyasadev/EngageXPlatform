#!/bin/bash

# EngageX Deployment Script for Linux/Mac
# Usage: ./deploy.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Function to create environment file if it doesn't exist
create_env_file() {
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating template..."
        cat > .env << EOF
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
EOF
        print_warning "Please update .env file with your actual values before deploying."
    fi
}

# Function to build containers
build() {
    print_status "Building Docker containers..."
    docker-compose build
    print_success "Build completed successfully!"
}

# Function to start the application
start() {
    print_status "Starting EngageX application..."
    create_env_file
    docker-compose up -d
    print_success "Application started successfully!"
    print_status "Frontend: http://localhost"
    print_status "Backend API: http://localhost:8000"
    print_status "Database: localhost:5432"
}

# Function to stop the application
stop() {
    print_status "Stopping EngageX application..."
    docker-compose down
    print_success "Application stopped successfully!"
}

# Function to restart the application
restart() {
    print_status "Restarting EngageX application..."
    docker-compose restart
    print_success "Application restarted successfully!"
}

# Function to view logs
logs() {
    if [ -z "$2" ]; then
        print_status "Showing logs for all services..."
        docker-compose logs -f
    else
        print_status "Showing logs for service: $2"
        docker-compose logs -f "$2"
    fi
}

# Function to check application status
status() {
    print_status "Application Status:"
    docker-compose ps
}

# Function to clean up everything
clean() {
    print_warning "This will remove all containers, networks, and volumes."
    read -p "Are you sure? (y/N): " confirm
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        print_status "Cleaning up Docker resources..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to run database migrations
migrate() {
    print_status "Running database migrations..."
    docker-compose exec backend python manage.py migrate
    print_success "Migrations completed!"
}

# Function to create superuser
createsuperuser() {
    print_status "Creating Django superuser..."
    docker-compose exec backend python manage.py createsuperuser
}

# Function to collect static files
collectstatic() {
    print_status "Collecting static files..."
    docker-compose exec backend python manage.py collectstatic --noinput
    print_success "Static files collected!"
}

# Function to show help
show_help() {
    echo "EngageX Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build           Build Docker containers"
    echo "  start           Start the application"
    echo "  stop            Stop the application"
    echo "  restart         Restart the application"
    echo "  status          Show application status"
    echo "  logs [service]  Show logs (optionally for specific service)"
    echo "  migrate         Run database migrations"
    echo "  createsuperuser Create Django superuser"
    echo "  collectstatic   Collect static files"
    echo "  clean           Clean up all Docker resources"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh start           # Start the application"
    echo "  ./deploy.sh logs backend    # Show backend logs"
    echo "  ./deploy.sh migrate         # Run migrations"
}

# Main script logic
main() {
    check_docker
    
    case "${1:-help}" in
        build)
            build
            ;;
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        status)
            status
            ;;
        logs)
            logs "$@"
            ;;
        migrate)
            migrate
            ;;
        createsuperuser)
            createsuperuser
            ;;
        collectstatic)
            collectstatic
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run the main function with all arguments
main "$@"