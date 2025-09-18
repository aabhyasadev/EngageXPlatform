from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import UserSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_user(request):
    """
    Get current authenticated user - matches Express /api/auth/user endpoint
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


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