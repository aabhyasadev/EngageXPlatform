from .base import *

# Production-specific settings
DEBUG = False

# Email backend - SMTP for production
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Cache configuration - Use Redis for production
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# Celery - Normal async execution in production
# CELERY_TASK_ALWAYS_EAGER is not set, so tasks run asynchronously

# Static files storage - Compressed for production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Session cookies - Production security settings
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'None'

# CSRF settings - Production
CSRF_COOKIE_SECURE = True

# Security settings - Enabled for production
SECURE_SSL_REDIRECT = config('ENABLE_SSL_REDIRECT', default=True, cast=bool)
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# Auth bridge secret - Required in production
if not AUTH_BRIDGE_SECRET:
    raise ValueError("SESSION_SECRET is required for Express-Django auth bridge in production")

# Stripe keys - Production keys required
if not STRIPE_SECRET_KEY:
    raise ValueError("STRIPE_SECRET_KEY is required for production")
