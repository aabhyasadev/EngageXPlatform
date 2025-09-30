import uuid
from django.db import models
from django.utils import timezone

from apps.common.constants import (
    NotificationType,
    NotificationChannel,
    NotificationStatus
)
from apps.accounts.models import Organization


class SubscriptionNotification(models.Model):
    """Model to track notifications sent about subscription events"""
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='subscription_notifications'
    )
    user = models.ForeignKey(
        'accounts.User',
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
    metadata = models.JSONField(null=True, blank=True)
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
