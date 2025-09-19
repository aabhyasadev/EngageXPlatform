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

from .models import User, Organization

logger = logging.getLogger(__name__)


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
        # Validate organization exists
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return Response({
            'error': 'Invalid Organization ID',
            'code': 'INVALID_ORG_ID'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if user exists with this email in this organization
    try:
        user = User.objects.get(email=email, organization=organization)
        
        # Store validation in session for next step
        request.session['signin_organization_id'] = organization_id
        request.session['signin_email'] = email
        request.session['signin_user_id'] = str(user.id)
        
        return Response({
            'message': 'Organization and email validated',
            'organization_name': organization.name,
            'next_step': 'credentials'
        })
        
    except User.DoesNotExist:
        return Response({
            'error': 'No account found with this email in the specified organization',
            'code': 'USER_NOT_FOUND'
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
    
    if not signin_email or not signin_user_id:
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
        
        # Authenticate user
        # For this implementation, we'll check if username matches and use Django's password check
        if user.username and user.username == username:
            if user.check_password(password):
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
                    login(request, user)
                    
                    # Clear signin session data
                    request.session.pop('signin_organization_id', None)
                    request.session.pop('signin_email', None)
                    request.session.pop('signin_user_id', None)
                    
                    return Response({
                        'message': 'Login successful',
                        'user': {
                            'id': str(user.id),
                            'email': user.email,
                            'full_name': user.full_name,
                            'organization': user.organization.name,
                            'role': user.role
                        }
                    })
            else:
                # Invalid password
                user.login_attempts += 1
                if user.login_attempts >= 5:
                    user.locked_until = timezone.now() + timedelta(minutes=30)
                user.save()
                
                return Response({
                    'error': 'Invalid username or password',
                    'code': 'INVALID_CREDENTIALS'
                }, status=status.HTTP_401_UNAUTHORIZED)
        else:
            # Invalid username
            user.login_attempts += 1
            if user.login_attempts >= 5:
                user.locked_until = timezone.now() + timedelta(minutes=30)
            user.save()
            
            return Response({
                'error': 'Invalid username or password',
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
    credentials_validated = request.session.get('signin_credentials_validated')
    
    if not signin_user_id or not credentials_validated:
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
            login(request, user)
            
            # Clear all signin session data
            request.session.pop('signin_organization_id', None)
            request.session.pop('signin_email', None)
            request.session.pop('signin_user_id', None)
            request.session.pop('signin_credentials_validated', None)
            
            return Response({
                'message': 'Login successful',
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'full_name': user.full_name,
                    'organization': user.organization.name,
                    'role': user.role
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
        # Find user by email
        user = User.objects.get(email=email)
        
        if not user.organization:
            return Response({
                'error': 'No organization associated with this account'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Send email with organization ID
        try:
            html_message = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Your EngageX Organization ID</h2>
                <p style="font-size: 16px; color: #666;">
                    Hello {user.full_name},
                </p>
                <p style="font-size: 16px; color: #666;">
                    Your organization ID is:
                </p>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 2px;">
                        {user.organization.id}
                    </h1>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Organization: {user.organization.name}
                </p>
                <p style="color: #666; font-size: 14px;">
                    Use this Organization ID to sign in to your EngageX account.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    EngageX - Professional Email Marketing Platform
                </p>
            </div>
            """
            
            plain_message = f"""
            Your EngageX Organization ID
            
            Hello {user.full_name},
            
            Your organization ID is: {user.organization.id}
            Organization: {user.organization.name}
            
            Use this Organization ID to sign in to your EngageX account.
            
            EngageX - Professional Email Marketing Platform
            """
            
            sent = send_mail(
                subject='Your EngageX Organization ID',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
            
            if sent:
                return Response({
                    'message': 'Your Org ID has been sent to your email',
                    'email': email
                })
            else:
                raise Exception("Email sending failed")
                
        except Exception as e:
            logger.error(f"Error sending organization ID email: {e}")
            return Response({
                'error': 'Failed to send email. Please try again later'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except User.DoesNotExist:
        return Response({
            'error': 'No account exists with this email',
            'code': 'EMAIL_NOT_FOUND'
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