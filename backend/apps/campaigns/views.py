from apps.contacts.models import Contact
from rest_framework import status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.common.tasks import send_campaign_emails
from apps.common.viewsets import BaseOrganizationViewSet
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from apps.campaigns.models import Campaign, CampaignRecipient
from apps.campaigns.serializers import CampaignSerializer, CampaignSendSerializer
from apps.subscriptions.subscription_views import (check_subscription_active, check_feature_available, check_usage_limit, get_current_usage, update_usage_tracking)


class DefaultPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CampaignViewSet(BaseOrganizationViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'subject']
    ordering_fields = ['created_at', 'sent_at', 'name']
    ordering = ['-created_at']
    pagination_class = DefaultPagination
    
    def create(self, request, *args, **kwargs):
        """Create a new campaign with subscription limit check"""
        import logging
        logger = logging.getLogger('django')
        
        logger.error(f"=== CAMPAIGN CREATION DEBUG ===")
        logger.error(f"User: {request.user.id} - {request.user.email}")
        logger.error(f"User organization: {request.user.organization}")  
        logger.error(f"Request data: {request.data}")
        
        if not request.user.organization:
            logger.error("No organization found for user")
            return Response({'error': 'No organization found'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check campaign limit
        limit_check = check_usage_limit(request.user.organization, 'campaigns')
        if not limit_check['allowed']:
            logger.error(f"Campaign limit reached: {limit_check}")
            return Response({
                'error': limit_check['reason'],
                'code': 'CAMPAIGN_LIMIT_REACHED',
                'current': limit_check['current'],
                'limit': limit_check['limit'],
                'upgrade_url': '/subscription/upgrade'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Check A/B testing feature if it's an A/B test campaign
        if request.data.get('is_ab_test', False):
            if not check_feature_available(request.user.organization, 'has_ab_testing'):
                logger.error("A/B testing not available")
                return Response({
                    'error': 'A/B testing is not available in your current plan',
                    'code': 'FEATURE_NOT_AVAILABLE',
                    'feature': 'has_ab_testing',
                    'upgrade_url': '/subscription/upgrade'
                }, status=status.HTTP_403_FORBIDDEN)
        
        # Create the campaign
        try:
            logger.error("About to call super().create()")
            response = super().create(request, *args, **kwargs)
            logger.error(f"Super create response: {response.status_code}")
            if hasattr(response, 'data'):
                logger.error(f"Response data: {response.data}")
            
            # Update usage tracking if successful
            if response.status_code == 201:
                update_usage_tracking(request.user.organization, 'campaigns')
                logger.error("Campaign created successfully!")
            
            return response
        except Exception as e:
            logger.error(f"Exception in campaign creation: {str(e)}")
            logger.error(f"Exception type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response({'error': f'Campaign creation failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send campaign emails with subscription and email limit checks"""
        campaign = self.get_object()
        
        # Check subscription is active
        if not check_subscription_active(request.user.organization):
            return Response({
                'error': 'Active subscription required to send campaigns',
                'code': 'SUBSCRIPTION_REQUIRED',
                'upgrade_url': '/subscription/plans'
            }, status=status.HTTP_402_PAYMENT_REQUIRED)
        
        if campaign.status != 'draft':
            return Response(
                {'error': 'Campaign must be in draft status to send'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CampaignSendSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            # Get recipient contacts
            contacts = Contact.objects.filter(
                organization=self.request.user.organization,
                is_subscribed=True
            )
            
            if data.get('send_all'):
                # Send to all subscribed contacts
                pass
            elif data.get('contact_ids'):
                contacts = contacts.filter(id__in=data['contact_ids'])
            elif data.get('group_ids'):
                contacts = contacts.filter(
                    group_memberships__group_id__in=data['group_ids']
                ).distinct()
            
            # Check monthly email limit before sending
            recipient_count = contacts.count()
            usage = get_current_usage(request.user.organization)
            limit_check = check_usage_limit(request.user.organization, 'emails')
            
            # Check if sending would exceed limit
            if usage['emails_sent'] + recipient_count > limit_check.get('limit', 0):
                return Response({
                    'error': f'Sending this campaign would exceed your monthly email limit',
                    'code': 'EMAIL_LIMIT_EXCEEDED',
                    'current': usage['emails_sent'],
                    'would_send': recipient_count,
                    'limit': limit_check.get('limit', 0),
                    'upgrade_url': '/subscription/upgrade'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Create campaign recipients
            recipients = []
            for contact in contacts:
                recipients.append(
                    CampaignRecipient(
                        campaign=campaign,
                        contact=contact,
                        status='pending'
                    )
                )
            
            CampaignRecipient.objects.bulk_create(recipients, ignore_conflicts=True)
            
            # Update campaign statistics
            campaign.total_recipients = len(recipients)
            campaign.save()
            
            # Start sending emails asynchronously
            send_campaign_emails.delay(campaign.id)
            
            # Update usage tracking for emails
            update_usage_tracking(request.user.organization, 'emails', len(recipients))
            
            return Response({
                'message': f'Campaign queued for sending to {len(recipients)} recipients',
                'recipients': len(recipients),
                'usage': {
                    'emails_sent_before': usage['emails_sent'],
                    'emails_sent_after': usage['emails_sent'] + len(recipients),
                    'monthly_limit': limit_check.get('limit', 0)
                }
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a campaign with limit check"""
        # Check campaign limit before duplication
        limit_check = check_usage_limit(request.user.organization, 'campaigns')
        if not limit_check['allowed']:
            return Response({
                'error': limit_check['reason'],
                'code': 'CAMPAIGN_LIMIT_REACHED',
                'current': limit_check['current'],
                'limit': limit_check['limit'],
                'upgrade_url': '/subscription/upgrade'
            }, status=status.HTTP_403_FORBIDDEN)
        
        original_campaign = self.get_object()
        
        # Create copy
        new_campaign = Campaign(
            organization=original_campaign.organization,
            name=f"{original_campaign.name} (Copy)",
            subject=original_campaign.subject,
            from_email=original_campaign.from_email,
            from_name=original_campaign.from_name,
            reply_to_email=original_campaign.reply_to_email,
            html_content=original_campaign.html_content,
            text_content=original_campaign.text_content,
            created_by=self.request.user,
            status='draft'
        )
        new_campaign.save()
        
        # Update usage tracking
        update_usage_tracking(request.user.organization, 'campaigns')
        
        serializer = self.get_serializer(new_campaign)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
