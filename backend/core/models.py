import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import EmailValidator
import json


class UserRole(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    CAMPAIGN_MANAGER = 'campaign_manager', 'Campaign Manager'
    ANALYST = 'analyst', 'Analyst'
    EDITOR = 'editor', 'Editor'


class SubscriptionPlan(models.TextChoices):
    FREE_TRIAL = 'free_trial', 'Free Trial'
    MONTHLY = 'monthly', 'Monthly'
    YEARLY = 'yearly', 'Yearly'


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


class Organization(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    subscription_plan = models.CharField(
        max_length=20,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.FREE_TRIAL
    )
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    contacts_limit = models.IntegerField(default=1000)
    campaigns_limit = models.IntegerField(default=10)
    industry = models.CharField(max_length=100, null=True, blank=True)
    employees_range = models.CharField(max_length=50, null=True, blank=True)
    contacts_range = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organizations'

    def __str__(self):
        return self.name


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
    email = models.EmailField(unique=True, validators=[EmailValidator()])
    first_name = models.CharField(max_length=100, null=True, blank=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)
    profile_image_url = models.URLField(max_length=500, null=True, blank=True)
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
        related_name='created_campaigns'
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


# Session model for Django sessions (matches existing sessions table)
class Session(models.Model):
    sid = models.CharField(max_length=40, primary_key=True)
    sess = models.JSONField()
    expire = models.DateTimeField(db_index=True)

    class Meta:
        db_table = 'sessions'