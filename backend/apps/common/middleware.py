import hmac
import json
import logging
import hashlib
from functools import wraps
from datetime import datetime
from django.db.models import F
from django.conf import settings
from django.utils import timezone
from django.http import JsonResponse
from apps.accounts.models import User
from django.contrib.auth.models import AnonymousUser
from django.utils.deprecation import MiddlewareMixin
from apps.subscriptions.models import SubscriptionPlan, PlanFeatures, UsageTracking, SubscriptionStatus

logger = logging.getLogger(__name__)


class ExpressSessionBridgeMiddleware(MiddlewareMixin):
    """
    Middleware to bridge Express sessions to Django authentication
    """
    
    def process_request(self, request):
        """
        Extract user information from Express session data and set Django user
        """
        # Check for signed user header from Express proxy
        user_header = request.META.get('HTTP_X_REPLIT_USER')
        signature_header = request.META.get('HTTP_X_REPLIT_USER_SIGNATURE')
        
        if not user_header or not signature_header:
            request.user = AnonymousUser()
            return None
            
        # Verify signature
        if not self._verify_signature(user_header, signature_header):
            logger.warning("Invalid signature for user header")
            request.user = AnonymousUser()
            return None
            
        try:
            # Parse user data from header
            user_data = json.loads(user_header)
            user_id = user_data.get('sub')
            email = user_data.get('email')
            
            if not user_id or not email:
                request.user = AnonymousUser()
                return None
            
            # Get or create Django user
            try:
                user = User.objects.get(replit_user_id=user_id)
            except User.DoesNotExist:
                # Create new user
                user = User.objects.create(
                    replit_user_id=user_id,
                    email=email,
                    first_name=user_data.get('first_name', ''),
                    last_name=user_data.get('last_name', ''),
                    profile_image_url=user_data.get('profile_image_url', '')
                )
                logger.info(f"Created new user for Replit ID: {user_id}")
            
            # Set the user on the request
            request.user = user
            
        except (json.JSONDecodeError, KeyError, Exception) as e:
            logger.error(f"Error processing user header: {e}")
            request.user = AnonymousUser()
            
        return None
    
    def _verify_signature(self, data, signature):
        """Verify HMAC signature for user data"""
        # Use AUTH_BRIDGE_SECRET which is derived from SESSION_SECRET env var
        if not hasattr(settings, 'AUTH_BRIDGE_SECRET') or not settings.AUTH_BRIDGE_SECRET:
            logger.error("AUTH_BRIDGE_SECRET not configured")
            return False
            
        expected_signature = hmac.new(
            settings.AUTH_BRIDGE_SECRET.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)


class SubscriptionAccessMiddleware(MiddlewareMixin):
    """
    Comprehensive middleware to check subscription access and enforce limits
    """
    
    # Endpoints that require active subscription
    PROTECTED_ENDPOINTS = [
        '/api/campaigns/',
        '/api/contacts/',
        '/api/templates/',
        '/api/analytics/',
        '/api/domains/',
        '/api/ab-tests/',
    ]
    
    # Endpoints that are always allowed (even without subscription)
    ALLOWED_ENDPOINTS = [
        '/api/auth/',
        '/api/subscription/',
        '/api/signup/',
        '/api/signin/',
        '/api/organization/',
        '/health',
        '/api/test',
        '/admin/',
        '/static/',
    ]
    
    # Feature-specific endpoints
    FEATURE_ENDPOINTS = {
        'has_advanced_analytics': ['/api/analytics/advanced/', '/api/analytics/reports/'],
        'has_ab_testing': ['/api/ab-tests/', '/api/campaigns/ab-test/'],
        'has_api_access': ['/api/v1/', '/api/webhook/'],
        'has_automation': ['/api/automation/', '/api/workflows/'],
        'has_white_labeling': ['/api/white-label/', '/api/branding/'],
        'has_custom_templates': ['/api/templates/custom/', '/api/templates/import/'],
    }

    def process_request(self, request):
        """Check subscription access before processing request"""
        
        # Skip non-API requests
        if not request.path.startswith('/api/'):
            return None
            
        # Check if endpoint is always allowed
        for allowed_path in self.ALLOWED_ENDPOINTS:
            if request.path.startswith(allowed_path):
                return None
        
        # Check if user is authenticated
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            # Allow OPTIONS requests for CORS
            if request.method == 'OPTIONS':
                return None
            return JsonResponse({
                'error': 'Authentication required',
                'code': 'AUTH_REQUIRED'
            }, status=401)
        
        # Check if user has organization
        if not request.user.organization:
            return JsonResponse({
                'error': 'No organization found. Please complete organization setup.',
                'code': 'NO_ORGANIZATION',
                'redirect': '/onboarding/organization'
            }, status=403)
        
        org = request.user.organization
        
        # Add organization and subscription info to request for later use
        request.organization = org
        request.subscription_status = self._get_subscription_status(org)
        request.usage_tracking = self._get_current_usage(org)
        
        # Check if endpoint requires subscription
        is_protected = any(
            request.path.startswith(protected_path) 
            for protected_path in self.PROTECTED_ENDPOINTS
        )
        
        if not is_protected:
            return None
        
        # Check subscription status
        if request.subscription_status['is_expired']:
            return JsonResponse({
                'error': 'Your subscription has expired. Please upgrade to continue.',
                'code': 'SUBSCRIPTION_EXPIRED',
                'subscription_status': request.subscription_status,
                'upgrade_url': '/subscription/plans'
            }, status=402)  # Payment Required
        
        if request.subscription_status['status'] == SubscriptionStatus.PAST_DUE:
            return JsonResponse({
                'error': 'Your subscription payment is past due. Please update your payment method.',
                'code': 'PAYMENT_PAST_DUE',
                'subscription_status': request.subscription_status,
                'payment_url': '/subscription/payment'
            }, status=402)
        
        if request.subscription_status['status'] == SubscriptionStatus.CANCELED:
            return JsonResponse({
                'error': 'Your subscription has been canceled. Please reactivate to continue.',
                'code': 'SUBSCRIPTION_CANCELED',
                'subscription_status': request.subscription_status,
                'reactivate_url': '/subscription/reactivate'
            }, status=402)
        
        # Check feature-specific endpoints
        for feature, endpoints in self.FEATURE_ENDPOINTS.items():
            for endpoint in endpoints:
                if request.path.startswith(endpoint):
                    if not self._check_feature_available(org, feature):
                        return JsonResponse({
                            'error': f'This feature requires a higher subscription plan.',
                            'code': 'FEATURE_NOT_AVAILABLE',
                            'feature': feature,
                            'current_plan': org.subscription_plan,
                            'required_plans': self._get_plans_with_feature(feature),
                            'upgrade_url': '/subscription/upgrade'
                        }, status=403)
        
        # Check usage limits for write operations
        if request.method in ['POST', 'PUT', 'PATCH']:
            limit_check = self._check_usage_limits(request, org)
            if limit_check:
                return limit_check
        
        return None
    
    def _get_subscription_status(self, organization):
        """Get comprehensive subscription status"""
        now = timezone.now()
        
        # Check if trial or subscription expired
        is_expired = False
        days_remaining = None
        
        if organization.subscription_plan == SubscriptionPlan.FREE_TRIAL:
            if organization.trial_ends_at:
                is_expired = now > organization.trial_ends_at
                if not is_expired:
                    days_remaining = (organization.trial_ends_at - now).days
        else:
            if organization.subscription_ends_at:
                is_expired = now > organization.subscription_ends_at
                if not is_expired:
                    days_remaining = (organization.subscription_ends_at - now).days
        
        # Get plan features
        try:
            plan_features = PlanFeatures.objects.get(plan=organization.subscription_plan)
            features = {
                'contacts_limit': plan_features.contacts_limit,
                'campaigns_limit': plan_features.campaigns_limit,
                'emails_per_month': plan_features.emails_per_month,
                'has_advanced_analytics': plan_features.has_advanced_analytics,
                'has_ab_testing': plan_features.has_ab_testing,
                'has_api_access': plan_features.has_api_access,
                'has_automation': plan_features.has_automation,
                'has_white_labeling': plan_features.has_white_labeling,
                'has_custom_templates': plan_features.has_custom_templates,
            }
        except PlanFeatures.DoesNotExist:
            # Use organization's default limits
            features = {
                'contacts_limit': organization.contacts_limit,
                'campaigns_limit': organization.campaigns_limit,
                'emails_per_month': organization.emails_per_month_limit,
                'has_advanced_analytics': False,
                'has_ab_testing': False,
                'has_api_access': False,
                'has_automation': False,
                'has_white_labeling': False,
                'has_custom_templates': False,
            }
        
        return {
            'plan': organization.subscription_plan,
            'status': organization.subscription_status,
            'is_expired': is_expired,
            'is_active': organization.is_subscription_active and not is_expired,
            'is_trial': organization.subscription_plan == SubscriptionPlan.FREE_TRIAL,
            'days_remaining': days_remaining,
            'trial_ends_at': organization.trial_ends_at,
            'subscription_ends_at': organization.subscription_ends_at,
            'features': features
        }
    
    def _get_current_usage(self, organization):
        """Get current month's usage for organization"""
        now = timezone.now()
        month_start = datetime(now.year, now.month, 1).date()
        
        # Get or create usage tracking for current month
        usage, created = UsageTracking.objects.get_or_create(
            organization=organization,
            month=month_start,
            defaults={
                'emails_sent': 0,
                'campaigns_created': 0,
                'contacts_imported': 0,
                'templates_created': 0,
                'domains_verified': 0,
                'api_calls': 0,
                'ab_tests_created': 0,
            }
        )
        
        # Also get current counts from database
        current_counts = {
            'total_contacts': organization.contacts.count(),
            'total_campaigns': organization.campaigns.count(),
            'total_templates': organization.email_templates.count(),
            'total_domains': organization.domains.count(),
        }
        
        return {
            'month': month_start.isoformat(),
            'emails_sent': usage.emails_sent,
            'campaigns_created': usage.campaigns_created,
            'contacts_imported': usage.contacts_imported,
            'templates_created': usage.templates_created,
            'domains_verified': usage.domains_verified,
            'api_calls': usage.api_calls,
            'ab_tests_created': usage.ab_tests_created,
            **current_counts
        }
    
    def _check_feature_available(self, organization, feature):
        """Check if a specific feature is available for the organization's plan"""
        try:
            plan_features = PlanFeatures.objects.get(plan=organization.subscription_plan)
            return getattr(plan_features, feature, False)
        except PlanFeatures.DoesNotExist:
            # Default to basic features only
            return feature in ['has_email_campaigns', 'has_basic_analytics']
    
    def _get_plans_with_feature(self, feature):
        """Get list of plans that have a specific feature"""
        plans = PlanFeatures.objects.filter(**{feature: True}).values_list('plan', flat=True)
        return list(plans)
    
    def _check_usage_limits(self, request, organization):
        """Check if usage limits are exceeded for write operations"""
        path = request.path
        usage = request.usage_tracking
        features = request.subscription_status['features']
        
        # Check campaign limits
        if '/api/campaigns/' in path and request.method == 'POST':
            if usage['total_campaigns'] >= features['campaigns_limit']:
                return JsonResponse({
                    'error': f'Campaign limit reached. You have {usage["total_campaigns"]} of {features["campaigns_limit"]} campaigns.',
                    'code': 'CAMPAIGN_LIMIT_REACHED',
                    'current_count': usage['total_campaigns'],
                    'limit': features['campaigns_limit'],
                    'upgrade_url': '/subscription/upgrade'
                }, status=403)
            
            # Update usage tracking
            UsageTracking.objects.filter(
                organization=organization,
                month=usage['month']
            ).update(campaigns_created=F('campaigns_created') + 1)
        
        # Check contact limits
        elif '/api/contacts/' in path and request.method in ['POST', 'PUT']:
            if 'import' in path:
                # For import, check if total would exceed limit (estimated)
                if usage['total_contacts'] >= features['contacts_limit']:
                    return JsonResponse({
                        'error': f'Contact limit reached. You have {usage["total_contacts"]} of {features["contacts_limit"]} contacts.',
                        'code': 'CONTACT_LIMIT_REACHED',
                        'current_count': usage['total_contacts'],
                        'limit': features['contacts_limit'],
                        'upgrade_url': '/subscription/upgrade'
                    }, status=403)
        
        # Check email send limits
        elif '/api/campaigns/send' in path or '/api/emails/send' in path:
            if usage['emails_sent'] >= features['emails_per_month']:
                return JsonResponse({
                    'error': f'Monthly email limit reached. You have sent {usage["emails_sent"]} of {features["emails_per_month"]} emails this month.',
                    'code': 'EMAIL_LIMIT_REACHED',
                    'current_count': usage['emails_sent'],
                    'limit': features['emails_per_month'],
                    'upgrade_url': '/subscription/upgrade'
                }, status=403)
        
        # Check template limits (Premium plans have unlimited custom templates)
        elif '/api/templates/' in path and request.method == 'POST':
            if not features.get('has_custom_templates', False):
                # Basic plans have limited templates (e.g., 10)
                template_limit = 10 if 'basic' in organization.subscription_plan.lower() else 50
                if usage['total_templates'] >= template_limit:
                    return JsonResponse({
                        'error': f'Template limit reached. You have {usage["total_templates"]} of {template_limit} templates.',
                        'code': 'TEMPLATE_LIMIT_REACHED',
                        'current_count': usage['total_templates'],
                        'limit': template_limit,
                        'upgrade_url': '/subscription/upgrade'
                    }, status=403)
        
        # Check A/B test creation
        elif '/api/ab-tests/' in path and request.method == 'POST':
            if not features.get('has_ab_testing', False):
                return JsonResponse({
                    'error': 'A/B testing is not available in your current plan.',
                    'code': 'FEATURE_NOT_AVAILABLE',
                    'feature': 'has_ab_testing',
                    'current_plan': organization.subscription_plan,
                    'upgrade_url': '/subscription/upgrade'
                }, status=403)
            
            # Update usage tracking
            UsageTracking.objects.filter(
                organization=organization,
                month=usage['month']
            ).update(ab_tests_created=F('ab_tests_created') + 1)
        
        # Track API calls for plans with API access
        if '/api/v1/' in path and features.get('has_api_access', False):
            UsageTracking.objects.filter(
                organization=organization,
                month=usage['month']
            ).update(api_calls=F('api_calls') + 1)
        
        return None


class FeatureLimitMiddleware(MiddlewareMixin):
    """
    Middleware to enforce feature limits based on subscription plan
    Note: Most functionality has been moved to SubscriptionAccessMiddleware for better integration
    """
    
    def process_request(self, request):
        """
        This middleware is kept for backward compatibility but most logic 
        is now handled by SubscriptionAccessMiddleware
        """
        # Skip if already processed by SubscriptionAccessMiddleware
        if hasattr(request, 'subscription_status'):
            return None
        
        # Only process API requests
        if not request.path.startswith('/api/'):
            return None
        
        return None


# Decorators for view-level access control
def requires_active_subscription(view_func):
    """Decorator to require active subscription for a view"""
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return JsonResponse({
                'error': 'Authentication required',
                'code': 'AUTH_REQUIRED'
            }, status=401)
        
        if not request.user.organization:
            return JsonResponse({
                'error': 'No organization found',
                'code': 'NO_ORGANIZATION'
            }, status=403)
        
        org = request.user.organization
        now = timezone.now()
        
        # Check if subscription is active
        is_expired = False
        if org.subscription_plan == SubscriptionPlan.FREE_TRIAL:
            is_expired = org.trial_ends_at and now > org.trial_ends_at
        else:
            is_expired = org.subscription_ends_at and now > org.subscription_ends_at
        
        if is_expired or not org.is_subscription_active:
            return JsonResponse({
                'error': 'Active subscription required',
                'code': 'SUBSCRIPTION_REQUIRED',
                'upgrade_url': '/subscription/plans'
            }, status=402)
        
        return view_func(request, *args, **kwargs)
    return wrapped_view


def requires_plan_feature(feature_name):
    """Decorator to require specific plan feature for a view"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not hasattr(request, 'user') or not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required',
                    'code': 'AUTH_REQUIRED'
                }, status=401)
            
            if not request.user.organization:
                return JsonResponse({
                    'error': 'No organization found',
                    'code': 'NO_ORGANIZATION'
                }, status=403)
            
            org = request.user.organization
            
            # Check if feature is available
            try:
                plan_features = PlanFeatures.objects.get(plan=org.subscription_plan)
                has_feature = getattr(plan_features, feature_name, False)
            except PlanFeatures.DoesNotExist:
                has_feature = False
            
            if not has_feature:
                return JsonResponse({
                    'error': f'This feature ({feature_name}) requires a higher subscription plan',
                    'code': 'FEATURE_NOT_AVAILABLE',
                    'feature': feature_name,
                    'current_plan': org.subscription_plan,
                    'upgrade_url': '/subscription/upgrade'
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


def track_usage(resource_type, count=1):
    """Decorator to track usage of resources"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            # Execute the view first
            response = view_func(request, *args, **kwargs)
            
            # Track usage if successful
            if hasattr(response, 'status_code') and 200 <= response.status_code < 300:
                if hasattr(request, 'user') and request.user.is_authenticated and request.user.organization:
                    org = request.user.organization
                    now = timezone.now()
                    month_start = datetime(now.year, now.month, 1).date()
                    
                    # Update usage tracking
                    usage_fields = {
                        'emails': 'emails_sent',
                        'campaigns': 'campaigns_created',
                        'contacts': 'contacts_imported',
                        'templates': 'templates_created',
                        'domains': 'domains_verified',
                        'api': 'api_calls',
                        'ab_tests': 'ab_tests_created',
                    }
                    
                    if resource_type in usage_fields:
                        field_name = usage_fields[resource_type]
                        UsageTracking.objects.filter(
                            organization=org,
                            month=month_start
                        ).update(**{field_name: F(field_name) + count})
            
            return response
        return wrapped_view
    return decorator