# Models moved to domain-specific apps
# All models now reside in apps/ directory:
# - apps.accounts.models (User, Organization, OrganizationMembership, Invitation)
# - apps.subscriptions.models (SubscriptionPlan, OrganizationSubscription, PlanFeatures, etc.)
# - apps.contacts.models (Contact, ContactGroup)
# - apps.domains.models (Domain)
# - apps.campaigns.models (Campaign, CampaignRecipient)
# - apps.templates.models (EmailTemplate)
# - apps.analytics.models (AnalyticsEvent)
# - apps.notifications.models (Notification, NotificationPreference)

# All models use Meta.app_label = 'core' for migration compatibility

# Utility functions for migrations
import secrets

def generate_invitation_token():
    """Generate a secure token for invitations - kept for migration compatibility"""
    return secrets.token_urlsafe(32)
