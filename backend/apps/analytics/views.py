from apps.contacts.models import Contact
from apps.campaigns.models import Campaign
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, filters
from django.db.models import Sum, Avg, Max, Min
from apps.analytics.models import AnalyticsEvent
from rest_framework.permissions import IsAuthenticated
from apps.common.viewsets import BaseOrganizationViewSet
from apps.common.middleware import requires_plan_feature
from django_filters.rest_framework import DjangoFilterBackend
from apps.analytics.serializers import AnalyticsEventSerializer, DashboardStatsSerializer


class AnalyticsEventViewSet(BaseOrganizationViewSet):
    queryset = AnalyticsEvent.objects.all()
    serializer_class = AnalyticsEventSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['event_type', 'campaign']
    ordering = ['-created_at']
    
    @action(detail=False, methods=['get'])
    @requires_plan_feature('has_advanced_analytics')
    def advanced_reports(self, request):
        """Get advanced analytics reports - Pro/Premium feature"""
        org = request.user.organization
        
        campaign_stats = Campaign.objects.filter(organization=org).aggregate(
            avg_open_rate=Avg('open_rate'),
            avg_click_rate=Avg('click_rate'),
            max_open_rate=Max('open_rate'),
            min_open_rate=Min('open_rate')
        )
        
        return Response({
            'message': 'Advanced analytics available',
            'reports': campaign_stats
        })
    
    @action(detail=False, methods=['get'])
    def basic_reports(self, request):
        """Get basic analytics reports - available to all plans"""
        org = request.user.organization
        
        total_sent = Campaign.objects.filter(organization=org).aggregate(
            total=Sum('total_sent')
        )['total'] or 0
        
        return Response({
            'message': 'Basic analytics',
            'total_sent': total_sent
        })


class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get dashboard statistics"""
        if not request.user.organization:
            return Response({'error': 'No organization found'}, status=400)
        
        org = request.user.organization
        
        total_contacts = Contact.objects.filter(organization=org).count()
        active_campaigns = Campaign.objects.filter(
            organization=org,
            status__in=['sending', 'scheduled']
        ).count()
        
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
        
        stats_data = {
            'total_contacts': total_contacts,
            'active_campaigns': active_campaigns,
            'total_sent': total_sent,
            'total_opened': total_opened,
            'total_clicked': total_clicked,
            'open_rate': round(open_rate, 2),
            'click_rate': round(click_rate, 2)
        }
        
        serializer = DashboardStatsSerializer(stats_data)
        return Response(serializer.data)
