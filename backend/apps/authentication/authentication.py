import json
import hmac
import hashlib
import time
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.models import Organization

User = get_user_model()


class SignedHeaderAuthentication(BaseAuthentication):
    """
    Django REST Framework authentication that verifies signed headers from Express
    """
    
    def authenticate(self, request):
        # Extract headers from Express proxy
        user_data_header = request.META.get('HTTP_X_USER_DATA')
        user_signature_header = request.META.get('HTTP_X_USER_SIGNATURE')
        
        if not user_data_header or not user_signature_header:
            return None
        
        try:
            # Verify HMAC signature using same secret as Express proxy
            auth_secret = getattr(settings, 'AUTH_BRIDGE_SECRET', None)
            if not auth_secret:
                # Auth bridge not configured - skip signed header authentication
                return None
                
            expected_signature = hmac.new(
                auth_secret.encode('utf-8'),
                user_data_header.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(expected_signature, user_signature_header):
                raise AuthenticationFailed('Invalid signature')
            
            # Parse user data
            user_data = json.loads(user_data_header)
            user_id = user_data.get('userId')
            user_email = user_data.get('userEmail') 
            organization_id = user_data.get('organizationId')
            timestamp_str = user_data.get('timestamp')
            
            if not user_id or not user_email:
                raise AuthenticationFailed('Missing user data')
            
            # Validate timestamp (prevent replay attacks)
            if timestamp_str:
                timestamp = int(timestamp_str)
                current_time = int(time.time() * 1000)  # milliseconds
                # Allow 5 minute window
                if abs(current_time - timestamp) > 5 * 60 * 1000:
                    raise AuthenticationFailed('Request timestamp expired')
            
            # Get or create user using external Replit ID
            try:
                user = User.objects.get(replit_id=user_id)
            except User.DoesNotExist:
                # Validate organization exists before creating user
                organization = None
                if organization_id:
                    try:
                        organization = Organization.objects.get(id=organization_id)
                    except Organization.DoesNotExist:
                        organization = None
                
                # Create user with proper error handling
                try:
                    user = User.objects.create(
                        replit_id=user_id,
                        email=user_email,
                        organization=organization
                    )
                except Exception as e:
                    raise AuthenticationFailed(f'User creation failed: {str(e)}')
            
            # Update organization if changed (with validation)
            if organization_id and user.organization_id != organization_id:
                try:
                    new_organization = Organization.objects.get(id=organization_id)
                    user.organization = new_organization
                    user.save(update_fields=['organization'])
                except Organization.DoesNotExist:
                    # Log but don't fail authentication for invalid org
                    pass
            
            return (user, None)
            
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            raise AuthenticationFailed(f'Invalid user data format: {str(e)}')


class ReplitAuthBackend(BaseBackend):
    """
    Django authentication backend for Replit Auth integration
    """
    
    def authenticate(self, request, user_id=None, user_email=None, organization_id=None, **kwargs):
        if not user_id or not user_email:
            return None
        
        try:
            # Validate organization exists if provided
            organization = None
            if organization_id:
                try:
                    organization = Organization.objects.get(id=organization_id)
                except Organization.DoesNotExist:
                    organization = None
            
            # Get or create user by replit_id
            user, created = User.objects.get_or_create(
                replit_id=user_id,
                defaults={
                    'email': user_email,
                    'organization': organization
                }
            )
            
            # Update user data if not created
            if not created:
                updated = False
                if user.email != user_email:
                    user.email = user_email
                    updated = True
                if user.organization_id != organization_id:
                    user.organization_id = organization_id
                    updated = True
                if updated:
                    user.save()
            
            return user
            
        except Exception as e:
            return None
    
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None


class CSRFExemptSessionAuthentication(SessionAuthentication):
    """
    Session authentication that bypasses CSRF validation for REST API endpoints.
    REST APIs typically rely on authentication tokens rather than CSRF protection.
    """
    def enforce_csrf(self, request):
        return  # Skip CSRF check for REST API endpoints