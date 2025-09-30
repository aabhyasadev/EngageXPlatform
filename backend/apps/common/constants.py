"""
Common constants and enumerations used across the EngageX application.
"""
from django.db import models


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
