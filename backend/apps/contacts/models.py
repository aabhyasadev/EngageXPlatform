import uuid
from django.db import models
from django.core.validators import EmailValidator

from apps.accounts.models import Organization


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
        indexes = [
            models.Index(fields=['organization']),
            models.Index(fields=['-created_at']),
        ]

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
        indexes = [
            models.Index(fields=['organization', 'is_subscribed']),
            models.Index(fields=['email']),
            models.Index(fields=['is_subscribed']),
            models.Index(fields=['-created_at']),
        ]

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
        indexes = [
            models.Index(fields=['contact']),
            models.Index(fields=['group']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.contact.email} in {self.group.name}"
