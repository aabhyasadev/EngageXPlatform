"""
Notification system for subscription events
"""
import logging
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from django.template.loader import render_to_string
from .models import (
    SubscriptionNotification, Organization, User, 
    NotificationType, NotificationChannel, NotificationStatus,
    SubscriptionPlan, Invitation
)
from django.core.mail import EmailMultiAlternatives, send_mail
from django.urls import reverse

logger = logging.getLogger(__name__)

# Email templates for different notification types
EMAIL_TEMPLATES = {
    NotificationType.TRIAL_ENDING: {
        'subject': 'Your EngageX trial expires in {days_remaining} days',
        'template_name': 'trial_ending',
        'action_button': 'Upgrade Now',
        'action_url': '/subscription',
    },
    NotificationType.TRIAL_ENDED: {
        'subject': 'Your EngageX trial has ended',
        'template_name': 'trial_ended',
        'action_button': 'Select a Plan',
        'action_url': '/subscription',
    },
    NotificationType.SUBSCRIPTION_RENEWED: {
        'subject': 'Your EngageX subscription has been renewed',
        'template_name': 'subscription_renewed',
        'action_button': 'View Details',
        'action_url': '/subscription',
    },
    NotificationType.SUBSCRIPTION_CANCELED: {
        'subject': 'Your EngageX subscription has been canceled',
        'template_name': 'subscription_canceled',
        'action_button': 'Reactivate',
        'action_url': '/subscription',
    },
    NotificationType.PAYMENT_FAILED: {
        'subject': 'Payment failed for your EngageX subscription',
        'template_name': 'payment_failed',
        'action_button': 'Update Payment Method',
        'action_url': '/subscription',
    },
    NotificationType.PAYMENT_SUCCEEDED: {
        'subject': 'Payment confirmed - Thank you!',
        'template_name': 'payment_succeeded',
        'action_button': 'View Receipt',
        'action_url': '/subscription',
    },
    NotificationType.LIMIT_WARNING: {
        'subject': 'Approaching limit on your EngageX plan',
        'template_name': 'limit_warning',
        'action_button': 'Upgrade Plan',
        'action_url': '/subscription',
    },
}

# Plan display names
PLAN_NAMES = {
    SubscriptionPlan.FREE_TRIAL: 'Free Trial',
    SubscriptionPlan.BASIC_MONTHLY: 'Basic Monthly',
    SubscriptionPlan.BASIC_YEARLY: 'Basic Yearly',
    SubscriptionPlan.PRO_MONTHLY: 'Pro Monthly',
    SubscriptionPlan.PRO_YEARLY: 'Pro Yearly',
    SubscriptionPlan.PREMIUM_MONTHLY: 'Premium Monthly',
    SubscriptionPlan.PREMIUM_YEARLY: 'Premium Yearly',
}


def send_email_notification(to_email, subject, html_content, text_content=None, metadata=None):
    """Send email notification using Django's email backend (SMTP with console fallback)"""
    try:
        # Check if email credentials are configured
        if not settings.EMAIL_HOST_USER and not settings.DEBUG:
            logger.error("Email host user not configured for production")
            return False, "Email credentials not configured"
        
        # If no email credentials in development, fallback to console
        if not settings.EMAIL_HOST_USER and settings.DEBUG:
            logger.info(f"Development mode: Email would be sent to {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"Content: {html_content[:200]}...")
            return True, None
        
        if not text_content:
            # Strip HTML tags for basic text content
            import re
            text_content = re.sub('<[^<]+?>', '', html_content)
        
        # Create email message
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email]
        )
        msg.attach_alternative(html_content, "text/html")
        
        # Send email
        msg.send(fail_silently=False)
        
        logger.info(f"Email sent successfully to {to_email}")
        return True, None
            
    except Exception as e:
        error_msg = f"Error sending email: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


def create_notification(
    organization, 
    notification_type, 
    channel=NotificationChannel.EMAIL,
    user=None,
    metadata=None
):
    """Create a notification record"""
    notification = SubscriptionNotification.objects.create(
        organization=organization,
        user=user or organization.users.filter(role='organizer').first(),
        notification_type=notification_type,
        channel=channel,
        status=NotificationStatus.PENDING,
        metadata=metadata or {}
    )
    return notification


def generate_email_content(template_name, context):
    """Generate email content from template"""
    # For now, we'll use inline HTML templates
    # In production, you'd use Django templates
    
    base_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
            .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 30px; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ background-color: #f4f4f4; padding: 20px; text-align: center; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>EngageX</h1>
            </div>
            <div class="content">
                {content}
            </div>
            <div class="footer">
                <p>© 2025 EngageX. All rights reserved.</p>
                <p>You're receiving this email because you have an account with EngageX.</p>
                <p><a href="{unsubscribe_url}">Unsubscribe</a> | <a href="{preferences_url}">Update Preferences</a></p>
            </div>
        </div>
    </body>
    </html>
    """
    
    template_content = {
        'trial_ending': """
            <h2>Your trial expires soon!</h2>
            <p>Hi {organization_name},</p>
            <p>Your free trial expires in <strong>{days_remaining} days</strong>. To continue using EngageX without interruption, please upgrade to a paid plan.</p>
            <p>Your current usage:</p>
            <ul>
                <li>Contacts: {contacts_count}</li>
                <li>Campaigns: {campaigns_count}</li>
            </ul>
            <a href="{action_url}" class="button">{action_button}</a>
            <p>If you have any questions, our support team is here to help!</p>
        """,
        'trial_ended': """
            <h2>Your free trial has ended</h2>
            <p>Hi {organization_name},</p>
            <p>Your free trial has expired. To continue using EngageX and access your data, please select a subscription plan.</p>
            <a href="{action_url}" class="button">{action_button}</a>
            <p>Your data is safe and will be available once you subscribe.</p>
        """,
        'payment_succeeded': """
            <h2>Payment Received - Thank You!</h2>
            <p>Hi {organization_name},</p>
            <p>We've successfully processed your payment of <strong>${amount}</strong> for your {plan_name} subscription.</p>
            <p>Transaction Details:</p>
            <ul>
                <li>Date: {payment_date}</li>
                <li>Amount: ${amount}</li>
                <li>Plan: {plan_name}</li>
                <li>Next billing date: {next_billing_date}</li>
            </ul>
            <a href="{action_url}" class="button">{action_button}</a>
        """,
        'payment_failed': """
            <h2>Payment Failed</h2>
            <p>Hi {organization_name},</p>
            <p>We were unable to process your payment for your {plan_name} subscription.</p>
            <p>Reason: <strong>{reason}</strong></p>
            <p>Please update your payment method to avoid service interruption.</p>
            <a href="{action_url}" class="button">{action_button}</a>
        """,
        'subscription_canceled': """
            <h2>Subscription Canceled</h2>
            <p>Hi {organization_name},</p>
            <p>Your {plan_name} subscription has been canceled as requested.</p>
            <p>You will continue to have access until <strong>{end_date}</strong>.</p>
            <p>We're sorry to see you go! If you change your mind, you can reactivate your subscription at any time.</p>
            <a href="{action_url}" class="button">{action_button}</a>
        """,
        'subscription_renewed': """
            <h2>Subscription Renewed</h2>
            <p>Hi {organization_name},</p>
            <p>Your {plan_name} subscription has been successfully renewed for another billing period.</p>
            <p>Next renewal date: <strong>{next_renewal_date}</strong></p>
            <a href="{action_url}" class="button">{action_button}</a>
        """,
        'plan_changed': """
            <h2>Subscription Plan Changed</h2>
            <p>Hi {organization_name},</p>
            <p>Your subscription has been successfully updated:</p>
            <ul>
                <li>Previous plan: {old_plan}</li>
                <li>New plan: <strong>{new_plan}</strong></li>
            </ul>
            <p>Your new limits:</p>
            <ul>
                <li>Contacts: {contacts_limit}</li>
                <li>Campaigns: {campaigns_limit}</li>
            </ul>
            <a href="{action_url}" class="button">View Details</a>
        """,
        'subscription_expiring': """
            <h2>Subscription Expiring Soon</h2>
            <p>Hi {organization_name},</p>
            <p>Your {plan_name} subscription will expire in <strong>{days_remaining} days</strong>.</p>
            <p>To avoid any service interruption, please renew your subscription.</p>
            <a href="{action_url}" class="button">Renew Now</a>
        """
    }
    
    content_html = template_content.get(template_name, "").format(**context)
    full_html = base_html.format(
        content=content_html,
        unsubscribe_url=context.get('unsubscribe_url', '#'),
        preferences_url=context.get('preferences_url', '/settings/notifications')
    )
    
    return full_html


def send_trial_expiry_reminder(organization, days_remaining):
    """Send reminder about trial expiry"""
    try:
        # Get organization owner
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            logger.error(f"No owner found for organization {organization.id}")
            return False
        
        # Check if we already sent this notification recently (within last 24 hours)
        recent_notification = SubscriptionNotification.objects.filter(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDING,
            created_at__gte=timezone.now() - timedelta(hours=24),
            metadata__days_remaining=days_remaining
        ).exists()
        
        if recent_notification:
            logger.info(f"Trial expiry reminder already sent to {organization.name} for {days_remaining} days")
            return True
        
        # Create notification record
        metadata = {
            'days_remaining': days_remaining,
            'template': 'trial_ending',
            'contacts_count': organization.contacts.count(),
            'campaigns_count': organization.campaigns.count(),
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDING,
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        # Generate email content
        template_config = EMAIL_TEMPLATES[NotificationType.TRIAL_ENDING]
        context = {
            'organization_name': organization.name,
            'days_remaining': days_remaining,
            'contacts_count': metadata['contacts_count'],
            'campaigns_count': metadata['campaigns_count'],
            'action_button': template_config['action_button'],
            'action_url': f"{settings.FRONTEND_URL}{template_config['action_url']}",
            'unsubscribe_url': f"{settings.FRONTEND_URL}/unsubscribe?token={notification.id}",
        }
        
        html_content = generate_email_content('trial_ending', context)
        subject = template_config['subject'].format(days_remaining=days_remaining)
        
        # Send email
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=html_content,
            metadata=metadata
        )
        
        # Update notification status
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # Also create in-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDING,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending trial expiry reminder: {str(e)}")
        return False


def send_subscription_expiry_reminder(organization, days_remaining):
    """Send reminder about subscription expiry"""
    try:
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            logger.error(f"No owner found for organization {organization.id}")
            return False
        
        # Check for recent notifications
        recent_notification = SubscriptionNotification.objects.filter(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDING,
            created_at__gte=timezone.now() - timedelta(hours=24),
            metadata__days_remaining=days_remaining
        ).exists()
        
        if recent_notification:
            return True
        
        metadata = {
            'days_remaining': days_remaining,
            'plan_name': PLAN_NAMES.get(organization.subscription_plan, 'Unknown'),
            'template': 'subscription_expiring',
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDING,
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        context = {
            'organization_name': organization.name,
            'days_remaining': days_remaining,
            'plan_name': metadata['plan_name'],
            'action_button': 'Renew Now',
            'action_url': f"{settings.FRONTEND_URL}/subscription",
        }
        
        html_content = generate_email_content('subscription_expiring', context)
        subject = f"Your {metadata['plan_name']} subscription expires in {days_remaining} days"
        
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=html_content,
            metadata=metadata
        )
        
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # In-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDING,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending subscription expiry reminder: {str(e)}")
        return False


def send_payment_success_notification(organization, amount, invoice_id=None):
    """Send payment success notification"""
    try:
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            return False
        
        metadata = {
            'amount': str(amount),
            'invoice_id': invoice_id,
            'plan_name': PLAN_NAMES.get(organization.subscription_plan, 'Unknown'),
            'payment_date': timezone.now().strftime('%Y-%m-%d'),
            'next_billing_date': organization.current_period_end.strftime('%Y-%m-%d') if organization.current_period_end else 'N/A',
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.PAYMENT_SUCCEEDED,
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        template_config = EMAIL_TEMPLATES[NotificationType.PAYMENT_SUCCEEDED]
        context = {
            'organization_name': organization.name,
            'amount': amount,
            'plan_name': metadata['plan_name'],
            'payment_date': metadata['payment_date'],
            'next_billing_date': metadata['next_billing_date'],
            'action_button': template_config['action_button'],
            'action_url': f"{settings.FRONTEND_URL}{template_config['action_url']}",
        }
        
        html_content = generate_email_content('payment_succeeded', context)
        subject = template_config['subject']
        
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=html_content,
            metadata=metadata
        )
        
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # In-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.PAYMENT_SUCCEEDED,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending payment success notification: {str(e)}")
        return False


def send_payment_failed_notification(organization, reason, amount=None):
    """Send payment failure notification"""
    try:
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            return False
        
        metadata = {
            'reason': reason,
            'amount': str(amount) if amount else 'N/A',
            'plan_name': PLAN_NAMES.get(organization.subscription_plan, 'Unknown'),
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.PAYMENT_FAILED,
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        template_config = EMAIL_TEMPLATES[NotificationType.PAYMENT_FAILED]
        context = {
            'organization_name': organization.name,
            'reason': reason,
            'plan_name': metadata['plan_name'],
            'action_button': template_config['action_button'],
            'action_url': f"{settings.FRONTEND_URL}{template_config['action_url']}",
        }
        
        html_content = generate_email_content('payment_failed', context)
        subject = template_config['subject']
        
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=html_content,
            metadata=metadata
        )
        
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # In-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.PAYMENT_FAILED,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending payment failed notification: {str(e)}")
        return False


def send_subscription_changed_notification(organization, old_plan, new_plan):
    """Send notification about subscription plan change"""
    try:
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            return False
        
        metadata = {
            'old_plan': PLAN_NAMES.get(old_plan, 'Unknown'),
            'new_plan': PLAN_NAMES.get(new_plan, 'Unknown'),
            'contacts_limit': organization.contacts_limit,
            'campaigns_limit': organization.campaigns_limit,
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.SUBSCRIPTION_RENEWED,
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        context = {
            'organization_name': organization.name,
            'old_plan': metadata['old_plan'],
            'new_plan': metadata['new_plan'],
            'contacts_limit': metadata['contacts_limit'],
            'campaigns_limit': metadata['campaigns_limit'],
            'action_button': 'View Details',
            'action_url': f"{settings.FRONTEND_URL}/subscription",
        }
        
        html_content = generate_email_content('plan_changed', context)
        subject = f"Your subscription plan has been changed to {metadata['new_plan']}"
        
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=html_content,
            metadata=metadata
        )
        
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # In-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.SUBSCRIPTION_RENEWED,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending subscription changed notification: {str(e)}")
        return False


def send_cancellation_notification(organization):
    """Send subscription cancellation notification"""
    try:
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            return False
        
        metadata = {
            'plan_name': PLAN_NAMES.get(organization.subscription_plan, 'Unknown'),
            'end_date': organization.current_period_end.strftime('%Y-%m-%d') if organization.current_period_end else 'N/A',
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.SUBSCRIPTION_CANCELED,
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        template_config = EMAIL_TEMPLATES[NotificationType.SUBSCRIPTION_CANCELED]
        context = {
            'organization_name': organization.name,
            'plan_name': metadata['plan_name'],
            'end_date': metadata['end_date'],
            'action_button': template_config['action_button'],
            'action_url': f"{settings.FRONTEND_URL}{template_config['action_url']}",
        }
        
        html_content = generate_email_content('subscription_canceled', context)
        subject = template_config['subject']
        
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=html_content,
            metadata=metadata
        )
        
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # In-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.SUBSCRIPTION_CANCELED,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending cancellation notification: {str(e)}")
        return False


def send_subscription_expired_notification(organization):
    """Send notification when subscription has expired"""
    try:
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            logger.error(f"No owner found for organization {organization.id}")
            return False
        
        metadata = {
            'plan_name': PLAN_NAMES.get(organization.subscription_plan, 'Unknown'),
            'expired_date': timezone.now().strftime('%Y-%m-%d'),
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDED,  # Reuse trial ended for subscription expiry
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        context = {
            'organization_name': organization.name,
            'plan_name': metadata['plan_name'],
            'action_button': 'Reactivate Subscription',
            'action_url': f"{settings.FRONTEND_URL}/subscription",
        }
        
        html_content = generate_email_content('trial_ended', context)  # Reuse trial ended template
        subject = f"Your {metadata['plan_name']} subscription has expired"
        
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=html_content,
            metadata=metadata
        )
        
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # In-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.TRIAL_ENDED,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending subscription expired notification: {str(e)}")
        return False


def send_usage_limit_warning(organization, warning_details):
    """Send warning when approaching usage limits"""
    try:
        owner = organization.users.filter(role='organizer').first()
        if not owner:
            logger.error(f"No owner found for organization {organization.id}")
            return False
        
        # Check if we already sent this warning recently (within last 48 hours)
        recent_notification = SubscriptionNotification.objects.filter(
            organization=organization,
            notification_type=NotificationType.LIMIT_WARNING,
            created_at__gte=timezone.now() - timedelta(hours=48),
            metadata__type=warning_details['type'],
            metadata__percentage__gte=warning_details['percentage'] - 5  # Allow for minor fluctuations
        ).exists()
        
        if recent_notification:
            logger.info(f"Usage limit warning already sent to {organization.name} for {warning_details['type']}")
            return True
        
        metadata = {
            'type': warning_details['type'],
            'current': warning_details['current'],
            'limit': warning_details['limit'],
            'percentage': warning_details['percentage'],
            'plan_name': PLAN_NAMES.get(organization.subscription_plan, 'Unknown'),
        }
        
        notification = create_notification(
            organization=organization,
            notification_type=NotificationType.LIMIT_WARNING,
            channel=NotificationChannel.EMAIL,
            user=owner,
            metadata=metadata
        )
        
        # Customize message based on limit type
        limit_descriptions = {
            'contacts': 'contacts',
            'campaigns': 'campaigns sent this month',
            'emails': 'emails sent this month',
        }
        
        limit_type = limit_descriptions.get(warning_details['type'], warning_details['type'])
        
        context = {
            'organization_name': organization.name,
            'limit_type': limit_type,
            'current_usage': warning_details['current'],
            'limit': warning_details['limit'],
            'percentage': warning_details['percentage'],
            'plan_name': metadata['plan_name'],
            'action_button': 'Upgrade Plan',
            'action_url': f"{settings.FRONTEND_URL}/subscription",
        }
        
        # Create custom HTML for usage warning
        html_template = """
            <h2>Approaching Usage Limit</h2>
            <p>Hi {organization_name},</p>
            <p>You're approaching your {plan_name} plan limit for {limit_type}.</p>
            <p><strong>Current usage: {current_usage} / {limit} ({percentage}%)</strong></p>
            <p>Consider upgrading your plan to avoid service interruption.</p>
            <a href="{action_url}" class="button">{action_button}</a>
        """
        
        content_html = html_template.format(**context)
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
                .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ background-color: #f4f4f4; padding: 20px; text-align: center; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>EngageX</h1>
                </div>
                <div class="content">
                    {content_html}
                </div>
                <div class="footer">
                    <p>© 2025 EngageX. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        subject = f"Warning: Approaching {limit_type} limit ({warning_details['percentage']}%)"
        
        success, error = send_email_notification(
            to_email=owner.email,
            subject=subject,
            html_content=full_html,
            metadata=metadata
        )
        
        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = error
        
        notification.delivery_attempts += 1
        notification.save()
        
        # In-app notification
        create_notification(
            organization=organization,
            notification_type=NotificationType.LIMIT_WARNING,
            channel=NotificationChannel.IN_APP,
            user=owner,
            metadata=metadata
        )
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending usage limit warning: {str(e)}")
        return False


def send_invitation_email(invitation, request=None):
    """Send invitation email using Django SMTP - same method as OTP and Welcome emails"""
    try:
        # Build invitation link
        if hasattr(settings, 'FRONTEND_BASE_URL'):
            invite_url = f"{settings.FRONTEND_BASE_URL}/accept-invite?token={invitation.token}"
        elif request:
            invite_url = request.build_absolute_uri(f"/accept-invite?token={invitation.token}")
        else:
            invite_url = f"http://localhost:5000/accept-invite?token={invitation.token}"

        # Email context
        inviter_name = invitation.invited_by.full_name
        organization_name = invitation.organization.name
        role_display = invitation.get_role_display()
        expires_at = invitation.expires_at
        days_until_expiry = (invitation.expires_at - timezone.now()).days

        # HTML email content
        html_message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007bff;">You're invited to join {organization_name}! 🎉</h2>
            <p style="font-size: 16px; color: #333;">
                Hi there,
            </p>
            <p style="color: #666;">
                {inviter_name} has invited you to join <strong>{organization_name}</strong> as a <strong>{role_display}</strong>.
            </p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #333; margin-top: 0;">Click the button below to accept your invitation:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{invite_url}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accept Invitation
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #6b7280; font-size: 14px;">{invite_url}</p>
            </div>
            <p style="color: #666;">
                <strong>Note:</strong> This invitation expires on {expires_at.strftime('%B %d, %Y at %I:%M %p')} ({days_until_expiry} days from now).
            </p>
            <p style="color: #666;">
                Welcome to EngageX!
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
                EngageX - Professional Email Marketing Platform
            </p>
        </div>
        """
        
        # Plain text content
        plain_message = f"""
        You're invited to join {organization_name}!

        Hi there,

        {inviter_name} has invited you to join {organization_name} as a {role_display}.

        Please visit the following link to accept your invitation:
        {invite_url}

        This invitation expires on {expires_at.strftime('%B %d, %Y at %I:%M %p')} ({days_until_expiry} days from now).

        Welcome to EngageX!

        EngageX - Professional Email Marketing Platform
        """

        # Send email using the same method as OTP and Welcome emails
        sent = send_mail(
            subject=f"You're invited to join {invitation.organization.name} on EngageX",
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"Invitation email sent successfully to {invitation.email}")
        return sent == 1

    except Exception as e:
        error_msg = f"Failed to send invitation email: {str(e)}"
        logger.error(error_msg)
        return False