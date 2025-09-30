import uuid
from django.db import models

from apps.common.constants import EventType
from apps.accounts.models import Organization
from apps.campaigns.models import Campaign
from apps.contacts.models import Contact


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
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'core'
        db_table = 'analytics_events'

    def __str__(self):
        return f"{self.event_type} - {self.campaign.name if self.campaign else 'No Campaign'}"
