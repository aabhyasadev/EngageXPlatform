from celery import shared_task
from django.utils import timezone
from django.db import transaction
import dns.resolver
import logging
import sendgrid
from sendgrid.helpers.mail import Mail
from django.conf import settings
from .models import Domain, Campaign, CampaignRecipient, Contact, AnalyticsEvent

logger = logging.getLogger(__name__)


@shared_task
def verify_domains_task():
    """Periodic task to verify pending domains"""
    pending_domains = Domain.objects.filter(status='pending')
    
    for domain in pending_domains:
        verify_domain_dns.delay(domain.id)
    
    return f"Started verification for {pending_domains.count()} domains"


@shared_task
def verify_domain_dns(domain_id):
    """Verify DNS records for a specific domain"""
    try:
        domain = Domain.objects.get(id=domain_id)
        
        # Check TXT record for domain verification
        if domain.txt_record:
            try:
                txt_records = dns.resolver.resolve(domain.domain, 'TXT')
                for record in txt_records:
                    if domain.txt_record in str(record):
                        domain.status = 'verified'
                        domain.verified_at = timezone.now()
                        domain.save()
                        logger.info(f"Domain {domain.domain} verified successfully")
                        return f"Domain {domain.domain} verified"
            except dns.resolver.NXDOMAIN:
                logger.warning(f"Domain {domain.domain} not found in DNS")
            except dns.resolver.NoAnswer:
                logger.warning(f"No TXT records found for {domain.domain}")
            except Exception as e:
                logger.error(f"DNS verification failed for {domain.domain}: {str(e)}")
                
        # If verification fails, update timestamp but keep pending status
        domain.save()
        
    except Domain.DoesNotExist:
        logger.error(f"Domain with id {domain_id} not found")
    
    return f"Domain verification completed for {domain_id}"


@shared_task
def send_campaign_emails(campaign_id):
    """Send emails for a campaign"""
    try:
        campaign = Campaign.objects.get(id=campaign_id)
        
        if campaign.status != 'draft':
            return f"Campaign {campaign.name} is not in draft status"
        
        # Get recipients
        recipients = CampaignRecipient.objects.filter(
            campaign=campaign,
            status='pending'
        ).select_related('contact')
        
        if not recipients.exists():
            return f"No recipients found for campaign {campaign.name}"
        
        # Update campaign status
        campaign.status = 'sending'
        campaign.save()
        
        # Send emails in batches
        batch_size = 50
        recipients_list = list(recipients)
        
        for i in range(0, len(recipients_list), batch_size):
            batch = recipients_list[i:i + batch_size]
            send_email_batch.delay(campaign_id, [r.id for r in batch])
        
        return f"Started sending {len(recipients_list)} emails for campaign {campaign.name}"
        
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with id {campaign_id} not found")
        return f"Campaign {campaign_id} not found"


@shared_task
def send_email_batch(campaign_id, recipient_ids):
    """Send a batch of emails for a campaign"""
    try:
        campaign = Campaign.objects.get(id=campaign_id)
        recipients = CampaignRecipient.objects.filter(
            id__in=recipient_ids
        ).select_related('contact')
        
        if not settings.SENDGRID_API_KEY:
            logger.error("SendGrid API key not configured")
            return "SendGrid API key not configured"
        
        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        
        success_count = 0
        error_count = 0
        
        for recipient in recipients:
            try:
                # Prepare email content with variable substitution
                html_content = campaign.html_content or ""
                text_content = campaign.text_content or ""
                subject = campaign.subject
                
                # Simple variable substitution
                contact = recipient.contact
                substitutions = {
                    '{{firstName}}': contact.first_name or '',
                    '{{lastName}}': contact.last_name or '',
                    '{{email}}': contact.email,
                    '{{organizationName}}': campaign.organization.name,
                }
                
                for placeholder, value in substitutions.items():
                    html_content = html_content.replace(placeholder, value)
                    text_content = text_content.replace(placeholder, value)
                    subject = subject.replace(placeholder, value)
                
                # Create email
                mail = Mail(
                    from_email=campaign.from_email,
                    to_emails=contact.email,
                    subject=subject,
                    html_content=html_content,
                    plain_text_content=text_content
                )
                
                # Send email
                response = sg.send(mail)
                
                if response.status_code in [200, 202]:
                    recipient.status = 'sent'
                    recipient.sent_at = timezone.now()
                    success_count += 1
                    
                    # Create analytics event
                    AnalyticsEvent.objects.create(
                        organization=campaign.organization,
                        campaign=campaign,
                        contact=contact,
                        event_type='send'
                    )
                else:
                    recipient.status = 'failed'
                    error_count += 1
                
                recipient.save()
                
            except Exception as e:
                logger.error(f"Failed to send email to {recipient.contact.email}: {str(e)}")
                recipient.status = 'failed'
                recipient.save()
                error_count += 1
        
        # Update campaign statistics
        with transaction.atomic():
            campaign.total_sent += success_count
            campaign.save()
        
        return f"Batch completed: {success_count} sent, {error_count} failed"
        
    except Campaign.DoesNotExist:
        logger.error(f"Campaign with id {campaign_id} not found")
        return f"Campaign {campaign_id} not found"


@shared_task
def process_analytics_task():
    """Process analytics and update campaign statistics"""
    # This would typically process webhook data from SendGrid
    # For now, we'll just update existing campaign stats
    
    campaigns = Campaign.objects.filter(status__in=['sent', 'sending'])
    
    for campaign in campaigns:
        # Count analytics events
        total_opened = AnalyticsEvent.objects.filter(
            campaign=campaign,
            event_type='open'
        ).values('contact').distinct().count()
        
        total_clicked = AnalyticsEvent.objects.filter(
            campaign=campaign,
            event_type='click'
        ).values('contact').distinct().count()
        
        total_bounced = AnalyticsEvent.objects.filter(
            campaign=campaign,
            event_type='bounce'
        ).values('contact').distinct().count()
        
        total_unsubscribed = AnalyticsEvent.objects.filter(
            campaign=campaign,
            event_type='unsubscribe'
        ).values('contact').distinct().count()
        
        # Update campaign statistics
        campaign.total_opened = total_opened
        campaign.total_clicked = total_clicked
        campaign.total_bounced = total_bounced
        campaign.total_unsubscribed = total_unsubscribed
        campaign.save()
    
    return f"Processed analytics for {campaigns.count()} campaigns"


@shared_task
def import_contacts_from_csv(organization_id, csv_data, user_id):
    """Background task to import contacts from CSV data"""
    from .models import Organization, User
    import csv
    import io
    
    try:
        organization = Organization.objects.get(id=organization_id)
        user = User.objects.get(id=user_id)
        
        # Parse CSV data
        csv_reader = csv.DictReader(io.StringIO(csv_data))
        
        created_count = 0
        updated_count = 0
        error_count = 0
        
        for row in csv_reader:
            try:
                email = row.get('email', '').strip().lower()
                if not email:
                    error_count += 1
                    continue
                
                contact, created = Contact.objects.get_or_create(
                    organization=organization,
                    email=email,
                    defaults={
                        'first_name': row.get('first_name', '').strip(),
                        'last_name': row.get('last_name', '').strip(),
                        'phone': row.get('phone', '').strip(),
                        'language': row.get('language', 'en').strip(),
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    # Update existing contact
                    contact.first_name = row.get('first_name', contact.first_name)
                    contact.last_name = row.get('last_name', contact.last_name)
                    contact.phone = row.get('phone', contact.phone)
                    contact.language = row.get('language', contact.language)
                    contact.save()
                    updated_count += 1
                    
            except Exception as e:
                logger.error(f"Error importing contact row {row}: {str(e)}")
                error_count += 1
        
        return {
            'created': created_count,
            'updated': updated_count,
            'errors': error_count,
            'total': created_count + updated_count + error_count
        }
        
    except (Organization.DoesNotExist, User.DoesNotExist) as e:
        logger.error(f"Import failed: {str(e)}")
        return {'error': str(e)}