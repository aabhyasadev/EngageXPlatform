FROM python:3.11-slim

LABEL maintainer="EngageX Team <ops@engagex.com>"
LABEL description="EngageX Django Backend API"

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 -s /bin/bash appuser

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements/base.txt requirements/base.txt
COPY backend/requirements/prod.txt requirements/prod.txt

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements/prod.txt

# Copy application code
COPY backend/ .

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /app/logs && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Collect static files
RUN python manage.py collectstatic --noinput --clear

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Expose port
EXPOSE 8001

# Run gunicorn
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8001", \
     "--workers", "4", \
     "--threads", "2", \
     "--worker-class", "gthread", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
