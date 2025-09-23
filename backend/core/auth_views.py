from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.middleware.csrf import get_token

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




