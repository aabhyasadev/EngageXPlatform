from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    """Health check endpoint for Django startup verification"""
    print("Django health check endpoint hit - server is responsive")
    return JsonResponse({"status": "healthy", "service": "django"})

urlpatterns = [
    # Health check for startup verification
    path('health', health_check, name='health_check'),
    
    # Include all app URLs
    path('', include('apps.accounts.urls')),
    path('', include('apps.authentication.urls')),
    path('', include('apps.subscriptions.urls')),
    path('', include('apps.domains.urls')),
    path('', include('apps.contacts.urls')),
    path('', include('apps.templates.urls')),
    path('', include('apps.campaigns.urls')),
    path('', include('apps.analytics.urls')),
]
