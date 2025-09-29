from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, UserViewSet, DomainViewSet,
    ContactGroupViewSet, ContactViewSet, EmailTemplateViewSet,
    CampaignViewSet, AnalyticsEventViewSet, DashboardViewSet,
    CardViewSet, InvitationViewSet
)
from .auth_views import (
    auth_user, dashboard_stats, logout_view, get_csrf_token, test_connection
)
from .signup_views import (
    check_email, basic_info, business_info, send_otp, resend_otp, verify_otp, create_account
)
from .signin_views import (
    validate_organization_email,
    authenticate_credentials, 
    verify_mfa_otp_sso,
    forgot_account,
    logout_user
)
from .subscription_views import (
    get_subscription_plans,
    get_plans_detailed,
    get_current_subscription,
    get_billing_history,
    create_checkout_session,
    manage_subscription,
    create_billing_portal_session,
    create_subscription,
    cancel_subscription,
    stripe_webhook,
    check_subscription_access,
    get_notifications,
    mark_notification_read,
    update_notification_preferences,
    get_notification_preferences
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
router.register(r'cards', CardViewSet)
router.register(r'invitations', InvitationViewSet)

urlpatterns = [
    # Health check for startup verification
    path('health', health_check, name='health_check'),
    
    # Test endpoint for Django-frontend connection
    path('api/test', test_connection, name='test_connection'),
    
    # Replit OIDC authentication routes removed
    
    # Express proxy routes (proxy strips /api prefix, so Django receives without /api)
    path('auth/user', auth_user, name='auth_user'),
    # Replit auth login route removed
    path('auth/logout', logout_view, name='logout'),
    path('auth/csrf', get_csrf_token, name='csrf_token'),
    path('dashboard/stats', dashboard_stats, name='dashboard_stats'),
    
    # Domain routes handled by router.register(r'domains', DomainViewSet)
    
    # Signup flow endpoints (proxy strips /api prefix)
    path('signup/check-email', check_email, name='signup_check_email'),
    path('signup/basic-info', basic_info, name='signup_basic_info'),
    path('signup/business-info', business_info, name='signup_business_info'),
    path('signup/send-otp', send_otp, name='signup_send_otp'),
    path('signup/resend-otp', resend_otp, name='signup_resend_otp'),
    path('signup/verify-otp', verify_otp, name='signup_verify_otp'),
    path('signup/create-account', create_account, name='signup_create_account'),
    
    # New sign-in flow endpoints (proxy strips /api prefix)
    path('signin/validate-org-email/', validate_organization_email, name='signin_validate_org_email'),
    path('signin/authenticate/', authenticate_credentials, name='signin_authenticate'),
    path('signin/verify/', verify_mfa_otp_sso, name='signin_verify'),
    path('signin/forgot-account/', forgot_account, name='signin_forgot_account'),
    path('signin/logout/', logout_user, name='signin_logout'),
    
    # Subscription management endpoints (proxy strips /api prefix)
    path('subscription/plans', get_subscription_plans, name='subscription_plans'),
    path('subscription/plans-detailed', get_plans_detailed, name='plans_detailed'),
    path('subscription/current', get_current_subscription, name='current_subscription'),
    path('subscription/billing-history', get_billing_history, name='billing_history'),
    path('subscription/create-checkout-session', create_checkout_session, name='create_checkout_session'),
    path('subscription/manage', manage_subscription, name='manage_subscription'),
    path('subscription/billing-portal', create_billing_portal_session, name='create_billing_portal'),
    path('subscription/create', create_subscription, name='create_subscription'),
    path('subscription/cancel', cancel_subscription, name='cancel_subscription'),
    path('subscription/check-access', check_subscription_access, name='check_subscription_access'),
    path('subscription/webhook', stripe_webhook, name='stripe_webhook'),
    
    # Notification endpoints
    path('subscription/notifications', get_notifications, name='get_notifications'),
    path('subscription/mark-notification-read', mark_notification_read, name='mark_notification_read'),
    path('subscription/notification-preferences', update_notification_preferences, name='update_notification_preferences'),
    path('subscription/get-notification-preferences', get_notification_preferences, name='get_notification_preferences'),
    
    # Standard DRF routes (Express proxy strips /api prefix)
    path('', include(router.urls)),
]