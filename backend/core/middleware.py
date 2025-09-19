from django.http import JsonResponse
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from .models import Organization, SubscriptionPlan, User
import json
import hmac
import hashlib
import logging
from django.conf import settings

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
        if not settings.SESSION_SECRET:
            logger.error("SESSION_SECRET not configured")
            return False
            
        expected_signature = hmac.new(
            settings.SESSION_SECRET.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)


class SubscriptionAccessMiddleware(MiddlewareMixin):
    """
    Middleware to check subscription access for protected endpoints
    """
    
    # Endpoints that require active subscription
    PROTECTED_ENDPOINTS = [
        '/api/campaigns/',
        '/api/contacts/',
        '/api/templates/',
        '/api/analytics/',
    ]
    
    # Endpoints that are always allowed (even without subscription)
    ALLOWED_ENDPOINTS = [
        '/api/auth/',
        '/api/subscription/',
        '/api/signup/',
        '/health',
        '/api/test',
        '/admin/',
        '/static/',
    ]

    def process_request(self, request):
        """Check subscription access before processing request"""
        
        # Skip non-API requests
        if not request.path.startswith('/api/'):
            return None
            
        # Check if endpoint is always allowed
        for allowed_path in self.ALLOWED_ENDPOINTS:
            if request.path.startswith(allowed_path):
                return None
        
        # Check if endpoint requires subscription
        is_protected = any(
            request.path.startswith(protected_path) 
            for protected_path in self.PROTECTED_ENDPOINTS
        )
        
        if not is_protected:
            return None
            
        # Check if user is authenticated
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return JsonResponse({
                'error': 'Authentication required',
                'code': 'AUTH_REQUIRED'
            }, status=401)
        
        # Check if user has organization
        if not request.user.organization:
            return JsonResponse({
                'error': 'No organization found',
                'code': 'NO_ORGANIZATION'
            }, status=403)
        
        org = request.user.organization
        
        # Check subscription status
        is_expired = self._is_subscription_expired(org)
        
        if is_expired or not org.is_subscription_active:
            return JsonResponse({
                'error': 'Subscription required or expired',
                'code': 'SUBSCRIPTION_REQUIRED',
                'subscription_status': {
                    'plan': org.subscription_plan,
                    'is_expired': is_expired,
                    'is_active': org.is_subscription_active,
                    'trial_ends_at': org.trial_ends_at.isoformat() if org.trial_ends_at else None,
                    'subscription_ends_at': org.subscription_ends_at.isoformat() if org.subscription_ends_at else None,
                }
            }, status=402)  # Payment Required
        
        return None
    
    def _is_subscription_expired(self, organization):
        """Check if organization's subscription is expired"""
        now = timezone.now()
        
        if organization.subscription_plan == SubscriptionPlan.FREE_TRIAL:
            return organization.trial_ends_at and now > organization.trial_ends_at
        else:
            return organization.subscription_ends_at and now > organization.subscription_ends_at


class FeatureLimitMiddleware(MiddlewareMixin):
    """
    Middleware to enforce feature limits based on subscription plan
    """
    
    def process_request(self, request):
        """Check feature limits before processing request"""
        
        # Only check POST requests that create new resources
        if request.method != 'POST':
            return None
            
        # Skip non-API requests
        if not request.path.startswith('/api/'):
            return None
            
        # Check if user is authenticated and has organization
        if (not hasattr(request, 'user') or 
            not request.user.is_authenticated or 
            not request.user.organization):
            return None
        
        org = request.user.organization
        
        # Check campaign limits
        if request.path.startswith('/api/campaigns/'):
            current_campaigns = org.campaigns.count()
            if current_campaigns >= org.campaigns_limit:
                return JsonResponse({
                    'error': f'Campaign limit reached ({org.campaigns_limit})',
                    'code': 'CAMPAIGN_LIMIT_REACHED',
                    'current_count': current_campaigns,
                    'limit': org.campaigns_limit
                }, status=403)
        
        # Check contact limits
        elif request.path.startswith('/api/contacts/'):
            current_contacts = org.contacts.count()
            if current_contacts >= org.contacts_limit:
                return JsonResponse({
                    'error': f'Contact limit reached ({org.contacts_limit})',
                    'code': 'CONTACT_LIMIT_REACHED',
                    'current_count': current_contacts,
                    'limit': org.contacts_limit
                }, status=403)
        
        return None