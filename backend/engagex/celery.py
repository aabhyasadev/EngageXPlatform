import os
from celery import Celery
from celery.schedules import crontab
from django.conf import settings

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'engagex.settings')

app = Celery('engagex')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

# Configure periodic tasks
app.conf.beat_schedule = {
    'check-trial-expirations': {
        'task': 'core.tasks.check_trial_expirations',
        'schedule': crontab(hour=9, minute=0),  # Run daily at 9 AM
        'options': {
            'expires': 3600,  # Expire after 1 hour if not executed
        }
    },
    'check-subscription-expirations': {
        'task': 'core.tasks.check_subscription_expirations',
        'schedule': crontab(hour=9, minute=0),  # Run daily at 9 AM
        'options': {
            'expires': 3600,
        }
    },
    'send-usage-limit-warnings': {
        'task': 'core.tasks.send_usage_limit_warnings',
        'schedule': crontab(hour='*/6'),  # Run every 6 hours
        'options': {
            'expires': 3600,
        }
    },
    'verify-domains': {
        'task': 'core.tasks.verify_domains_task',
        'schedule': crontab(minute='*/30'),  # Run every 30 minutes
        'options': {
            'expires': 900,
        }
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')