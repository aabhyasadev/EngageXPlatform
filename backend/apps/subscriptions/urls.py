from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CardViewSet
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

router = DefaultRouter()
router.register(r'cards', CardViewSet)

urlpatterns = [
    # Subscription management endpoints
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
    
    # Router for viewsets
    path('', include(router.urls)),
]
