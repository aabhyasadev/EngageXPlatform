.PHONY: help install migrate test run shell check format lint clean docker-build docker-run

help:
	@echo "EngageX Backend - Available Commands:"
	@echo "  make install        Install dependencies"
	@echo "  make migrate        Run database migrations"
	@echo "  make test          Run tests"
	@echo "  make run           Start development server"
	@echo "  make shell         Open Django shell"
	@echo "  make check         Run Django system checks"
	@echo "  make format        Format code with black"
	@echo "  make lint          Run linting checks"
	@echo "  make clean         Clean up cache files"
	@echo "  make docker-build  Build Docker image"
	@echo "  make docker-run    Run in Docker container"

install:
	pip install -r requirements/development.txt

migrate:
	python manage.py migrate

makemigrations:
	python manage.py makemigrations

test:
	python manage.py test

run:
	python manage.py runserver 0.0.0.0:8001

shell:
	python manage.py shell

check:
	python manage.py check
	python manage.py makemigrations --check --dry-run

format:
	black apps/ config/
	isort apps/ config/

lint:
	flake8 apps/ config/
	pylint apps/ config/

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.coverage" -delete
	rm -rf .pytest_cache htmlcov .coverage

createsuperuser:
	python manage.py createsuperuser

collectstatic:
	python manage.py collectstatic --noinput

docker-build:
	docker build -t engagex-backend .

docker-run:
	docker run -p 8001:8001 --env-file .envs/.env.production engagex-backend

scheduler:
	python manage.py start_scheduler

dump-db:
	python manage.py dumpdata --indent 2 -o demo.json

load-db:
	python manage.py loaddata demo.json
