import uuid
from django.db import models

from apps.common.constants import DomainStatus
from apps.accounts.models import Organization


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
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['domain']),
            models.Index(fields=['status']),
            models.Index(fields=['verified_at']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return self.domain