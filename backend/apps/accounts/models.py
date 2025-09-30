import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import EmailValidator

from apps.common.constants import (
    UserRole,
    MembershipStatus,
    SubscriptionPlan,
    SubscriptionStatus,
    BillingCycle,
    InvitationStatus
)
from apps.common.utils import generate_invitation_token


class UserManager(BaseUserManager):
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
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organizations'

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    replit_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    email = models.EmailField(unique=True, validators=[EmailValidator()])
    first_name = models.CharField(max_length=100, null=True, blank=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
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

    objects = UserManager()

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
    """Connects users to organizations with specific roles"""
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
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'organization_memberships'
        unique_together = ['user', 'organization']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.organization.name} ({self.role})"


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
