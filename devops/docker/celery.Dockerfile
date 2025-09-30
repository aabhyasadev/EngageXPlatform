FROM python:3.11-slim

LABEL maintainer="EngageX Team <ops@engagex.com>"
LABEL description="EngageX Celery Worker for Background Tasks"

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    C_FORCE_ROOT=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 -s /bin/bash celeryuser

# Set working directory
WORKDIR /app

# Copy requirements
COPY backend/requirements/base.txt requirements/base.txt
COPY backend/requirements/prod.txt requirements/prod.txt

# Install Python dependencies including Celery
RUN pip install --upgrade pip && \
    pip install -r requirements/prod.txt && \
    pip install celery[redis]==5.3.4 flower==2.0.1

# Copy application code
COPY backend/ .

# Copy worker script
COPY devops/celery/worker.sh /usr/local/bin/worker.sh
RUN chmod +x /usr/local/bin/worker.sh

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R celeryuser:celeryuser /app

# Switch to non-root user
USER celeryuser

# Health check - check if worker is responding
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
    CMD celery -A config inspect ping -d celery@$HOSTNAME || exit 1

# Default command
CMD ["/usr/local/bin/worker.sh"]
