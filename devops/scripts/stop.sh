#!/bin/bash
set -e

# EngageX Docker Stack Shutdown Script
# This script stops all EngageX services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVOPS_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}   EngageX Stack Shutdown${NC}"
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

# Stop services
stop_services() {
    print_info "Stopping services..."
    cd "$DEVOPS_DIR"
    
    if docker compose ps --quiet | grep -q .; then
        docker compose stop
        print_success "Services stopped"
    else
        print_info "No running services found"
    fi
    echo ""
}

# Remove containers
remove_containers() {
    print_info "Removing containers..."
    cd "$DEVOPS_DIR"
    docker compose down
    print_success "Containers removed"
    echo ""
}

# Remove volumes
remove_volumes() {
    print_warning "This will DELETE all data including:"
    echo "  - Database data"
    echo "  - Redis data"
    echo "  - Media files"
    echo "  - Logs"
    echo ""
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        cd "$DEVOPS_DIR"
        docker compose down -v
        print_success "Volumes removed"
    else
        print_info "Volume removal cancelled"
    fi
    echo ""
}

# Show remaining resources
show_resources() {
    print_info "Docker resources:"
    echo ""
    
    # Count running containers
    RUNNING=$(docker ps -q | wc -l | tr -d ' ')
    echo "  Running containers: $RUNNING"
    
    # Show volumes
    echo "  EngageX volumes:"
    docker volume ls | grep engagex || echo "    (none)"
    
    echo ""
}

# Main execution
main() {
    print_header
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Parse arguments
    REMOVE_VOLUMES=false
    QUICK_STOP=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --volumes|-v)
                REMOVE_VOLUMES=true
                shift
                ;;
            --quick|-q)
                QUICK_STOP=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --volumes, -v   Remove volumes (deletes all data)"
                echo "  --quick, -q     Quick stop (don't remove containers)"
                echo "  --help, -h      Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                 # Stop and remove containers"
                echo "  $0 --quick         # Just stop services"
                echo "  $0 --volumes       # Stop and remove everything including data"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Execute shutdown
    if [ "$QUICK_STOP" = true ]; then
        stop_services
    elif [ "$REMOVE_VOLUMES" = true ]; then
        stop_services
        remove_volumes
    else
        stop_services
        remove_containers
    fi
    
    show_resources
    
    print_success "Shutdown complete!"
}

# Run main function
main "$@"
