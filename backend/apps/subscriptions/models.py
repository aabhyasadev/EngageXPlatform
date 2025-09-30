import uuid
from django.db import models

from apps.common.constants import (
    SubscriptionPlan,
    SubscriptionStatus,
    SubscriptionEventType
)
from apps.accounts.models import Organization


class WebhookEventStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    PROCESSING = 'processing', 'Processing'
    PROCESSED = 'processed', 'Processed'
    FAILED = 'failed', 'Failed'


class SubscriptionHistory(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='subscription_history'
    )
    event_type = models.CharField(
        max_length=30,
        choices=SubscriptionEventType.choices
    )
    stripe_event_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    old_plan = models.CharField(
        max_length=30,
        choices=SubscriptionPlan.choices,
        null=True,
        blank=True
    )
    new_plan = models.CharField(
        max_length=30,
        choices=SubscriptionPlan.choices,
        null=True,
        blank=True
    )
    old_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        null=True,
        blank=True
    )
    new_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        null=True,
        blank=True
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    payment_method = models.CharField(max_length=50, null=True, blank=True)
    payment_method_last4 = models.CharField(max_length=4, null=True, blank=True)
    payment_method_brand = models.CharField(max_length=20, null=True, blank=True)
    invoice_id = models.CharField(max_length=255, null=True, blank=True)
    invoice_pdf_url = models.URLField(max_length=500, null=True, blank=True)
    receipt_number = models.CharField(max_length=255, null=True, blank=True)
    failure_reason = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'core'
        db_table = 'subscription_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.organization.name} - {self.event_type} - {self.created_at}"


class ProcessedWebhookEvent(models.Model):
    """Track processed Stripe webhook events to ensure idempotency"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.CharField(max_length=255, unique=True, db_index=True)
    event_type = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=WebhookEventStatus.choices,
        default=WebhookEventStatus.PENDING
    )
    processed_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        app_label = 'core'
        db_table = 'processed_webhook_events'
        indexes = [
            models.Index(fields=['event_id']),
            models.Index(fields=['processed_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.event_id} - {self.event_type} - {self.status}"


class PlanFeatures(models.Model):
    """Model to store plan features and pricing configuration"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.CharField(
        max_length=30,
        choices=SubscriptionPlan.choices,
        unique=True
    )
    price_cents = models.IntegerField()
    contacts_limit = models.IntegerField()
    campaigns_limit = models.IntegerField()
    emails_per_month = models.IntegerField()
    has_email_campaigns = models.BooleanField(default=True)
    has_basic_analytics = models.BooleanField(default=True)
    has_advanced_analytics = models.BooleanField(default=False)
    has_ab_testing = models.BooleanField(default=False)
    has_automation = models.BooleanField(default=False)
    has_custom_templates = models.BooleanField(default=False)
    has_white_labeling = models.BooleanField(default=False)
    has_api_access = models.BooleanField(default=False)
    has_priority_support = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'core'
        db_table = 'plan_features'
        verbose_name = 'Plan Features'
        verbose_name_plural = 'Plan Features'

    def __str__(self):
        return f"{self.plan} - ${self.price_cents/100}"


class UsageTracking(models.Model):
    """Model to track monthly usage for organizations"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='usage_tracking'
    )
    month = models.DateField()
    emails_sent = models.IntegerField(default=0)
    campaigns_created = models.IntegerField(default=0)
    contacts_imported = models.IntegerField(default=0)
    templates_created = models.IntegerField(default=0)
    domains_verified = models.IntegerField(default=0)
    api_calls = models.IntegerField(default=0)
    ab_tests_created = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        app_label = 'core'
        db_table = 'usage_tracking'
        unique_together = ['organization', 'month']
        indexes = [
            models.Index(fields=['organization', 'month']),
        ]
    
    def __str__(self):
        return f"{self.organization.name} - {self.month} - {self.emails_sent} emails"
    
    @classmethod
    def get_current_usage(cls, organization):
        """Get current month's usage for an organization"""
        from django.utils import timezone
        from datetime import date
        
        current_month = date(timezone.now().year, timezone.now().month, 1)
        
        usage, created = cls.objects.get_or_create(
            organization=organization,
            month=current_month,
            defaults={
                'emails_sent': 0,
                'campaigns_created': 0,
                'contacts_imported': 0,
            }
        )
        
        from apps.contacts.models import Contact
        from apps.campaigns.models import Campaign
        contacts_count = Contact.objects.filter(organization=organization).count()
        campaigns_sent = Campaign.objects.filter(
            organization=organization,
            created_at__month=timezone.now().month,
            created_at__year=timezone.now().year
        ).count()
        
        return {
            'emails_sent': usage.emails_sent,
            'campaigns_sent': campaigns_sent,
            'contacts_count': contacts_count,
            'contacts_imported': usage.contacts_imported,
            'templates_created': usage.templates_created,
            'domains_verified': usage.domains_verified,
        }


class Card(models.Model):
    """Model to store card details"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='cards'
    )
    cardholder_name = models.CharField(max_length=255, default='Card Holder')
    last4 = models.CharField(max_length=4)
    brand = models.CharField(max_length=50)
    exp_month = models.IntegerField()
    exp_year = models.IntegerField()
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'core'
        db_table = 'cards'
        indexes = [
            models.Index(fields=['organization', 'is_default']),
        ]

    def __str__(self):
        return f"{self.brand} ****{self.last4} - {self.organization.name}"

    def save(self, *args, **kwargs):
        if self.is_default:
            Card.objects.filter(
                organization=self.organization,
                is_default=True
            ).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)
