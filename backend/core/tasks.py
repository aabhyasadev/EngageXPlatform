from celery import shared_task
from django.utils import timezone
from django.db import transaction
import dns.resolver
import logging
import sendgrid
from sendgrid.helpers.mail import Mail
from django.conf import settings
from .models import (
    Domain, Campaign, CampaignRecipient, Contact, AnalyticsEvent,
    Organization, SubscriptionPlan, SubscriptionStatus
)
from datetime import timedelta

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
        
        # Parse CSV data with flexible column handling
        csv_input = io.StringIO(csv_data)
        
        # Try to detect if the CSV has headers
        sample = csv_input.read(1024)
        csv_input.seek(0)
        sniffer = csv.Sniffer()
        has_header = sniffer.has_header(sample)
        
        if has_header:
            csv_reader = csv.DictReader(csv_input)
            # Get the actual headers from the CSV
            headers = csv_reader.fieldnames or []
            
            # Create a mapping of common column variations to our expected fields
            header_mapping = {}
            for header in headers:
                header_lower = header.lower().strip()
                if any(x in header_lower for x in ['email', 'e-mail', 'mail']):
                    header_mapping['email'] = header
                elif any(x in header_lower for x in ['first', 'fname', 'given']):
                    header_mapping['first_name'] = header
                elif any(x in header_lower for x in ['last', 'lname', 'surname', 'family']):
                    header_mapping['last_name'] = header
                elif any(x in header_lower for x in ['phone', 'tel', 'mobile', 'cell']):
                    header_mapping['phone'] = header
                elif any(x in header_lower for x in ['lang', 'language']):
                    header_mapping['language'] = header
        else:
            # No headers - assume standard order: first_name, last_name, email, phone
            csv_reader = csv.reader(csv_input)
            header_mapping = {'positional': True}
        
        created_count = 0
        updated_count = 0
        error_count = 0
        
        for row in csv_reader:
            try:
                if header_mapping.get('positional'):
                    # Handle CSV without headers (positional columns)
                    if len(row) < 3:  # Need at least first_name, last_name, email
                        error_count += 1
                        continue
                    email = row[2].strip().lower() if len(row) > 2 else ''
                    first_name = row[0].strip() if len(row) > 0 else ''
                    last_name = row[1].strip() if len(row) > 1 else ''
                    phone = row[3].strip() if len(row) > 3 else ''
                    language = row[4].strip() if len(row) > 4 else 'en'
                else:
                    # Handle CSV with headers
                    email = row.get(header_mapping.get('email', ''), '').strip().lower()
                    first_name = row.get(header_mapping.get('first_name', ''), '').strip()
                    last_name = row.get(header_mapping.get('last_name', ''), '').strip()
                    phone = row.get(header_mapping.get('phone', ''), '').strip()
                    language = row.get(header_mapping.get('language', ''), 'en').strip() or 'en'
                
                if not email:
                    error_count += 1
                    continue
                
                contact, created = Contact.objects.get_or_create(
                    organization=organization,
                    email=email,
                    defaults={
                        'first_name': first_name,
                        'last_name': last_name,
                        'phone': phone,
                        'language': language,
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    # Update existing contact
                    contact.first_name = first_name or contact.first_name
                    contact.last_name = last_name or contact.last_name
                    contact.phone = phone or contact.phone
                    contact.language = language or contact.language
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


# Scheduled tasks for subscription notifications
@shared_task
def check_trial_expirations():
    """Check for expiring trials and send reminders at 7 days and 1 day before expiry"""
    from .notifications import send_trial_expiry_reminder
    
    try:
        now = timezone.now()
        
        # Check for trials expiring in 7 days
        seven_days_from_now = now + timedelta(days=7)
        orgs_7_days = Organization.objects.filter(
            subscription_plan=SubscriptionPlan.FREE_TRIAL,
            trial_ends_at__date=seven_days_from_now.date(),
            is_subscription_active=True
        )
        
        for org in orgs_7_days:
            try:
                send_trial_expiry_reminder(org, 7)
                logger.info(f"Sent 7-day trial expiry reminder to org {org.id}")
            except Exception as e:
                logger.error(f"Failed to send 7-day reminder to org {org.id}: {str(e)}")
        
        # Check for trials expiring tomorrow
        tomorrow = now + timedelta(days=1)
        orgs_1_day = Organization.objects.filter(
            subscription_plan=SubscriptionPlan.FREE_TRIAL,
            trial_ends_at__date=tomorrow.date(),
            is_subscription_active=True
        )
        
        for org in orgs_1_day:
            try:
                send_trial_expiry_reminder(org, 1)
                logger.info(f"Sent 1-day trial expiry reminder to org {org.id}")
            except Exception as e:
                logger.error(f"Failed to send 1-day reminder to org {org.id}: {str(e)}")
        
        # Check for expired trials
        expired_orgs = Organization.objects.filter(
            subscription_plan=SubscriptionPlan.FREE_TRIAL,
            trial_ends_at__lt=now,
            is_subscription_active=True
        )
        
        for org in expired_orgs:
            try:
                # Mark subscription as inactive
                org.is_subscription_active = False
                org.subscription_status = SubscriptionStatus.CANCELED
                org.save()
                
                # Send trial ended notification
                from .notifications import send_cancellation_notification
                send_cancellation_notification(org)
                logger.info(f"Marked trial as expired for org {org.id}")
            except Exception as e:
                logger.error(f"Failed to process expired trial for org {org.id}: {str(e)}")
        
        return {
            '7_days_reminders': orgs_7_days.count(),
            '1_day_reminders': orgs_1_day.count(),
            'expired_trials': expired_orgs.count()
        }
        
    except Exception as e:
        logger.error(f"Error in check_trial_expirations: {str(e)}")
        return {'error': str(e)}


@shared_task
def check_subscription_expirations():
    """Check for expiring subscriptions and send reminders at 3 days and 1 day before expiry"""
    from .notifications import send_subscription_expiry_reminder
    
    try:
        now = timezone.now()
        
        # Check for subscriptions expiring in 3 days
        three_days_from_now = now + timedelta(days=3)
        orgs_3_days = Organization.objects.filter(
            subscription_ends_at__date=three_days_from_now.date(),
            is_subscription_active=True,
            cancel_at_period_end=True
        ).exclude(subscription_plan=SubscriptionPlan.FREE_TRIAL)
        
        for org in orgs_3_days:
            try:
                send_subscription_expiry_reminder(org, 3)
                logger.info(f"Sent 3-day subscription expiry reminder to org {org.id}")
            except Exception as e:
                logger.error(f"Failed to send 3-day reminder to org {org.id}: {str(e)}")
        
        # Check for subscriptions expiring tomorrow
        tomorrow = now + timedelta(days=1)
        orgs_1_day = Organization.objects.filter(
            subscription_ends_at__date=tomorrow.date(),
            is_subscription_active=True,
            cancel_at_period_end=True
        ).exclude(subscription_plan=SubscriptionPlan.FREE_TRIAL)
        
        for org in orgs_1_day:
            try:
                send_subscription_expiry_reminder(org, 1)
                logger.info(f"Sent 1-day subscription expiry reminder to org {org.id}")
            except Exception as e:
                logger.error(f"Failed to send 1-day reminder to org {org.id}: {str(e)}")
        
        # Check for expired subscriptions
        expired_orgs = Organization.objects.filter(
            subscription_ends_at__lt=now,
            is_subscription_active=True
        ).exclude(subscription_plan=SubscriptionPlan.FREE_TRIAL)
        
        for org in expired_orgs:
            try:
                # Mark subscription as inactive
                org.is_subscription_active = False
                org.subscription_status = SubscriptionStatus.CANCELED
                org.save()
                logger.info(f"Marked subscription as expired for org {org.id}")
            except Exception as e:
                logger.error(f"Failed to process expired subscription for org {org.id}: {str(e)}")
        
        return {
            '3_days_reminders': orgs_3_days.count(),
            '1_day_reminders': orgs_1_day.count(),
            'expired_subscriptions': expired_orgs.count()
        }
        
    except Exception as e:
        logger.error(f"Error in check_subscription_expirations: {str(e)}")
        return {'error': str(e)}


@shared_task
def send_usage_limit_warnings():
    """Send warnings when organizations are approaching their usage limits"""
    from .notifications import create_notification
    from .models import NotificationType, NotificationChannel
    
    try:
        # Check organizations approaching contact limits (90% threshold)
        orgs = Organization.objects.filter(
            is_subscription_active=True
        )
        
        warnings_sent = 0
        
        for org in orgs:
            try:
                # Check contacts limit
                contact_count = org.contacts.count()
                contact_limit = org.contacts_limit
                
                if contact_limit > 0:
                    usage_percentage = (contact_count / contact_limit) * 100
                    
                    if usage_percentage >= 90 and usage_percentage < 100:
                        # Send warning notification
                        create_notification(
                            organization=org,
                            notification_type=NotificationType.LIMIT_WARNING,
                            channel=NotificationChannel.IN_APP,
                            metadata={
                                'resource': 'contacts',
                                'current': contact_count,
                                'limit': contact_limit,
                                'percentage': usage_percentage
                            }
                        )
                        warnings_sent += 1
                        logger.info(f"Sent contact limit warning to org {org.id}")
                
                # Check campaigns limit
                campaign_count = org.campaigns.count()
                campaign_limit = org.campaigns_limit
                
                if campaign_limit > 0:
                    usage_percentage = (campaign_count / campaign_limit) * 100
                    
                    if usage_percentage >= 90 and usage_percentage < 100:
                        # Send warning notification
                        create_notification(
                            organization=org,
                            notification_type=NotificationType.LIMIT_WARNING,
                            channel=NotificationChannel.IN_APP,
                            metadata={
                                'resource': 'campaigns',
                                'current': campaign_count,
                                'limit': campaign_limit,
                                'percentage': usage_percentage
                            }
                        )
                        warnings_sent += 1
                        logger.info(f"Sent campaign limit warning to org {org.id}")
                        
            except Exception as e:
                logger.error(f"Failed to check limits for org {org.id}: {str(e)}")
        
        return {'warnings_sent': warnings_sent}
        
    except Exception as e:
        logger.error(f"Error in send_usage_limit_warnings: {str(e)}")
        return {'error': str(e)}