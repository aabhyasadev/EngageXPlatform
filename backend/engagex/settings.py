import os
from pathlib import Path
from decouple import config
from django.core.management.utils import get_random_secret_key

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Security settings
SECRET_KEY = config('SECRET_KEY', default=get_random_secret_key())
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1", 
    "0.0.0.0",
    ".replit.dev",
    ".replit.app",
    ".repl.co"
]

# Application definition
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'corsheaders',
    'django_filters',
]

LOCAL_APPS = [
    'core',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # Re-enabled for security
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.SubscriptionAccessMiddleware',
    'core.middleware.FeatureLimitMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'engagex.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'engagex.wsgi.application'

# Database configuration - Connect to existing PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('PGDATABASE', default='neondb'),
        'USER': config('PGUSER', default='neondb_owner'),
        'PASSWORD': config('PGPASSWORD'),
        'HOST': config('PGHOST'),
        'PORT': config('PGPORT', default='5432'),
        'OPTIONS': {
            'sslmode': 'require',
        },
    }
}

# Custom User Model
AUTH_USER_MODEL = 'core.User'

# Authentication backends
AUTHENTICATION_BACKENDS = [
    'core.authentication.ReplitAuthBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'mediafiles'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'core.authentication.SignedHeaderAuthentication',  # Keep for backward compatibility
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': None,  # Disable pagination to match Express
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    # Removed pagination to maintain parity with Express API
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    # Remove throttling for development to avoid Redis dependency
    # 'DEFAULT_THROTTLE_CLASSES': [
    #     'rest_framework.throttling.AnonRateThrottle',
    #     'rest_framework.throttling.UserRateThrottle'
    # ],
    # 'DEFAULT_THROTTLE_RATES': {
    #     'anon': '100/hour',
    #     'user': '1000/hour'
    # }
}

# CORS settings - Allow frontend to access backend
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000", 
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]

# Use regex patterns for wildcard domains (wildcards don't work in CORS_ALLOWED_ORIGINS)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.replit\.dev$",
    r"^https://.*\.replit\.app$",
]

CORS_ALLOW_ALL_ORIGINS = False  # Production security
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Session configuration
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 86400  # 24 hours
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# CSRF settings - Disable CSRF for API endpoints to match Express behavior
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]

# Disable CSRF for API endpoints since Express didn't use CSRF protection
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_HEADER_name = 'HTTP_X_CSRFTOKEN'

# Authentication bridge configuration
# Auth bridge secret - required for Express-Django integration
AUTH_BRIDGE_SECRET = config('SESSION_SECRET', default=None)
if not AUTH_BRIDGE_SECRET:
    if DEBUG:
        # In development, provide clear warning but allow startup
        print("WARNING: SESSION_SECRET not set - Django auth bridge disabled in development")
        print("Set SESSION_SECRET environment variable for full Express-Django integration")
        AUTH_BRIDGE_SECRET = 'development-only-secret-do-not-use-in-production'
    else:
        raise ValueError("SESSION_SECRET is required for Express-Django auth bridge in production")

# Redis configuration
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')

# Cache configuration - Use dummy cache instead of Redis for development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# Celery Configuration
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Celery Beat Schedule for periodic tasks
CELERY_BEAT_SCHEDULE = {
    'verify-domains': {
        'task': 'core.tasks.verify_domains_task',
        'schedule': 300.0,  # Every 5 minutes
    },
    'process-analytics': {
        'task': 'core.tasks.process_analytics_task',
        'schedule': 600.0,  # Every 10 minutes
    },
}

# Email settings (SMTP)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = f'EngageX <{EMAIL_HOST_USER}>' if EMAIL_HOST_USER else 'EngageX <noreply@example.com>'

# Stripe settings - Use testing keys in development, production keys in production
STRIPE_SECRET_KEY = config('TESTING_STRIPE_SECRET_KEY' if DEBUG else 'STRIPE_SECRET_KEY', default='')
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')

# Ensure Stripe keys are available
if not STRIPE_SECRET_KEY:
    if DEBUG:
        print("WARNING: TESTING_STRIPE_SECRET_KEY not set - Stripe integration disabled in development")
    else:
        raise ValueError("STRIPE_SECRET_KEY is required for production")

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple'
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': config('DJANGO_LOG_LEVEL', default='INFO'),
            'propagate': False,
        },
        'core': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# Security settings for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
# Only force SSL in production to prevent development breakage
SECURE_SSL_REDIRECT = config('ENABLE_SSL_REDIRECT', default=not DEBUG, cast=bool)
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0  # 1 year in production only
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Session cookies for cross-origin authentication (frontend to Django API)  
SESSION_COOKIE_SECURE = True  # Required for SameSite=None
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'None'  # Allow cross-origin session sharing
SESSION_COOKIE_HTTPONLY = True  # Security - prevent XSS access
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'

# Development settings
# Removed DEBUG override to maintain security restrictions in all modes