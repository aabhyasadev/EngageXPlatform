import secrets
import random
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings
import os
from .models import User, Organization, EmailOTP, UserRole, SubscriptionPlan
from .serializers import UserSerializer, OrganizationSerializer


def generate_otp():
    """Generate a 6-digit OTP"""
    return str(random.randint(100000, 999999))


def generate_unique_username(first_name):
    """Generate a unique username based on first name with numeric suffix starting from 1"""
    base_username = first_name.lower().strip()
    # Remove any non-alphanumeric characters
    import re
    base_username = re.sub(r'[^a-z0-9]', '', base_username)
    
    if not base_username:
        base_username = "user"
    
    # Always start with numeric suffix from 1 as per requirements
    counter = 1
    while True:
        username_candidate = f"{base_username}{counter}"
        if not User.objects.filter(username=username_candidate).exists():
            return username_candidate
        counter += 1
        # Safety check to avoid infinite loop
        if counter > 9999:
            # Fallback to uuid if we can't find a unique username
            import uuid
            return f"{base_username}{str(uuid.uuid4())[:8]}"


def send_welcome_email(email, first_name, username):
    """Send welcome email using Django SMTP"""
    try:
        html_message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007bff;">Welcome to EngageX, {first_name}! 🎉</h2>
            <p style="font-size: 16px; color: #333;">
                Your account has been successfully created and you're all set to start your email marketing journey!
            </p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Your Account Details:</h3>
                <p style="margin: 5px 0;"><strong>Username:</strong> {username}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> {email}</p>
            </div>
            <p style="color: #666;">
                You can now log in to your account and start creating powerful email campaigns. 
                We've set up a 14-day free trial for you to explore all features.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:5000/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Log In to Your Account
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
                EngageX - Professional Email Marketing Platform
            </p>
        </div>
        """
        
        plain_message = f"""
        Welcome to EngageX, {first_name}!
        
        Your account has been successfully created and you're all set to start your email marketing journey!
        
        Your Account Details:
        Username: {username}
        Email: {email}
        
        You can now log in to your account and start creating powerful email campaigns. 
        We've set up a 14-day free trial for you to explore all features.
        
        EngageX - Professional Email Marketing Platform
        """
        
        sent = send_mail(
            subject=f'Welcome to EngageX, {first_name}!',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        
        return sent == 1
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to send welcome email to {email}: {str(e)}")
        return False


def send_otp_email(email, otp_code):
    """Send OTP via Django SMTP"""
    try:
        html_message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to EngageX!</h2>
            <p style="font-size: 16px; color: #666;">
                Your verification code is:
            </p>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">
                    {otp_code}
                </h1>
            </div>
            <p style="color: #666; font-size: 14px;">
                This code will expire in 20 minutes. If you didn't request this code, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
                EngageX - Professional Email Marketing Platform
            </p>
        </div>
        """
        
        plain_message = f"""
        Welcome to EngageX!
        
        Your verification code is: {otp_code}
        
        This code will expire in 20 minutes. If you didn't request this code, please ignore this email.
        
        EngageX - Professional Email Marketing Platform
        """
        
        sent = send_mail(
            subject='Your EngageX Verification Code',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        
        return sent == 1
        
    except Exception as e:
        print(f"Error sending OTP email: {e}")
        return False


@api_view(['POST'])
@permission_classes([AllowAny])
def check_email(request):
    """
    Step 1: Check if email already exists
    """
    email = request.data.get('email', '').lower().strip()
    
    if not email:
        return Response({
            'error': 'Email is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if email already exists
    if User.objects.filter(email=email).exists():
        return Response({
            'error': 'This email is already registered',
            'exists': True
        }, status=status.HTTP_409_CONFLICT)
    
    # Store email in session for next steps
    request.session['signup_data'] = {
        'email': email,
        'step': 1
    }
    
    return Response({
        'message': 'Email is available',
        'exists': False
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def basic_info(request):
    """
    Step 2: Collect basic user information
    """
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    phone = request.data.get('phone', '').strip()
    
    if not all([first_name, last_name, phone]):
        return Response({
            'error': 'All fields are required (first_name, last_name, phone)'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get existing signup data from session (should have email from step 1)
    signup_data = request.session.get('signup_data', {})
    if not signup_data or not signup_data.get('email'):
        return Response({
            'error': 'Please complete email verification first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    email = signup_data.get('email')
    
    # Validate email not already registered (double check)
    if User.objects.filter(email=email).exists():
        return Response({
            'error': 'This email is already registered'
        }, status=status.HTTP_409_CONFLICT)
    
    # Update session with basic info
    signup_data.update({
        'first_name': first_name,
        'last_name': last_name,
        'phone': phone,
        'step': 2
    })
    request.session['signup_data'] = signup_data
    
    return Response({
        'message': 'Basic information saved',
        'step': 2
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def business_info(request):
    """
    Step 3: Collect business information
    """
    contacts_range = request.data.get('contacts_range', '').strip()
    employees_range = request.data.get('employees_range', '').strip()
    industry = request.data.get('industry', '').strip()
    
    if not all([contacts_range, employees_range, industry]):
        return Response({
            'error': 'All fields are required (contacts_range, employees_range, industry)'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get existing signup data
    signup_data = request.session.get('signup_data', {})
    if not signup_data or signup_data.get('step', 0) < 2:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Update session with business info
    signup_data.update({
        'contacts_range': contacts_range,
        'employees_range': employees_range,
        'industry': industry,
        'step': 3
    })
    request.session['signup_data'] = signup_data
    
    return Response({
        'message': 'Business information saved',
        'step': 3
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def send_otp(request):
    """
    Step 4: Send OTP to email for verification
    """
    # Get signup data from session
    signup_data = request.session.get('signup_data', {})
    if not signup_data or signup_data.get('step', 0) < 3:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    email = signup_data.get('email')
    if not email:
        return Response({
            'error': 'Email not found in session'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Clean up expired OTPs
    EmailOTP.objects.filter(
        email=email,
        expires_at__lt=timezone.now()
    ).delete()
    
    # Check for recent valid OTP
    existing_otp = EmailOTP.objects.filter(
        email=email,
        is_verified=False,
        expires_at__gt=timezone.now()
    ).first()
    
    if existing_otp:
        # For development: if email service not configured, ensure dev OTP
        if not settings.SENDGRID_API_KEY:
            # Update existing OTP to use dev code
            if existing_otp.otp_code != "123456":
                existing_otp.otp_code = "123456"
                existing_otp.save()
            
            return Response({
                'message': 'Development mode: Use OTP code 123456',
                'expires_in_minutes': 20,
                'dev_mode': True,
                'dev_otp': '123456'
            })
        
        # Resend existing OTP
        if send_otp_email(email, existing_otp.otp_code):
            return Response({
                'message': 'Verification code sent to your email',
                'expires_in_minutes': 20
            })
        else:
            return Response({
                'error': 'Failed to send verification email'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    # Generate new OTP - use fixed OTP in dev mode
    if not settings.SENDGRID_API_KEY:
        otp_code = "123456"  # Fixed OTP for development
    else:
        otp_code = generate_otp()
        
    expires_at = timezone.now() + timedelta(minutes=20)
    
    # Create OTP record
    email_otp = EmailOTP.objects.create(
        email=email,
        otp_code=otp_code,
        expires_at=expires_at
    )
    
    # For development: if email service not configured, return dev OTP
    if not settings.SENDGRID_API_KEY:
        return Response({
            'message': 'Development mode: Use OTP code 123456',
            'expires_in_minutes': 20,
            'dev_mode': True,
            'dev_otp': '123456'
        })
    
    # Send OTP email
    if send_otp_email(email, otp_code):
        return Response({
            'message': 'Verification code sent to your email',
            'expires_in_minutes': 20
        })
    else:
        email_otp.delete()  # Clean up if email failed
        return Response({
            'error': 'Failed to send verification email'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_otp(request):
    """
    Resend OTP to email
    """
    # Get signup data from session
    signup_data = request.session.get('signup_data', {})
    if not signup_data or signup_data.get('step', 0) < 3:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    email = signup_data.get('email')
    if not email:
        return Response({
            'error': 'Email not found in session'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get existing valid OTP
    existing_otp = EmailOTP.objects.filter(
        email=email,
        is_verified=False,
        expires_at__gt=timezone.now()
    ).first()
    
    if not existing_otp:
        return Response({
            'error': 'No active verification code found. Please request a new one.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # For development: if email service not configured, ensure dev OTP
    if not settings.SENDGRID_API_KEY:
        # Update existing OTP to use dev code for consistency
        if existing_otp.otp_code != "123456":
            existing_otp.otp_code = "123456"
            existing_otp.save()
            
        return Response({
            'message': 'Development mode: Use OTP code 123456',
            'dev_mode': True,
            'dev_otp': '123456'
        })
    
    # Send OTP email
    if send_otp_email(email, existing_otp.otp_code):
        return Response({
            'message': 'Verification code resent to your email'
        })
    else:
        return Response({
            'error': 'Failed to resend verification email'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    """
    Step 4: Verify OTP code
    """
    otp_code = request.data.get('otp_code', '').strip()
    
    if not otp_code:
        return Response({
            'error': 'OTP code is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get signup data from session
    signup_data = request.session.get('signup_data', {})
    if not signup_data or signup_data.get('step', 0) < 3:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    email = signup_data.get('email')
    if not email:
        return Response({
            'error': 'Email not found in session'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Find OTP record
    try:
        email_otp = EmailOTP.objects.get(
            email=email,
            otp_code=otp_code,
            is_verified=False
        )
    except EmailOTP.DoesNotExist:
        return Response({
            'error': 'Invalid verification code'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if expired
    if email_otp.is_expired():
        return Response({
            'error': 'Verification code has expired'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check max attempts
    if email_otp.is_max_attempts_reached():
        return Response({
            'error': 'Maximum attempts exceeded. Please request a new code.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Mark as verified
    email_otp.is_verified = True
    email_otp.save()
    
    # Update session
    signup_data['step'] = 4
    signup_data['email_verified'] = True
    request.session['signup_data'] = signup_data
    
    return Response({
        'message': 'Email verified successfully',
        'step': 4
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def create_account(request):
    """
    Step 5: Create user account with password
    """
    password = request.data.get('password', '').strip()
    confirm_password = request.data.get('confirm_password', '').strip()
    
    if not password or not confirm_password:
        return Response({
            'error': 'Password and confirmation are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if password != confirm_password:
        return Response({
            'error': 'Passwords do not match'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if len(password) < 8:
        return Response({
            'error': 'Password must be at least 8 characters long'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get signup data from session
    signup_data = request.session.get('signup_data', {})
    if not signup_data or not signup_data.get('email_verified'):
        return Response({
            'error': 'Please complete email verification first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Extract data
    email = signup_data.get('email')
    first_name = signup_data.get('first_name')
    last_name = signup_data.get('last_name')
    phone = signup_data.get('phone')
    contacts_range = signup_data.get('contacts_range')
    employees_range = signup_data.get('employees_range')
    industry = signup_data.get('industry')
    
    if not all([email, first_name, last_name, phone, contacts_range, employees_range, industry]):
        return Response({
            'error': 'Missing signup data. Please start over.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        print(f"DEBUG: Starting account creation for {email}")
        print(f"DEBUG: Session data: {signup_data}")
        
        # Initialize variables
        user = None
        organization = None
        generated_username = None
        
        # Handle username generation with race condition protection
        max_retries = 5
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    # Create organization first
                    print(f"DEBUG: Creating organization with data: industry={industry}, employees={employees_range}, contacts={contacts_range}")
                    organization = Organization.objects.create(
                        name=f"{first_name} {last_name}'s Organization",
                        subscription_plan=SubscriptionPlan.FREE_TRIAL,
                        trial_ends_at=timezone.now() + timedelta(days=14),  # 14-day trial
                        industry=industry,
                        employees_range=employees_range,
                        contacts_range=contacts_range
                    )
                    
                    # Generate unique username based on first name
                    generated_username = generate_unique_username(first_name)
                    
                    # Create user as ORGANIZER (organization owner)
                    user = User.objects.create(
                        email=email,
                        username=generated_username,
                        first_name=first_name,
                        last_name=last_name,
                        phone=phone,
                        password=make_password(password),
                        organization=organization,
                        role=UserRole.ORGANIZER,  # First user becomes organization owner
                        is_active=True
                    )
                    
                    break  # Success, exit retry loop
                    
            except Exception as e:
                from django.db import IntegrityError
                if isinstance(e, IntegrityError) and 'username' in str(e) and attempt < max_retries - 1:
                    # Username collision, retry with next available username
                    print(f"DEBUG: Username collision on attempt {attempt + 1}, retrying...")
                    continue
                else:
                    # Not a username collision or max retries reached, re-raise
                    raise
        
        # Send welcome email
        welcome_email_sent = send_welcome_email(email, first_name, generated_username)
        
        # Clean up session data
        if 'signup_data' in request.session:
            del request.session['signup_data']
        
        # Clean up verified OTP
        EmailOTP.objects.filter(email=email, is_verified=True).delete()
        
        return Response({
            'message': f'Welcome to EngageX, {first_name}! Your account has been successfully created.',
            'username': generated_username,
            'welcome_email_sent': welcome_email_sent,
            'user': UserSerializer(user).data,
            'organization': OrganizationSerializer(organization).data,
            'trial_ends_at': organization.trial_ends_at.isoformat()
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        print(f"DEBUG: Account creation failed with error: {str(e)}")
        print(f"DEBUG: Error type: {type(e)}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
        return Response({
            'error': f'Failed to create account: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)