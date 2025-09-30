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
    Get current authenticated user with multi-organization support
    """
    # Check if user is authenticated first
    if not request.user.is_authenticated:
        return Response({
            'detail': 'Not authenticated'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        from .models import OrganizationMembership, MembershipStatus
        
        user = request.user
        
        # Get all available organizations for this user
        available_memberships = OrganizationMembership.objects.filter(
            user=user,
            status=MembershipStatus.ACTIVE
        ).select_related('organization')
        
        # Get current organization from session
        current_organization_id = request.session.get('current_organization_id')
        current_membership = None
        current_organization = None
        
        if current_organization_id:
            current_membership = available_memberships.filter(
                organization_id=current_organization_id
            ).first()
            
        # If no current org in session or invalid, use the first available
        if not current_membership and available_memberships.exists():
            current_membership = available_memberships.first()
            request.session['current_organization_id'] = str(current_membership.organization.id)
            request.session['current_membership_id'] = str(current_membership.id)
        
        if current_membership:
            current_organization = current_membership.organization
        
        # Manual serialization to avoid UserSerializer issues
        user_data = {
            'id': str(user.id) if hasattr(user, 'id') else None,
            'email': getattr(user, 'email', ''),
            'first_name': getattr(user, 'first_name', ''),
            'last_name': getattr(user, 'last_name', ''),
            'profile_image_url': getattr(user, 'profile_image_url', ''),
            'role': current_membership.role if current_membership else 'user',
            'is_active': getattr(user, 'is_active', True),
        }
        
        # Add current organization info
        if current_organization:
            user_data['organization'] = {
                'id': str(current_organization.id),
                'name': current_organization.name,
                'industry': current_organization.industry,
                'employeesRange': current_organization.employees_range,
                'contactsRange': current_organization.contacts_range,
                'trialEndsAt': current_organization.trial_ends_at.isoformat() if current_organization.trial_ends_at else None,
            }
        else:
            user_data['organization'] = None
        
        # Add available organizations for switching
        user_data['availableOrganizations'] = []
        for membership in available_memberships:
            user_data['availableOrganizations'].append({
                'id': str(membership.organization.id),
                'name': membership.organization.name,
                'role': membership.role,
                'isCurrent': current_organization and membership.organization.id == current_organization.id
            })
            
        return Response(user_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Failed to get user: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_organization(request):
    """Switch to a different organization"""
    organization_id = request.data.get('organization_id')
    
    if not organization_id:
        return Response({
            'error': 'Organization ID is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .models import OrganizationMembership, MembershipStatus
        
        # Verify user has active membership in the requested organization
        membership = OrganizationMembership.objects.filter(
            user=request.user,
            organization_id=organization_id,
            status=MembershipStatus.ACTIVE
        ).select_related('organization').first()
        
        if not membership:
            return Response({
                'error': 'You do not have access to this organization'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Update session with new organization context
        request.session['current_organization_id'] = organization_id
        request.session['current_membership_id'] = str(membership.id)
        
        return Response({
            'message': 'Organization switched successfully',
            'organization': {
                'id': str(membership.organization.id),
                'name': membership.organization.name,
                'role': membership.role
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Failed to switch organization: {str(e)}'
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




