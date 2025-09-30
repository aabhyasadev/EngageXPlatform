import uuid
from django.db import models

from apps.accounts.models import Organization


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
