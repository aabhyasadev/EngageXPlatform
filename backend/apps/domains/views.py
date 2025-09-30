from rest_framework import status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.domains.models import Domain
from apps.domains.serializers import DomainSerializer
from apps.common.viewsets import BaseOrganizationViewSet
from apps.common.tasks import verify_domain_dns
from apps.subscriptions.subscription_views import (
    check_subscription_active, check_feature_available,
    check_usage_limit, update_usage_tracking
)


class DomainViewSet(BaseOrganizationViewSet):
    queryset = Domain.objects.all()
    serializer_class = DomainSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status']
    search_fields = ['domain']
    
    def create(self, request, *args, **kwargs):
        """Create a new domain with multi-domain check"""
        if not request.user.organization:
            return Response({
                'error': 'No organization found'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Check domain limit
        limit_check = check_usage_limit(request.user.organization, 'domains')
        if not limit_check['allowed']:
            # Check if white labeling is available for unlimited domains
            if not check_feature_available(request.user.organization, 'has_white_labeling'):
                return Response({
                    'error': limit_check['reason'],
                    'code': 'DOMAIN_LIMIT_REACHED',
                    'current': limit_check['current'],
                    'limit': limit_check['limit'],
                    'note': 'Upgrade to Premium for unlimited custom domains',
                    'upgrade_url': '/subscription/upgrade'
                }, status=status.HTTP_403_FORBIDDEN)
        
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Trigger domain verification with subscription check"""
        domain = self.get_object()
        
        # Check if subscription is active
        if not check_subscription_active(request.user.organization):
            return Response({
                'error': 'Active subscription required for domain verification',
                'code': 'SUBSCRIPTION_REQUIRED',
                'upgrade_url': '/subscription/plans'
            }, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        verify_domain_dns.delay(domain.id)
        
        # Update usage tracking
        update_usage_tracking(request.user.organization, 'domains')
        
        return Response({'message': 'Domain verification started'})

    @action(detail=True, methods=['post'])
    def generate_dns_records(self, request, pk=None):
        """Generate DNS records for domain"""
        domain = self.get_object()
        
        # Generate DNS records (simplified)
        txt_record = f"engagex-verification={domain.id}"
        dkim_record = f"v=DKIM1; k=rsa; p=..."  # Would be actual DKIM key
        cname_record = "engagex.tracking.domain.com"
        dmarc_record = "v=DMARC1; p=none; rua=mailto:dmarc@engagex.com"
        
        domain.txt_record = txt_record
        domain.dkim_record = dkim_record
        domain.cname_record = cname_record
        domain.dmarc_record = dmarc_record
        domain.save()
        
        serializer = self.get_serializer(domain)
        return Response(serializer.data)
