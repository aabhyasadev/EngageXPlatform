from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, UserViewSet, DomainViewSet,
    ContactGroupViewSet, ContactViewSet, EmailTemplateViewSet,
    CampaignViewSet, AnalyticsEventViewSet, DashboardViewSet
)
from .auth_views import auth_user, dashboard_stats

def health_check(request):
    """Health check endpoint for Django startup verification"""
    print("Django health check endpoint hit - server is responsive")
    return JsonResponse({"status": "healthy", "service": "django"})

# API routes that match Express backend exactly
router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'users', UserViewSet)
router.register(r'domains', DomainViewSet)
router.register(r'contact-groups', ContactGroupViewSet)
router.register(r'contacts', ContactViewSet)
router.register(r'templates', EmailTemplateViewSet)
router.register(r'campaigns', CampaignViewSet)
router.register(r'analytics/events', AnalyticsEventViewSet)

urlpatterns = [
    # Health check for startup verification
    path('health', health_check, name='health_check'),
    
    # Exact Express API compatibility routes
    path('api/auth/user', auth_user, name='auth_user'),
    path('api/dashboard/stats', dashboard_stats, name='dashboard_stats'),
    
    # Standard DRF routes
    path('api/', include(router.urls)),
]