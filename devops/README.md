# EngageX DevOps

Complete Docker-based deployment configuration for the EngageX email marketing platform.

## Overview

This directory contains all DevOps configurations for deploying EngageX using Docker containers:

- **Docker Images**: Multi-stage builds for backend, frontend, and Celery workers
- **Orchestration**: Docker Compose setup for local development and production
- **Redis Configuration**: Optimized Redis for caching and message broker
- **Celery Workers**: Background task processing for email campaigns
- **Monitoring**: Health checks and logging configuration

## Directory Structure

```
devops/
├── docker/
│   ├── backend.Dockerfile      # Django API container
│   ├── frontend.Dockerfile     # React app container
│   └── celery.Dockerfile       # Background workers
├── redis/
│   └── redis.conf             # Redis configuration
├── celery/
│   └── worker.sh              # Celery worker startup script
├── docker-compose.yml         # Full stack orchestration
└── README.md                  # This file
```

## Quick Start

### Prerequisites

- Docker 24.0+ and Docker Compose 2.0+
- At least 4GB RAM available
- Environment variables configured

### 1. Environment Setup

Create `.env` file in the `devops/` directory:

```bash
# Database
POSTGRES_DB=engagex
POSTGRES_USER=engagex_user
POSTGRES_PASSWORD=<secure-password>

# Django
SECRET_KEY=<generate-secure-key>
ALLOWED_HOSTS=localhost,127.0.0.1,engagex.com

# SendGrid
SENDGRID_API_KEY=SG.xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
VITE_STRIPE_PUBLIC_KEY=pk_live_xxx

# Celery
CELERY_CONCURRENCY=4
CELERY_LOG_LEVEL=info

# Flower (Celery monitoring)
FLOWER_USER=admin
FLOWER_PASSWORD=<secure-password>

# Ports (optional - defaults shown)
POSTGRES_PORT=5432
REDIS_PORT=6379
BACKEND_PORT=8001
FRONTEND_PORT=5000
FLOWER_PORT=5555
HTTP_PORT=80
HTTPS_PORT=443
```

### 2. Build Images

```bash
cd devops
docker-compose build
```

Build specific service:
```bash
docker-compose build backend
docker-compose build frontend
docker-compose build celery-worker
```

### 3. Start Services

Start all services:
```bash
docker-compose up -d
```

Start specific services:
```bash
docker-compose up -d postgres redis
docker-compose up -d backend celery-worker
```

### 4. Run Migrations

```bash
docker-compose exec backend python manage.py migrate
```

### 5. Create Superuser

```bash
docker-compose exec backend python manage.py createsuperuser
```

### 6. Access Services

- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:8001
- **Flower (Celery Monitor)**: http://localhost:5555
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Service Details

### Backend (Django API)

**Image**: Custom Python 3.11 based on `backend.Dockerfile`

**Features**:
- Gunicorn WSGI server with 4 workers
- Health check endpoint at `/health`
- Static files served from `/app/staticfiles`
- Non-root user for security
- Optimized for production

**Environment Variables**:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection for caching
- `CELERY_BROKER_URL`: Celery message broker
- `SECRET_KEY`: Django secret key
- `SENDGRID_API_KEY`: Email delivery
- `STRIPE_SECRET_KEY`: Payment processing

**Volumes**:
- `media_files`: User uploaded files
- `static_files`: Static assets
- `backend_logs`: Application logs

### Frontend (React SPA)

**Image**: Custom Node.js 20 based on `frontend.Dockerfile`

**Features**:
- Multi-stage build (builder + production)
- Express.js BFF layer
- Optimized production bundle
- Health check endpoint
- Non-root user for security

**Environment Variables**:
- `NODE_ENV`: Production mode
- `API_URL`: Backend API endpoint
- `VITE_STRIPE_PUBLIC_KEY`: Stripe public key

**Build Process**:
1. Install all dependencies
2. Build React app with Vite
3. Copy only production dependencies
4. Run Express server

### Celery Worker

**Image**: Custom Python 3.11 based on `celery.Dockerfile`

**Features**:
- Background task processing
- Email campaign sending
- Scheduled task execution
- Health check via Celery inspect
- Graceful shutdown handling

**Environment Variables**:
- `CELERY_BROKER_URL`: Redis message broker
- `CELERY_RESULT_BACKEND`: Redis result backend
- `CELERY_CONCURRENCY`: Number of worker processes
- `CELERY_LOG_LEVEL`: Logging verbosity
- `CELERY_QUEUES`: Queues to process

**Queues**:
- `celery`: Default queue
- `email`: Email sending tasks
- `high_priority`: Urgent tasks
- `low_priority`: Background cleanup

### Celery Beat

**Purpose**: Scheduled task executor (cron-like)

**Features**:
- Periodic task scheduling
- Trial expiry reminders
- Usage limit checks
- Analytics aggregation

**Schedule Examples**:
```python
# In backend/config/celery.py
CELERY_BEAT_SCHEDULE = {
    'check-trial-expiry': {
        'task': 'apps.subscriptions.tasks.check_trial_expiry',
        'schedule': crontab(hour=0, minute=0),
    },
    'aggregate-analytics': {
        'task': 'apps.analytics.tasks.aggregate_daily_stats',
        'schedule': crontab(hour=1, minute=0),
    },
}
```

### Flower

**Purpose**: Celery task monitoring UI

**Access**: http://localhost:5555

**Features**:
- Real-time task monitoring
- Worker status and statistics
- Task history and details
- Queue monitoring
- Basic authentication

**Default Credentials**: admin/admin (change in production!)

### PostgreSQL

**Image**: PostgreSQL 15 Alpine

**Features**:
- Persistent data storage
- Health checks
- Automatic backups (via volume)
- UTF-8 encoding

**Configuration**:
- Max connections: 100 (default)
- Shared buffers: Adjust based on available RAM
- Work mem: Adjust for query complexity

**Backup**:
```bash
# Manual backup
docker-compose exec postgres pg_dump -U engagex_user engagex > backup.sql

# Restore
docker-compose exec -T postgres psql -U engagex_user engagex < backup.sql
```

### Redis

**Image**: Redis 7 Alpine

**Purpose**:
- Session storage
- Query result caching
- Celery message broker (DB 1)
- Celery result backend (DB 2)

**Configuration** (`redis/redis.conf`):
- Max memory: 512MB
- Eviction policy: allkeys-lru
- Persistence: AOF + RDB
- Optimized for speed and durability

**Monitoring**:
```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Monitor commands
MONITOR

# Check memory usage
INFO memory

# Check connected clients
CLIENT LIST
```

## Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f celery-worker

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Restart Services

```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
docker-compose restart celery-worker
```

### Stop Services

```bash
# Stop all
docker-compose stop

# Stop specific service
docker-compose stop backend

# Stop and remove containers
docker-compose down

# Stop and remove volumes (DATA LOSS!)
docker-compose down -v
```

### Scale Services

```bash
# Scale Celery workers
docker-compose up -d --scale celery-worker=5

# Scale backend
docker-compose up -d --scale backend=3
```

### Execute Commands

```bash
# Django management commands
docker-compose exec backend python manage.py <command>

# Shell access
docker-compose exec backend bash
docker-compose exec frontend sh

# Database shell
docker-compose exec postgres psql -U engagex_user engagex

# Redis shell
docker-compose exec redis redis-cli
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose build

# Restart services with new images
docker-compose up -d

# Run migrations
docker-compose exec backend python manage.py migrate

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

## Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Manual health checks
curl http://localhost:8001/health  # Backend
curl http://localhost:5000/health  # Frontend
docker-compose exec redis redis-cli ping  # Redis
docker-compose exec postgres pg_isready  # PostgreSQL
```

## Performance Tuning

### Backend (Gunicorn)

Adjust workers based on CPU cores:
```dockerfile
# In backend.Dockerfile
CMD ["gunicorn", "config.wsgi:application", \
     "--workers", "$((2 * $(nproc) + 1))", \
     ...]
```

### Celery Workers

Adjust concurrency based on task type:
```bash
# CPU-bound tasks
CELERY_CONCURRENCY=4

# I/O-bound tasks (email sending)
CELERY_CONCURRENCY=10
```

### PostgreSQL

Add to `docker-compose.yml`:
```yaml
postgres:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

### Redis

Modify `redis/redis.conf`:
```conf
# Increase memory limit
maxmemory 1gb

# Adjust eviction policy
maxmemory-policy allkeys-lru
```

## Security Best Practices

### 1. Change Default Passwords

Update `.env`:
```bash
POSTGRES_PASSWORD=$(openssl rand -base64 32)
FLOWER_PASSWORD=$(openssl rand -base64 16)
```

### 2. Use Secrets Management

For production, use Docker secrets:
```yaml
secrets:
  db_password:
    external: true
  
services:
  backend:
    secrets:
      - db_password
```

### 3. Enable TLS/SSL

Configure Nginx with SSL certificates:
```bash
# Generate self-signed cert (dev only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/key.pem \
  -out ./nginx/ssl/cert.pem
```

### 4. Network Isolation

Services communicate via internal network only. Only expose necessary ports.

## Monitoring & Logging

### Centralized Logging

All services use JSON logging:
```bash
# View structured logs
docker-compose logs --json backend | jq .
```

### Resource Monitoring

```bash
# Container stats
docker stats

# Service-specific stats
docker stats engagex-backend engagex-celery-worker
```

### Prometheus Integration

Add Prometheus node exporter:
```yaml
# In docker-compose.yml
node-exporter:
  image: prom/node-exporter:latest
  ports:
    - "9100:9100"
```

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database not ready - wait for health check
# 2. Missing migrations - run: docker-compose exec backend python manage.py migrate
# 3. Environment variables - check .env file
```

### Celery Worker Not Processing Tasks

```bash
# Check worker logs
docker-compose logs celery-worker

# Verify Redis connection
docker-compose exec celery-worker redis-cli -h redis ping

# Check Flower UI
open http://localhost:5555
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Reduce Celery concurrency
CELERY_CONCURRENCY=2 docker-compose up -d celery-worker

# Reduce Gunicorn workers
# Edit backend.Dockerfile
```

### Database Connection Issues

```bash
# Check database is running
docker-compose ps postgres

# Test connection
docker-compose exec backend python manage.py dbshell

# Check connection pool
docker-compose exec postgres psql -U engagex_user -c "SELECT count(*) FROM pg_stat_activity;"
```

## Production Deployment

### Checklist

- [ ] Set strong passwords for all services
- [ ] Configure SSL/TLS certificates
- [ ] Set DEBUG=False in Django
- [ ] Configure proper ALLOWED_HOSTS
- [ ] Enable HTTPS redirect
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set up monitoring alerts
- [ ] Use Docker secrets for sensitive data
- [ ] Implement rate limiting
- [ ] Configure firewall rules
- [ ] Set up CDN for static assets

### Environment Preparation

```bash
# Copy production environment template
cp .env.example .env.production

# Edit production values
vim .env.production

# Use production env file
docker-compose --env-file .env.production up -d
```

### Zero-Downtime Deployment

```bash
# Build new images
docker-compose build

# Scale up new instances
docker-compose up -d --scale backend=6 --no-recreate

# Wait for health checks
sleep 30

# Scale down old instances
docker-compose up -d --scale backend=3

# Complete migration
docker-compose up -d
```

## Support

For issues or questions:
- Documentation: [docs/deployment.md](../docs/deployment.md)
- GitHub Issues: https://github.com/your-org/engagex/issues
- Email: devops@engagex.com
