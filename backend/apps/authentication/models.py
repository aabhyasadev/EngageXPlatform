import uuid
from django.db import models
from django.core.validators import EmailValidator

from apps.accounts.models import User


class EmailOTP(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=255, validators=[EmailValidator()])
    otp_code = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=5)

    class Meta:
        app_label = 'core'
        db_table = 'email_otps'
        indexes = [
            models.Index(fields=['email', 'is_verified']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"OTP for {self.email}"

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def is_max_attempts_reached(self):
        return self.attempts >= self.max_attempts


class Session(models.Model):
    sid = models.CharField(max_length=40, primary_key=True)
    sess = models.JSONField()
    expire = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'core'
        db_table = 'sessions'
