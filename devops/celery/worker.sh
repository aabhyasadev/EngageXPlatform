#!/bin/bash
set -e

echo "Starting Celery Worker for EngageX..."

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
until redis-cli -h redis ping 2>&1 | grep -q PONG; do
    echo "Redis is unavailable - sleeping"
    sleep 2
done
echo "Redis is up - continuing..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
until pg_isready -h $PGHOST -p $PGPORT -U $PGUSER; do
    echo "Database is unavailable - sleeping"
    sleep 2
done
echo "Database is up - continuing..."

# Celery worker configuration
CELERY_APP="config"
WORKER_NAME="worker"
CONCURRENCY=${CELERY_CONCURRENCY:-4}
LOG_LEVEL=${CELERY_LOG_LEVEL:-info}
MAX_TASKS_PER_CHILD=${CELERY_MAX_TASKS_PER_CHILD:-1000}
MAX_MEMORY_PER_CHILD=${CELERY_MAX_MEMORY_PER_CHILD:-200000}

# Queues to listen to
QUEUES=${CELERY_QUEUES:-"celery,email,high_priority,low_priority"}

echo "Starting Celery worker with the following configuration:"
echo "  App: $CELERY_APP"
echo "  Worker Name: $WORKER_NAME@%h"
echo "  Concurrency: $CONCURRENCY"
echo "  Log Level: $LOG_LEVEL"
echo "  Queues: $QUEUES"
echo "  Max Tasks Per Child: $MAX_TASKS_PER_CHILD"
echo "  Max Memory Per Child: ${MAX_MEMORY_PER_CHILD}KB"

# Start Celery worker
exec celery -A $CELERY_APP worker \
    --loglevel=$LOG_LEVEL \
    --concurrency=$CONCURRENCY \
    --hostname=$WORKER_NAME@%h \
    --queues=$QUEUES \
    --max-tasks-per-child=$MAX_TASKS_PER_CHILD \
    --max-memory-per-child=$MAX_MEMORY_PER_CHILD \
    --time-limit=3600 \
    --soft-time-limit=3300 \
    --without-gossip \
    --without-mingle \
    --without-heartbeat
