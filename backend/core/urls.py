from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, UserViewSet, DomainViewSet,
    ContactGroupViewSet, ContactViewSet, EmailTemplateViewSet,
    CampaignViewSet, AnalyticsEventViewSet, DashboardViewSet
)
from .auth_views import (
    auth_user, dashboard_stats, replit_auth_login, logout_view, get_csrf_token, test_connection,
    oidc_login, oidc_callback
)
from .signup_views import (
    check_email, basic_info, business_info, send_otp, resend_otp, verify_otp, create_account
)

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
    
    # Test endpoint for Django-frontend connection
    path('api/test', test_connection, name='test_connection'),
    
    # Express-compatible OIDC authentication routes  
    path('api/login', oidc_login, name='oidc_login'),
    path('api/callback', oidc_callback, name='oidc_callback'),
    
    # Exact Express API compatibility routes
    path('api/auth/user', auth_user, name='auth_user'),
    path('api/auth/login', replit_auth_login, name='replit_auth_login'),
    path('api/auth/logout', logout_view, name='logout'),
    path('api/auth/csrf', get_csrf_token, name='csrf_token'),
    path('api/dashboard/stats', dashboard_stats, name='dashboard_stats'),
    
    # Signup flow endpoints
    path('api/signup/check-email', check_email, name='signup_check_email'),
    path('api/signup/basic-info', basic_info, name='signup_basic_info'),
    path('api/signup/business-info', business_info, name='signup_business_info'),
    path('api/signup/send-otp', send_otp, name='signup_send_otp'),
    path('api/signup/resend-otp', resend_otp, name='signup_resend_otp'),
    path('api/signup/verify-otp', verify_otp, name='signup_verify_otp'),
    path('api/signup/create-account', create_account, name='signup_create_account'),
    
    # Standard DRF routes
    path('api/', include(router.urls)),
]