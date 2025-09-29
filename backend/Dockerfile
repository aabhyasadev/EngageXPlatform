# Use Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=engagex.settings

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
        libpq-dev \
        netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Create requirements.txt with all dependencies
RUN echo "django>=4.2,<5.0" > requirements.txt && \
    echo "djangorestframework>=3.14" >> requirements.txt && \
    echo "django-cors-headers>=4.0" >> requirements.txt && \
    echo "django-filter>=23.0" >> requirements.txt && \
    echo "django-redis>=5.3" >> requirements.txt && \
    echo "whitenoise>=6.5" >> requirements.txt && \
    echo "gunicorn>=21.0" >> requirements.txt && \
    echo "psycopg2-binary>=2.9" >> requirements.txt && \
    echo "python-decouple>=3.8" >> requirements.txt && \
    echo "python-dotenv>=1.0" >> requirements.txt && \
    echo "redis>=4.6" >> requirements.txt && \
    echo "requests>=2.31" >> requirements.txt && \
    echo "sendgrid>=6.10" >> requirements.txt && \
    echo "stripe>=5.5" >> requirements.txt && \
    echo "celery>=5.3" >> requirements.txt && \
    echo "openpyxl>=3.1" >> requirements.txt && \
    echo "dnspython>=2.4" >> requirements.txt && \
    echo "schedule>=1.2"

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create logs directory
RUN mkdir -p logs

# Collect static files
RUN python manage.py collectstatic --noinput

# Create a non-root user
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=10)"

# Default command
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "engagex.wsgi:application"]