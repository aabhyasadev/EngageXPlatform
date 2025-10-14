from .base import *

# Development-specific settings
DEBUG = True

# Email backend - Console for development
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Cache configuration - Use dummy cache for development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# Celery - Execute tasks synchronously in development
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Static files storage - Default for development
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Session cookies - Development-friendly settings
SESSION_COOKIE_SECURE = False
SESSION_COOKIE_SAMESITE = 'Lax'

# CSRF settings - Development
CSRF_COOKIE_SECURE = False

# Security settings - Disabled for development
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False

# Auth bridge secret handling for development
if not AUTH_BRIDGE_SECRET:
    print("WARNING: SESSION_SECRET not set - Django auth bridge disabled in development")
    print("Set SESSION_SECRET environment variable for full Express-Django integration")
    AUTH_BRIDGE_SECRET = 'development-only-secret-do-not-use-in-production'

# Stripe keys - Use testing keys in development
STRIPE_SECRET_KEY = config('TESTING_STRIPE_SECRET_KEY', default='')

if not STRIPE_SECRET_KEY:
    print("WARNING: TESTING_STRIPE_SECRET_KEY not set - Stripe integration disabled in development")

# Ensure Stripe keys are available
if not STRIPE_SECRET_KEY:
    print("WARNING: TESTING_STRIPE_SECRET_KEY not set - Stripe integration disabled in development")
