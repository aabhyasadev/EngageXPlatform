import os
import requests
from urllib.parse import urlencode, parse_qs
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.shortcuts import redirect
from django.urls import reverse
# Force Django reload
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token
from django.http import HttpResponseRedirect

from .models import Organization
from .serializers import UserSerializer

User = get_user_model()


@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    """Get CSRF token for frontend"""
    token = get_token(request)
    return Response({'csrfToken': token})


@api_view(['GET'])
@permission_classes([AllowAny])
def test_connection(request):
    """Test endpoint to verify Django-frontend connection works"""
    return Response({
        'status': 'success',
        'message': 'Django is connected to frontend!',
        'timestamp': timezone.now().isoformat()
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def replit_auth_login(request):
    """
    Handle Replit authentication callback.
    This expects user data from Replit's OpenID Connect flow.
    """
    try:
        # Extract user data from request
        user_data = request.data
        user_id = user_data.get('sub')  # Replit user ID
        email = user_data.get('email')
        first_name = user_data.get('first_name', '')
        last_name = user_data.get('last_name', '')
        profile_image_url = user_data.get('profile_image_url', '')
        
        if not user_id or not email:
            return Response({
                'error': 'Missing required user data (sub, email)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create user
        user, created = User.objects.get_or_create(
            replit_id=user_id,
            defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'profile_image_url': profile_image_url,
            }
        )
        
        # Update user data if not created
        if not created:
            updated = False
            if user.email != email:
                user.email = email
                updated = True
            if user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if user.last_name != last_name:
                user.last_name = last_name
                updated = True
            if user.profile_image_url != profile_image_url:
                user.profile_image_url = profile_image_url
                updated = True
            if updated:
                user.save()
        
        # Log the user in
        login(request, user)
        
        # Return user data with organization info
        organization = user.organization
        response_data = {
            'user': UserSerializer(user).data,
            'organization': organization.name if organization else None,
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Authentication failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # Allow anonymous to return proper 401 response
def auth_user(request):
    """
    Get current authenticated user - matches Express /api/auth/user endpoint
    """
    # Check if user is authenticated first
    if not request.user.is_authenticated:
        return Response({
            'detail': 'Not authenticated'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        user = request.user
        # Use getattr to safely access organization attribute
        organization = getattr(user, 'organization', None)
        
        # Manual serialization to avoid UserSerializer issues with organization field
        user_data = {
            'id': str(user.id) if hasattr(user, 'id') else None,
            'email': getattr(user, 'email', ''),
            'first_name': getattr(user, 'first_name', ''),
            'last_name': getattr(user, 'last_name', ''),
            'profile_image_url': getattr(user, 'profile_image_url', ''),
            'role': getattr(user, 'role', 'user'),
            'is_active': getattr(user, 'is_active', True),
        }
        
        # Add organization info in the same format as Express
        if organization:
            user_data['organization'] = {
                'id': str(organization.id),
                'name': organization.name,
                'industry': organization.industry,
                'employeesRange': organization.employees_range,
                'contactsRange': organization.contacts_range,
                'trialEndsAt': organization.trial_ends_at.isoformat() if organization.trial_ends_at else None,
            }
        else:
            user_data['organization'] = None
            
        return Response(user_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Failed to get user: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Log out current user"""
    logout(request)
    return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Get dashboard statistics - matches Express /api/dashboard/stats endpoint
    """
    if not request.user.organization:
        return Response({'error': 'No organization found'}, status=status.HTTP_400_BAD_REQUEST)
    
    from django.db.models import Sum, Count
    from .models import Contact, Campaign
    
    org = request.user.organization
    
    # Calculate statistics matching Express format
    total_contacts = Contact.objects.filter(organization=org).count()
    active_campaigns = Campaign.objects.filter(
        organization=org,
        status__in=['sending', 'scheduled']
    ).count()
    
    # Aggregate campaign statistics
    campaign_stats = Campaign.objects.filter(organization=org).aggregate(
        total_sent=Sum('total_sent'),
        total_opened=Sum('total_opened'),
        total_clicked=Sum('total_clicked')
    )
    
    total_sent = campaign_stats['total_sent'] or 0
    total_opened = campaign_stats['total_opened'] or 0
    total_clicked = campaign_stats['total_clicked'] or 0
    
    open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0
    click_rate = (total_clicked / total_sent * 100) if total_sent > 0 else 0
    
    # Return data in exact Express format
    return Response({
        'totalContacts': total_contacts,
        'activeCampaigns': active_campaigns,
        'totalSent': total_sent,
        'totalOpened': total_opened,
        'totalClicked': total_clicked,
        'openRate': round(open_rate, 2),
        'clickRate': round(click_rate, 2)
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def oidc_login(request):
    """
    Initiate OIDC login flow - Express-compatible /api/login endpoint
    """
    try:
        # Get the current host to determine the callback URL
        host = request.get_host()
        if host.startswith('127.0.0.1:') or host.startswith('localhost:'):
            # In development, use the frontend domain for OIDC
            replit_domains = os.environ.get('REPLIT_DOMAINS', '').split(',')
            if replit_domains and replit_domains[0]:
                host = replit_domains[0].strip()
        
        # Build OIDC authorization URL
        client_id = os.environ.get('REPL_ID', '')
        
        # Build callback URL - this should point to Django's callback endpoint
        callback_url = f"https://{host}/api/callback"
        
        # OIDC authorization parameters
        auth_params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': callback_url,
            'scope': 'openid email profile offline_access',
            'state': 'django_oidc',  # Simple state parameter
            'prompt': 'login consent',
        }
        
        # Replit OIDC authorization endpoint
        auth_url = f"https://replit.com/oauth/authorize?{urlencode(auth_params)}"
        
        # Redirect to OIDC provider
        return HttpResponseRedirect(auth_url)
        
    except Exception as e:
        return Response({
            'error': f'OIDC login failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(['GET'])
@permission_classes([AllowAny])
def oidc_callback(request):
    """
    Handle OIDC callback - Express-compatible /api/callback endpoint
    """
    try:
        # Get authorization code from callback
        code = request.GET.get('code')
        state = request.GET.get('state')
        
        if not code:
            return HttpResponseRedirect(f"/api/login?error=missing_code")
        
        # Exchange code for tokens
        client_id = os.environ.get('REPL_ID', '')
        client_secret = os.environ.get('SESSION_SECRET', '')  # Using session secret as client secret
        
        # Get the host for callback URL
        host = request.get_host()
        if host.startswith('127.0.0.1:') or host.startswith('localhost:'):
            # In development, use the frontend domain for OIDC
            replit_domains = os.environ.get('REPLIT_DOMAINS', '').split(',')
            if replit_domains and replit_domains[0]:
                host = replit_domains[0].strip()
        
        callback_url = f"https://{host}/api/callback"
        
        # Token exchange parameters
        token_params = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': callback_url,
            'client_id': client_id,
            'client_secret': client_secret,
        }
        
        # Exchange code for tokens
        token_response = requests.post(
            'https://replit.com/oauth/token',
            data=token_params,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if token_response.status_code != 200:
            return HttpResponseRedirect(f"/api/login?error=token_exchange_failed")
        
        tokens = token_response.json()
        access_token = tokens.get('access_token')
        id_token = tokens.get('id_token')
        
        if not access_token:
            return HttpResponseRedirect(f"/api/login?error=missing_access_token")
        
        # Get user info from OIDC userinfo endpoint
        userinfo_response = requests.get(
            'https://replit.com/oauth/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        
        if userinfo_response.status_code != 200:
            return HttpResponseRedirect(f"/api/login?error=userinfo_failed")
        
        user_info = userinfo_response.json()
        
        # Extract user data
        user_id = user_info.get('sub')  # Replit user ID
        email = user_info.get('email', '')
        first_name = user_info.get('given_name', '')
        last_name = user_info.get('family_name', '')
        profile_image_url = user_info.get('picture', '')
        
        if not user_id or not email:
            return HttpResponseRedirect(f"/api/login?error=missing_user_data")
        
        # Get or create user in Django
        user, created = User.objects.get_or_create(
            replit_id=user_id,
            defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'profile_image_url': profile_image_url,
            }
        )
        
        # Update user data if not created
        if not created:
            updated = False
            if user.email != email:
                user.email = email
                updated = True
            if user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if user.last_name != last_name:
                user.last_name = last_name
                updated = True
            if user.profile_image_url != profile_image_url:
                user.profile_image_url = profile_image_url
                updated = True
            if updated:
                user.save()
        
        # Log the user into Django session
        login(request, user)
        
        # Redirect back to frontend home page
        return HttpResponseRedirect("/")
        
    except Exception as e:
        return HttpResponseRedirect(f"/api/login?error=callback_failed&message={str(e)}")