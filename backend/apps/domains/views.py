import logging
import dns.resolver
from django.utils import timezone
from rest_framework import status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.domains.models import Domain
from apps.domains.serializers import DomainSerializer
from apps.common.viewsets import BaseOrganizationViewSet
from apps.subscriptions.subscription_views import (check_subscription_active, check_feature_available, check_usage_limit, update_usage_tracking)

logger = logging.getLogger(__name__)

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

        if not check_subscription_active(request.user.organization):
            return Response({
                'error': 'Active subscription required for domain verification',
                'code': 'SUBSCRIPTION_REQUIRED',
                'upgrade_url': '/subscription/plans'
            }, status=status.HTTP_402_PAYMENT_REQUIRED)

        try:
            if domain.txt_record:
                try:
                    txt_records = dns.resolver.resolve(domain.domain, 'TXT')
                    for record in txt_records:
                        if domain.txt_record in str(record):
                            domain.status = 'verified'
                            domain.verified_at = timezone.now()
                            domain.save()
                            logger.info(f"Domain {domain.domain} verified successfully")
                            update_usage_tracking(request.user.organization, 'domains')
                            return Response({'message': f"Domain {domain.domain} verified"})

                    # TXT record not found in the domain's DNS records
                    return Response({
                        'error': f'TXT record not found for {domain.domain}',
                        'code': 'TXT_RECORD_NOT_FOUND'
                    }, status=status.HTTP_400_BAD_REQUEST)

                except dns.resolver.NXDOMAIN:
                    logger.warning(f"Domain {domain.domain} not found in DNS")
                    return Response({
                        'error': f"Domain {domain.domain} not found in DNS",
                        'code': 'NXDOMAIN'
                    }, status=status.HTTP_404_NOT_FOUND)

                except dns.resolver.NoAnswer:
                    logger.warning(f"No TXT records found for {domain.domain}")
                    return Response({
                        'error': f"No TXT records found for {domain.domain}",
                        'code': 'NO_TXT_RECORDS'
                    }, status=status.HTTP_400_BAD_REQUEST)

                except Exception as e:
                    logger.error(f"DNS verification failed for {domain.domain}: {str(e)}")
                    return Response({
                        'error': f"DNS verification failed: {str(e)}",
                        'code': 'DNS_ERROR'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # No TXT record configured for this domain
            return Response({
                'error': 'No TXT record configured for this domain',
                'code': 'TXT_NOT_CONFIGURED'
            }, status=status.HTTP_400_BAD_REQUEST)

        except Domain.DoesNotExist:
            logger.error(f"Domain with id {pk} not found")
            return Response({'error': 'Domain not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def generate_dns_records(self, request, pk=None):
        """Generate DNS records for domain"""
        domain = self.get_object()
        
        # Generate DNS records (simplified)
        txt_record = f"v=spf1 include:_spf.google.com ip4:173.201.37.37 ~all"
        dkim_record = f"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwPzFKV4pVZiFeGjvVuJ3wEsqMrRjeRFQ5LKO7PSMxT6STwxRKZRA/5DHaNOFxrU4RmJ4fYuVtBQB7wscQEXMmhpWiPT4naPDSqUOV+20aZ/OI/FdjjHjeY4R4fFZYXO0xtm59BMXrM7SJVrz2cQd0oyWXs9wOvAOHLOkoUpczfbVmJcqpa7iaLs6lUA+EgGRhal9l5LY6bOWDIRy4v6nCXT8OUl9ydUgbzilbnbV5exOcwrfm/Pxx9Ie6UfYEzXMYI9THBPN4yWnJWbLYcJEiWK2kWOPycQJRq/RLTxO678FV0m7SWMEzGFiNuFnbvfUXWd23Kix9KEpHV9SKj5eiwIDAQAB"  # Would be actual DKIM key
        # cname_record = "engagex.tracking.domain.com"
        dmarc_record = "v=DMARC1; p=none; rua=mailto:postmaster@smtpware.com"
        
        domain.txt_record = txt_record
        domain.dkim_record = dkim_record
        # domain.cname_record = cname_record
        domain.dmarc_record = dmarc_record
        domain.save()
        
        serializer = self.get_serializer(domain)
        return Response(serializer.data)
