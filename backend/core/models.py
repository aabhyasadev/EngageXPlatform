import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.auth.hashers import make_password, check_password
from django.core.validators import EmailValidator
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta
import json
import secrets


def generate_invitation_token():
    """Generate a secure token for invitations"""
    return secrets.token_urlsafe(32)


class UserRole(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    ORGANIZER = 'organizer', 'Organizer'  # Organization Owner
    CAMPAIGN_MANAGER = 'campaign_manager', 'Campaign Manager'
    ANALYST = 'analyst', 'Analyst'
    EDITOR = 'editor', 'Editor'


class MembershipStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    INACTIVE = 'inactive', 'Inactive'
    PENDING = 'pending', 'Pending'


class SubscriptionPlan(models.TextChoices):
    FREE_TRIAL = 'free_trial', 'Free Trial'
    BASIC_MONTHLY = 'basic_monthly', 'Basic Monthly'
    BASIC_YEARLY = 'basic_yearly', 'Basic Yearly'
    PRO_MONTHLY = 'pro_monthly', 'Pro Monthly'
    PRO_YEARLY = 'pro_yearly', 'Pro Yearly'
    PREMIUM_MONTHLY = 'premium_monthly', 'Premium Monthly'
    PREMIUM_YEARLY = 'premium_yearly', 'Premium Yearly'


class CampaignStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    SCHEDULED = 'scheduled', 'Scheduled'
    SENDING = 'sending', 'Sending'
    SENT = 'sent', 'Sent'
    PAUSED = 'paused', 'Paused'
    FAILED = 'failed', 'Failed'


class DomainStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    VERIFIED = 'verified', 'Verified'
    FAILED = 'failed', 'Failed'


class RecipientStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SENT = 'sent', 'Sent'
    DELIVERED = 'delivered', 'Delivered'
    OPENED = 'opened', 'Opened'
    CLICKED = 'clicked', 'Clicked'
    BOUNCED = 'bounced', 'Bounced'
    UNSUBSCRIBED = 'unsubscribed', 'Unsubscribed'


class EventType(models.TextChoices):
    SEND = 'send', 'Send'
    OPEN = 'open', 'Open'
    CLICK = 'click', 'Click'
    BOUNCE = 'bounce', 'Bounce'
    UNSUBSCRIBE = 'unsubscribe', 'Unsubscribe'
    SPAM_REPORT = 'spam_report', 'Spam Report'


class SubscriptionStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    PAST_DUE = 'past_due', 'Past Due'
    CANCELED = 'canceled', 'Canceled'
    TRIALING = 'trialing', 'Trialing'


class BillingCycle(models.TextChoices):
    MONTHLY = 'monthly', 'Monthly'
    YEARLY = 'yearly', 'Yearly'


class SubscriptionEventType(models.TextChoices):
    CREATED = 'created', 'Created'
    UPDATED = 'updated', 'Updated'
    CANCELED = 'canceled', 'Canceled'
    RENEWED = 'renewed', 'Renewed'
    PAYMENT_SUCCEEDED = 'payment_succeeded', 'Payment Succeeded'
    PAYMENT_FAILED = 'payment_failed', 'Payment Failed'
    TRIAL_STARTED = 'trial_started', 'Trial Started'
    TRIAL_ENDED = 'trial_ended', 'Trial Ended'
    PLAN_CHANGED = 'plan_changed', 'Plan Changed'


class NotificationType(models.TextChoices):
    TRIAL_ENDING = 'trial_ending', 'Trial Ending'
    TRIAL_ENDED = 'trial_ended', 'Trial Ended'
    SUBSCRIPTION_RENEWED = 'subscription_renewed', 'Subscription Renewed'
    SUBSCRIPTION_CANCELED = 'subscription_canceled', 'Subscription Canceled'
    PAYMENT_FAILED = 'payment_failed', 'Payment Failed'
    PAYMENT_SUCCEEDED = 'payment_succeeded', 'Payment Succeeded'
    LIMIT_WARNING = 'limit_warning', 'Limit Warning'
    LIMIT_REACHED = 'limit_reached', 'Limit Reached'
    TEAM_INVITATION_RECEIVED = 'team_invitation_received', 'Team Invitation Received'
    TEAM_INVITATION_ACCEPTED = 'team_invitation_accepted', 'Team Invitation Accepted'


class NotificationChannel(models.TextChoices):
    EMAIL = 'email', 'Email'
    IN_APP = 'in_app', 'In-App'
    WEBHOOK = 'webhook', 'Webhook'


class NotificationStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SENT = 'sent', 'Sent'
    FAILED = 'failed', 'Failed'
    DELIVERED = 'delivered', 'Delivered'


class InvitationStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    ACCEPTED = 'accepted', 'Accepted'
    EXPIRED = 'expired', 'Expired'
    REVOKED = 'revoked', 'Revoked'


class Organization(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    subscription_plan = models.CharField(
        max_length=30,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.FREE_TRIAL
    )
    subscription_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIALING
    )
    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        null=True,
        blank=True
    )
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    subscription_ends_at = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    stripe_customer_id = models.CharField(max_length=255, null=True, blank=True)
    stripe_subscription_id = models.CharField(max_length=255, null=True, blank=True)
    stripe_price_id = models.CharField(max_length=255, null=True, blank=True)
    stripe_payment_method_id = models.CharField(max_length=255, null=True, blank=True)
    contacts_limit = models.IntegerField(default=1000)
    campaigns_limit = models.IntegerField(default=10)
    emails_per_month_limit = models.IntegerField(default=10000)
    is_subscription_active = models.BooleanField(default=True)
    industry = models.CharField(max_length=100, null=True, blank=True)
    employees_range = models.CharField(max_length=50, null=True, blank=True)
    contacts_range = models.CharField(max_length=50, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # Store preferences, settings, etc.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organizations'

    def __str__(self):
        return self.name


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
        db_table = 'subscription_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.organization.name} - {self.event_type} - {self.created_at}"


class WebhookEventStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    PROCESSING = 'processing', 'Processing'
    PROCESSED = 'processed', 'Processed'
    FAILED = 'failed', 'Failed'


class ProcessedWebhookEvent(models.Model):
    """Track processed Stripe webhook events to ensure idempotency"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.CharField(max_length=255, unique=True, db_index=True)  # Stripe event ID
    event_type = models.CharField(max_length=100)  # Stripe event type
    status = models.CharField(
        max_length=20,
        choices=WebhookEventStatus.choices,
        default=WebhookEventStatus.PENDING
    )
    processed_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # Store additional event data if needed
    
    class Meta:
        db_table = 'processed_webhook_events'
        indexes = [
            models.Index(fields=['event_id']),
            models.Index(fields=['processed_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.event_id} - {self.event_type} - {self.status}"


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    replit_id = models.CharField(max_length=100, unique=True, null=True, blank=True)  # External Replit Auth ID
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)  # For new sign-in flow
    email = models.EmailField(unique=True, validators=[EmailValidator()])
    first_name = models.CharField(max_length=100, null=True, blank=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)  # For signup process
    profile_image_url = models.URLField(max_length=500, null=True, blank=True)
    stripe_customer_id = models.CharField(max_length=255, null=True, blank=True)
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.CASCADE, 
        related_name='users',
        null=True, blank=True
    )
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CAMPAIGN_MANAGER
    )
    # New fields for enhanced authentication
    mfa_enabled = models.BooleanField(default=False)
    otp_secret = models.CharField(max_length=32, null=True, blank=True)
    sso_enabled = models.BooleanField(default=False)
    last_login_at = models.DateTimeField(null=True, blank=True)
    login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.email
    
    def get_organizations(self):
        """Get all organizations this user has access to"""
        return Organization.objects.filter(
            memberships__user=self,
            memberships__status=MembershipStatus.ACTIVE
        ).distinct()
    
    def get_membership(self, organization):
        """Get user's membership for a specific organization"""
        try:
            return self.memberships.get(organization=organization, status=MembershipStatus.ACTIVE)
        except OrganizationMembership.DoesNotExist:
            return None
    
    def get_role_in_organization(self, organization):
        """Get user's role in a specific organization"""
        membership = self.get_membership(organization)
        return membership.role if membership else None


class OrganizationMembership(models.Model):
    """Connects users to organizations with specific roles and organization-scoped credentials"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CAMPAIGN_MANAGER
    )
    status = models.CharField(
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invited_memberships'
    )
    
    # Organization-scoped authentication credentials
    credential_username = models.CharField(
        max_length=150, 
        help_text="Username for this organization (isolated per org)"
    )
    credential_password_hash = models.CharField(
        max_length=128,
        help_text="Password hash for this organization"
    )
    requires_password_change = models.BooleanField(
        default=True,
        help_text="Forces password change on next login"
    )
    
    # Login security fields
    login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    
    # MFA fields
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=32, null=True, blank=True)
    
    # Timestamps
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'organization_memberships'
        unique_together = ['user', 'organization']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'credential_username'],
                name='unique_org_username'
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'credential_username']),
            models.Index(fields=['role']),
        ]
    
    def set_password(self, raw_password):
        """Set the password for this organization membership"""
        self.credential_password_hash = make_password(raw_password)
        
    def check_password(self, raw_password):
        """Check if the given password matches"""
        return check_password(raw_password, self.credential_password_hash)
    
    def is_locked(self):
        """Check if account is currently locked"""
        if self.locked_until:
            return timezone.now() < self.locked_until
        return False
    
    def lock_account(self, minutes=30):
        """Lock account for specified minutes"""
        self.locked_until = timezone.now() + timedelta(minutes=minutes)
        self.save(update_fields=['locked_until'])
    
    def unlock_account(self):
        """Unlock account and reset login attempts"""
        self.locked_until = None
        self.login_attempts = 0
        self.save(update_fields=['locked_until', 'login_attempts'])
    
    def record_login_attempt(self, success=False):
        """Record login attempt and handle locking"""
        if success:
            self.login_attempts = 0
            self.last_login_at = timezone.now()
            self.save(update_fields=['login_attempts', 'last_login_at'])
        else:
            self.login_attempts += 1
            if self.login_attempts >= 5:  # Lock after 5 failed attempts
                self.lock_account()
            else:
                self.save(update_fields=['login_attempts'])
    
    def __str__(self):
        return f"{self.credential_username}@{self.organization.name} ({self.role})"


class Invitation(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    email = models.EmailField(max_length=255, validators=[EmailValidator()])
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CAMPAIGN_MANAGER
    )
    token = models.CharField(max_length=64, unique=True, default=generate_invitation_token)
    status = models.CharField(
        max_length=20,
        choices=InvitationStatus.choices,
        default=InvitationStatus.PENDING
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_invitations'
    )
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invitations'
        indexes = [
            models.Index(fields=['organization', 'email', 'status']),
            models.Index(fields=['token']),
            models.Index(fields=['email']),
            models.Index(fields=['status']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"Invitation to {self.email} for {self.organization.name}"

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def generate_token(self):
        import secrets
        self.token = secrets.token_urlsafe(32)


class Domain(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='domains'
    )
    domain = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=DomainStatus.choices,
        default=DomainStatus.PENDING
    )
    dkim_record = models.TextField(null=True, blank=True)
    cname_record = models.TextField(null=True, blank=True)
    dmarc_record = models.TextField(null=True, blank=True)
    txt_record = models.TextField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'domains'

    def __str__(self):
        return self.domain


class ContactGroup(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='contact_groups'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contact_groups'

    def __str__(self):
        return self.name


class Contact(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='contacts'
    )
    email = models.EmailField(max_length=255, validators=[EmailValidator()])
    first_name = models.CharField(max_length=100, null=True, blank=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    language = models.CharField(max_length=10, default='en')
    is_subscribed = models.BooleanField(default=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contacts'
        unique_together = ['organization', 'email']

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.email}" if self.first_name else self.email

    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.email


class ContactGroupMembership(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name='group_memberships'
    )
    group = models.ForeignKey(
        ContactGroup,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'contact_group_memberships'
        unique_together = ['contact', 'group']

    def __str__(self):
        return f"{self.contact.email} in {self.group.name}"


class EmailTemplate(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='email_templates'
    )
    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, null=True, blank=True)
    html_content = models.TextField(null=True, blank=True)
    text_content = models.TextField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    category = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'email_templates'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Campaign(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='campaigns'
    )
    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    from_email = models.EmailField(max_length=255, validators=[EmailValidator()])
    from_name = models.CharField(max_length=255, null=True, blank=True)
    reply_to_email = models.EmailField(max_length=255, null=True, blank=True, validators=[EmailValidator()])
    
    # New required fields for campaign creation
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        related_name='campaigns',
        null=True,
        blank=True
    )
    domain = models.ForeignKey(
        Domain,
        on_delete=models.SET_NULL,
        related_name='campaigns',
        null=True,
        blank=True
    )
    contact_group = models.ForeignKey(
        ContactGroup,
        on_delete=models.SET_NULL,
        related_name='campaigns',
        null=True,
        blank=True
    )
    
    html_content = models.TextField(null=True, blank=True)
    text_content = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=CampaignStatus.choices,
        default=CampaignStatus.DRAFT
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    total_recipients = models.IntegerField(default=0)
    total_sent = models.IntegerField(default=0)
    total_delivered = models.IntegerField(default=0)
    total_opened = models.IntegerField(default=0)
    total_clicked = models.IntegerField(default=0)
    total_bounced = models.IntegerField(default=0)
    total_unsubscribed = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_campaigns',
        db_column='created_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaigns'

    def __str__(self):
        return self.name

    @property
    def open_rate(self):
        if self.total_delivered > 0:
            return (self.total_opened / self.total_delivered) * 100
        return 0

    @property
    def click_rate(self):
        if self.total_delivered > 0:
            return (self.total_clicked / self.total_delivered) * 100
        return 0


class CampaignRecipient(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name='recipients'
    )
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name='campaign_recipients'
    )
    status = models.CharField(
        max_length=50,
        choices=RecipientStatus.choices,
        default=RecipientStatus.PENDING
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    bounced_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campaign_recipients'
        unique_together = ['campaign', 'contact']

    def __str__(self):
        return f"{self.campaign.name} - {self.contact.email}"


class AnalyticsEvent(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='analytics_events'
    )
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name='analytics_events',
        null=True, blank=True
    )
    contact = models.ForeignKey(
        Contact,
        on_delete=models.CASCADE,
        related_name='analytics_events',
        null=True, blank=True
    )
    event_type = models.CharField(max_length=50, choices=EventType.choices)
    user_agent = models.TextField(null=True, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True)  # IPv6 support
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analytics_events'

    def __str__(self):
        return f"{self.event_type} - {self.campaign.name if self.campaign else 'No Campaign'}"


# OTP model for email verification during signup
class PlanFeatures(models.Model):
    """Model to store plan features and pricing configuration"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.CharField(
        max_length=30,
        choices=SubscriptionPlan.choices,
        unique=True
    )
    price_cents = models.IntegerField()  # Price in cents
    contacts_limit = models.IntegerField()
    campaigns_limit = models.IntegerField()
    emails_per_month = models.IntegerField()
    # Feature flags
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
    month = models.DateField()  # First day of the month
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
        
        # Get or create usage tracking for current month
        usage, created = cls.objects.get_or_create(
            organization=organization,
            month=current_month,
            defaults={
                'emails_sent': 0,
                'campaigns_created': 0,
                'contacts_imported': 0,
            }
        )
        
        # Get actual counts from the database
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
    cardholder_name = models.CharField(max_length=255, default='Card Holder')  # Name on the card
    last4 = models.CharField(max_length=4)  # Last 4 digits of card
    brand = models.CharField(max_length=50)  # Card brand (Visa, Mastercard, etc.)
    exp_month = models.IntegerField()  # Expiry month (1-12)
    exp_year = models.IntegerField()  # Expiry year
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cards'
        indexes = [
            models.Index(fields=['organization', 'is_default']),
        ]

    def __str__(self):
        return f"{self.brand} ****{self.last4} - {self.organization.name}"

    def save(self, *args, **kwargs):
        # Ensure only one default card per organization
        if self.is_default:
            Card.objects.filter(
                organization=self.organization,
                is_default=True
            ).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)


class SubscriptionNotification(models.Model):
    """Model to track notifications sent about subscription events"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='subscription_notifications'
    )
    user = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices
    )
    channel = models.CharField(
        max_length=20,
        choices=NotificationChannel.choices
    )
    status = models.CharField(
        max_length=20,
        choices=NotificationStatus.choices,
        default=NotificationStatus.PENDING
    )
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)  # Store email content, webhook payload, template info, etc.
    error_message = models.TextField(null=True, blank=True)
    delivery_attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscription_notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'notification_type', '-created_at']),
            models.Index(fields=['status', 'channel']),
            models.Index(fields=['user', 'is_read', '-created_at']),
            models.Index(fields=['organization', 'is_read']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.notification_type} - {self.status}"
    
    def mark_as_read(self):
        """Mark the notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at', 'updated_at'])


class EmailOTP(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=255, validators=[EmailValidator()])
    otp_code = models.CharField(max_length=6)  # 6-digit OTP
    is_verified = models.BooleanField(default=False)
    expires_at = models.DateTimeField()  # 20-minute expiry
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.IntegerField(default=0)  # Track failed attempts
    max_attempts = models.IntegerField(default=5)  # Max 5 attempts

    class Meta:
        db_table = 'email_otps'
        indexes = [
            models.Index(fields=['email', 'is_verified']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"OTP for {self.email}"

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def is_max_attempts_reached(self):
        return self.attempts >= self.max_attempts


# Session model for Django sessions (matches existing sessions table)
class Session(models.Model):
    sid = models.CharField(max_length=40, primary_key=True)
    sess = models.JSONField()
    expire = models.DateTimeField(db_index=True)

    class Meta:
        db_table = 'sessions'


# Signal to automatically activate 14-day trial when organization is created
@receiver(post_save, sender=Organization)
def activate_trial_on_organization_creation(sender, instance, created, **kwargs):
    """Automatically activate 14-day trial when a new organization is created"""
    if created and not instance.trial_ends_at:
        # Set trial to end 14 days from creation
        from django.utils import timezone
        trial_end_date = timezone.now() + timedelta(days=14)
        instance.trial_ends_at = trial_end_date
        instance.current_period_end = trial_end_date
        instance.subscription_plan = SubscriptionPlan.FREE_TRIAL
        instance.subscription_status = SubscriptionStatus.TRIALING
        instance.is_subscription_active = True
        instance.contacts_limit = 1000
        instance.campaigns_limit = 10
        instance.emails_per_month_limit = 10000
        instance.save(update_fields=[
            'trial_ends_at', 
            'current_period_end',
            'subscription_plan', 
            'subscription_status',
            'is_subscription_active', 
            'contacts_limit', 
            'campaigns_limit',
            'emails_per_month_limit'
        ])
        
        # Create a subscription history entry for trial activation
        SubscriptionHistory.objects.create(
            organization=instance,
            plan=SubscriptionPlan.FREE_TRIAL,
            event_type=SubscriptionEventType.TRIAL_STARTED,
            metadata={
                'trial_duration_days': 14,
                'contacts_limit': 1000,
                'campaigns_limit': 10,
                'emails_per_month_limit': 10000
            }
        )