from django.contrib.auth import authenticate, login
from django.contrib.auth.models import AnonymousUser
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from datetime import timedelta
import random
import string
import logging

from .models import User, Organization, OrganizationMembership, MembershipStatus

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def organization_login(request):
    """
    New organization-scoped login flow
    Uses organization + username + password (instead of global email)
    """
    organization_id = request.data.get('organization_id', '').strip()
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    
    if not organization_id or not username or not password:
        return Response({
            'error': 'Organization ID, username, and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Validate organization exists
        organization = Organization.objects.get(id=organization_id)
        
        # Find membership by organization + username
        membership = OrganizationMembership.objects.filter(
            organization=organization,
            credential_username=username,
            status=MembershipStatus.ACTIVE
        ).first()
        
        if not membership:
            # Generic error to prevent username enumeration
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if account is locked
        if membership.is_locked():
            return Response({
                'error': 'Account is temporarily locked due to multiple failed login attempts'
            }, status=status.HTTP_423_LOCKED)
        
        # Verify password
        if not membership.check_password(password):
            # Record failed attempt
            membership.record_login_attempt(success=False)
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Password is correct - record successful login
        membership.record_login_attempt(success=True)
        
        # Check if password change is required
        if membership.requires_password_change:
            # Store pending authentication data (DO NOT LOGIN YET)
            request.session['pending_auth_membership_id'] = str(membership.id)
            request.session['pending_auth_organization_id'] = str(organization.id)
            request.session['pending_auth_user_id'] = str(membership.user.id)
            return Response({
                'message': 'Password change required',
                'requires_password_change': True,
                'organization': organization.name,
                'user': {
                    'id': str(membership.user.id),
                    'email': membership.user.email,
                    'first_name': membership.user.first_name,
                    'last_name': membership.user.last_name,
                    'role': membership.role
                }
            })
        
        # Check if MFA is enabled
        if membership.mfa_enabled:
            # Store pending authentication data (DO NOT LOGIN YET)
            request.session['pending_auth_membership_id'] = str(membership.id)
            request.session['pending_auth_organization_id'] = str(organization.id)
            request.session['pending_auth_user_id'] = str(membership.user.id)
            return Response({
                'message': 'MFA verification required',
                'requires_mfa': True,
                'organization': organization.name
            })
        
        # No additional verification needed - complete login now
        request.session['current_organization_id'] = str(organization.id)
        request.session['current_membership_id'] = str(membership.id)
        request.session['current_user_id'] = str(membership.user.id)
        
        # Log in the underlying Django user for DRF compatibility
        login(request, membership.user)
        
        # Full login success
        return Response({
            'message': 'Login successful',
            'organization': organization.name,
            'user': {
                'id': str(membership.user.id),
                'email': membership.user.email,
                'first_name': membership.user.first_name,
                'last_name': membership.user.last_name,
                'role': membership.role
            }
        })
        
    except Organization.DoesNotExist:
        return Response({
            'error': 'Organization not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Organization login error: {str(e)}")
        return Response({
            'error': 'Login failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def validate_organization_email(request):
    """
    Step 1: Validate Organization ID and Email
    """
    organization_id = request.data.get('organization_id', '').strip()
    email = request.data.get('email', '').lower().strip()
    
    if not organization_id or not email:
        return Response({
            'error': 'Organization ID and email are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .models import OrganizationMembership, MembershipStatus
        
        # Validate organization exists
        organization = Organization.objects.get(id=organization_id)
        
        # Find user by email regardless of organization
        user = User.objects.get(email=email)
        
        # Check for user access to organization using both old and new patterns
        membership = None
        has_access = False
        
        # First check if user has active membership (new multi-org pattern)
        membership = OrganizationMembership.objects.filter(
            user=user,
            organization=organization,
            status=MembershipStatus.ACTIVE
        ).first()
        
        if membership:
            has_access = True
        else:
            # Fallback to old pattern: user.organization matches
            if user.organization and user.organization.id == organization.id:
                has_access = True
                # Create membership record for future use (migration)
                membership = OrganizationMembership.objects.create(
                    user=user,
                    organization=organization,
                    role=user.role,
                    status=MembershipStatus.ACTIVE
                )
        
        if not has_access:
            # User exists but not in this organization
            raise User.DoesNotExist()
        
        # Store validation in session for next step
        request.session['signin_organization_id'] = organization_id
        request.session['signin_email'] = email
        request.session['signin_user_id'] = str(user.id)
        if membership:
            request.session['signin_membership_id'] = str(membership.id)
        
        return Response({
            'message': 'Validation successful - please proceed to next step',
            'next_step': 'credentials'
        })
        
    except (Organization.DoesNotExist, User.DoesNotExist):
        # Generic response to prevent account enumeration
        return Response({
            'error': 'Invalid credentials. Please check your Organization ID and email address.',
            'code': 'INVALID_CREDENTIALS'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def authenticate_credentials(request):
    """
    Step 2: Authenticate with Username and Password
    """
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    
    # Get validated data from session
    signin_email = request.session.get('signin_email')
    signin_user_id = request.session.get('signin_user_id')
    signin_organization_id = request.session.get('signin_organization_id')
    signin_membership_id = request.session.get('signin_membership_id')
    
    if not signin_email or not signin_user_id or not signin_membership_id:
        return Response({
            'error': 'Session expired. Please start the sign-in process again',
            'code': 'SESSION_EXPIRED'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if not username or not password:
        return Response({
            'error': 'Username and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(id=signin_user_id)
        
        # Check if account is locked
        if user.locked_until and timezone.now() < user.locked_until:
            return Response({
                'error': 'Account is temporarily locked due to multiple failed attempts',
                'code': 'ACCOUNT_LOCKED'
            }, status=status.HTTP_423_LOCKED)
        
        # Authenticate user - support both username and email-based login
        # Check if provided username matches either the user's username or email
        is_valid_credential = False
        if user.username and user.username == username:
            is_valid_credential = True
        elif not user.username and user.email == username:
            # Fallback for users without username - allow email as username
            is_valid_credential = True
        
        if is_valid_credential and user.check_password(password):
            # Reset login attempts on successful login
            user.login_attempts = 0
            user.locked_until = None
            user.last_login_at = timezone.now()
            user.save()
            
            # Check if MFA/OTP/SSO is required
            if user.mfa_enabled or user.sso_enabled:
                # Store successful credential validation for MFA step
                request.session['signin_credentials_validated'] = True
                return Response({
                    'message': 'Credentials validated',
                    'requires_verification': True,
                    'mfa_enabled': user.mfa_enabled,
                    'sso_enabled': user.sso_enabled,
                    'next_step': 'verification'
                })
            else:
                # Login user directly if no additional verification needed
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                
                # Get membership information for the response
                from .models import OrganizationMembership
                membership = OrganizationMembership.objects.get(id=signin_membership_id)
                
                # Set current organization context in session
                request.session['current_organization_id'] = signin_organization_id
                request.session['current_membership_id'] = signin_membership_id
                
                # Clear signin session data
                request.session.pop('signin_organization_id', None)
                request.session.pop('signin_email', None)
                request.session.pop('signin_user_id', None)
                request.session.pop('signin_membership_id', None)
                
                return Response({
                    'message': 'Login successful',
                    'user': {
                        'id': str(user.id),
                        'email': user.email,
                        'full_name': user.full_name,
                        'organization': membership.organization.name,
                        'role': membership.role
                    }
                })
        else:
            # Invalid credentials
            user.login_attempts += 1
            if user.login_attempts >= 5:
                user.locked_until = timezone.now() + timedelta(minutes=30)
            user.save()
            
            return Response({
                'error': 'Invalid credentials',
                'code': 'INVALID_CREDENTIALS'
            }, status=status.HTTP_401_UNAUTHORIZED)
            
    except User.DoesNotExist:
        return Response({
            'error': 'Session expired. Please start the sign-in process again',
            'code': 'SESSION_EXPIRED'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_mfa_otp_sso(request):
    """
    Step 3: Verify MFA/OTP/SSO
    """
    verification_code = request.data.get('verification_code', '').strip()
    
    # Get validated data from session
    signin_user_id = request.session.get('signin_user_id')
    signin_organization_id = request.session.get('signin_organization_id')
    signin_membership_id = request.session.get('signin_membership_id')
    credentials_validated = request.session.get('signin_credentials_validated')
    
    if not signin_user_id or not credentials_validated or not signin_membership_id:
        return Response({
            'error': 'Session expired. Please start the sign-in process again',
            'code': 'SESSION_EXPIRED'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if not verification_code:
        return Response({
            'error': 'Verification code is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(id=signin_user_id)
        
        # For this implementation, we'll do a simple verification
        # In a real system, you'd integrate with TOTP libraries, SMS services, etc.
        
        # Simple verification - accept any 6-digit code for demo
        if verification_code.isdigit() and len(verification_code) == 6:
            # Login user after successful verification
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            
            # Get membership information for the response
            from .models import OrganizationMembership
            membership = OrganizationMembership.objects.get(id=signin_membership_id)
            
            # Set current organization context in session
            request.session['current_organization_id'] = signin_organization_id
            request.session['current_membership_id'] = signin_membership_id
            
            # Clear all signin session data
            request.session.pop('signin_organization_id', None)
            request.session.pop('signin_email', None)
            request.session.pop('signin_user_id', None)
            request.session.pop('signin_membership_id', None)
            request.session.pop('signin_credentials_validated', None)
            
            return Response({
                'message': 'Login successful',
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'full_name': user.full_name,
                    'organization': membership.organization.name,
                    'role': membership.role
                }
            })
        else:
            return Response({
                'error': 'Invalid verification code',
                'code': 'INVALID_VERIFICATION'
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except User.DoesNotExist:
        return Response({
            'error': 'Session expired. Please start the sign-in process again',
            'code': 'SESSION_EXPIRED'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_account(request):
    """
    Forgot Account - Send Organization ID to email
    """
    email = request.data.get('email', '').lower().strip()
    
    if not email:
        return Response({
            'error': 'Email is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .models import OrganizationMembership, MembershipStatus
        
        user = User.objects.get(email=email)
        
        # Get all active memberships for this user
        memberships = OrganizationMembership.objects.filter(
            user=user,
            status=MembershipStatus.ACTIVE
        ).select_related('organization')
        
        if memberships.exists():
            # Send email with organization IDs
            try:
                # Build organization list
                org_list_html = ""
                org_list_plain = ""
                
                for membership in memberships:
                    org_list_html += f"""
                    <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px;">
                        <h3 style="color: #007bff; font-size: 24px; margin: 0; letter-spacing: 1px;">
                            {membership.organization.id}
                        </h3>
                        <p style="color: #666; font-size: 14px; margin: 5px 0;">
                            Organization: {membership.organization.name} | Role: {membership.role.replace('_', ' ').title()}
                        </p>
                    </div>
                    """
                    
                    org_list_plain += f"""
                    Organization ID: {membership.organization.id}
                    Organization: {membership.organization.name}
                    Your Role: {membership.role.replace('_', ' ').title()}
                    
                    """
                
                html_message = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Your EngageX Organization IDs</h2>
                    <p style="font-size: 16px; color: #666;">
                        Hello {user.full_name},
                    </p>
                    <p style="font-size: 16px; color: #666;">
                        You have access to the following organizations:
                    </p>
                    {org_list_html}
                    <p style="color: #666; font-size: 14px;">
                        Use any of these Organization IDs to sign in to your EngageX account.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">
                        EngageX - Professional Email Marketing Platform
                    </p>
                </div>
                """
                
                plain_message = f"""
                Your EngageX Organization IDs
                
                Hello {user.full_name},
                
                You have access to the following organizations:
                
                {org_list_plain}
                
                Use any of these Organization IDs to sign in to your EngageX account.
                
                EngageX - Professional Email Marketing Platform
                """
                
                email_sent = send_mail(
                    subject='Your EngageX Organization IDs',
                    message=plain_message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    html_message=html_message,
                    fail_silently=False,  # Don't fail silently so we can catch errors
                )
                
                if email_sent:
                    org_count = memberships.count()
                    return Response({
                        'message': f'Your Organization IDs ({org_count} organizations) have been sent to {email}. Please check your email.',
                        'email': email,
                        'organization_count': org_count
                    })
                else:
                    return Response({
                        'error': 'Failed to send email. Please try again later.'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            except Exception as e:
                logger.error(f"Error sending organization ID email: {e}")
                return Response({
                    'error': 'Failed to send email. Please try again later.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # User exists but has no organization memberships
            return Response({
                'error': 'No organization memberships found for this account.'
            }, status=status.HTTP_400_BAD_REQUEST)
                
    except User.DoesNotExist:
        # User doesn't exist - return error message as requested
        return Response({
            'error': 'No account found with this email.'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_user(request):
    """Logout user and clear session"""
    try:
        # Clear all signin-related session data
        request.session.pop('signin_organization_id', None)
        request.session.pop('signin_email', None)
        request.session.pop('signin_user_id', None)
        request.session.pop('signin_credentials_validated', None)
        
        # Django logout
        from django.contrib.auth import logout
        logout(request)
        
        return Response({
            'message': 'Logged out successfully'
        })
    except Exception as e:
        return Response({
            'error': f'Logout failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)