FROM python:3.11-slim

# Environment setup
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

# Install dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
        libpq-dev \
        netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Copy requirement files from backend directory
COPY backend/requirements/base.txt requirements/base.txt
COPY backend/requirements/prod.txt requirements/production.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements/production.txt

# Copy backend project files
COPY backend/ .

# Create dummy .env for safe build (collectstatic skipped now)
RUN echo "DEBUG=False\nSECRET_KEY=dummy\nALLOWED_HOSTS=*" > .env

# Make logs directory
RUN mkdir -p logs

# ⚠️ Skip collectstatic during build to avoid missing DB env vars
# RUN python manage.py collectstatic --noinput

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose Django port
EXPOSE 8001

# Healthcheck for container
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8001/health', timeout=10)"

# Run app (env vars loaded at runtime)
CMD ["gunicorn", "--bind", "0.0.0.0:8001", "--workers", "4", "--threads", "2", "config.wsgi:application"]
