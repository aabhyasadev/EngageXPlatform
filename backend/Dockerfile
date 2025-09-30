FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
        libpq-dev \
        netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt requirements/base.txt
COPY requirements/production.txt requirements/production.txt

RUN pip install --no-cache-dir -r requirements/production.txt

COPY . .

RUN mkdir -p logs

RUN python manage.py collectstatic --noinput

RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8001/health', timeout=10)"

CMD ["gunicorn", "--bind", "0.0.0.0:8001", "--workers", "4", "--threads", "2", "config.wsgi:application"]
