import uuid
from django.db import models
from django.core.validators import EmailValidator

from apps.common.constants import CampaignStatus, RecipientStatus
from apps.accounts.models import Organization, User
from apps.templates.models import EmailTemplate
from apps.contacts.models import ContactGroup, Contact
from apps.domains.models import Domain


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
