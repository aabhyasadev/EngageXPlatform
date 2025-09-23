from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Organization, User, Domain, ContactGroup, Contact, 
    ContactGroupMembership, EmailTemplate, Campaign, 
    CampaignRecipient, AnalyticsEvent, Card
)

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'subscription_plan', 'trial_ends_at',
            'contacts_limit', 'campaigns_limit', 'industry',
            'employees_range', 'contacts_range', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'profile_image_url',
            'organization', 'role', 'is_active', 'created_at', 'updated_at',
            'full_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = [
            'id', 'organization', 'domain', 'status', 'dkim_record',
            'cname_record', 'dmarc_record', 'txt_record', 'verified_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'verified_at', 'created_at', 'updated_at']


class ContactGroupSerializer(serializers.ModelSerializer):
    members_count = serializers.SerializerMethodField()

    class Meta:
        model = ContactGroup
        fields = [
            'id', 'organization', 'name', 'description',
            'created_at', 'updated_at', 'members_count'
        ]
        read_only_fields = ['id', 'organization', 'created_at', 'updated_at']

    def get_members_count(self, obj):
        return obj.memberships.count()


class ContactSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    groups = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [
            'id', 'organization', 'email', 'first_name', 'last_name',
            'phone', 'language', 'is_subscribed', 'unsubscribed_at',
            'created_at', 'updated_at', 'full_name', 'groups'
        ]
        read_only_fields = ['id', 'organization', 'created_at', 'updated_at']

    def get_groups(self, obj):
        groups = ContactGroup.objects.filter(memberships__contact=obj)
        return ContactGroupSerializer(groups, many=True).data


class ContactGroupMembershipSerializer(serializers.ModelSerializer):
    contact_email = serializers.CharField(source='contact.email', read_only=True)
    contact_name = serializers.CharField(source='contact.full_name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = ContactGroupMembership
        fields = [
            'id', 'contact', 'group', 'created_at',
            'contact_email', 'contact_name', 'group_name'
        ]
        read_only_fields = ['id', 'created_at']


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'organization', 'name', 'subject', 'html_content',
            'text_content', 'is_default', 'category',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CampaignSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    open_rate = serializers.ReadOnlyField()
    click_rate = serializers.ReadOnlyField()

    class Meta:
        model = Campaign
        fields = [
            'id', 'organization', 'name', 'subject', 'from_email', 'from_name',
            'reply_to_email', 'html_content', 'text_content', 'status',
            'scheduled_at', 'sent_at', 'total_recipients', 'total_sent',
            'total_delivered', 'total_opened', 'total_clicked', 'total_bounced',
            'total_unsubscribed', 'created_by', 'created_at', 'updated_at',
            'created_by_name', 'organization_name', 'open_rate', 'click_rate'
        ]
        read_only_fields = [
            'id', 'total_recipients', 'total_sent', 'total_delivered',
            'total_opened', 'total_clicked', 'total_bounced',
            'total_unsubscribed', 'sent_at', 'created_at', 'updated_at'
        ]


class CampaignRecipientSerializer(serializers.ModelSerializer):
    contact_email = serializers.CharField(source='contact.email', read_only=True)
    contact_name = serializers.CharField(source='contact.full_name', read_only=True)
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)

    class Meta:
        model = CampaignRecipient
        fields = [
            'id', 'campaign', 'contact', 'status', 'sent_at', 'delivered_at',
            'opened_at', 'clicked_at', 'bounced_at', 'unsubscribed_at',
            'created_at', 'contact_email', 'contact_name', 'campaign_name'
        ]
        read_only_fields = [
            'id', 'sent_at', 'delivered_at', 'opened_at', 'clicked_at',
            'bounced_at', 'unsubscribed_at', 'created_at'
        ]


class AnalyticsEventSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    contact_email = serializers.CharField(source='contact.email', read_only=True)

    class Meta:
        model = AnalyticsEvent
        fields = [
            'id', 'organization', 'campaign', 'contact', 'event_type',
            'user_agent', 'ip_address', 'metadata', 'created_at',
            'campaign_name', 'contact_email'
        ]
        read_only_fields = ['id', 'created_at']


# Special serializers for specific API responses
class DashboardStatsSerializer(serializers.Serializer):
    total_contacts = serializers.IntegerField()
    active_campaigns = serializers.IntegerField()
    total_sent = serializers.IntegerField()
    total_opened = serializers.IntegerField()
    total_clicked = serializers.IntegerField()
    open_rate = serializers.FloatField()
    click_rate = serializers.FloatField()


class ContactImportSerializer(serializers.Serializer):
    file = serializers.FileField()
    group_id = serializers.CharField(required=False, allow_blank=True)

    def validate_file(self, value):
        if not value.name.lower().endswith(('.csv', '.xlsx')):
            raise serializers.ValidationError("File must be CSV or Excel format")
        return value


class CampaignSendSerializer(serializers.Serializer):
    contact_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    group_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    send_all = serializers.BooleanField(default=False)

    def validate(self, data):
        if not data.get('send_all') and not data.get('contact_ids') and not data.get('group_ids'):
            raise serializers.ValidationError(
                "Must specify either send_all=True, contact_ids, or group_ids"
            )
        return data


class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = [
            'id', 'organization', 'cardholder_name', 'last4', 'brand',
            'exp_month', 'exp_year', 'is_default', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'organization', 'created_at', 'updated_at'
        ]

    def validate_exp_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError("Expiry month must be between 1 and 12")
        return value

    def validate_exp_year(self, value):
        from datetime import datetime
        current_year = datetime.now().year
        if value < current_year:
            raise serializers.ValidationError("Expiry year cannot be in the past")
        if value > current_year + 20:
            raise serializers.ValidationError("Expiry year is too far in the future")
        return value

    def validate_last4(self, value):
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError("Last 4 digits must be exactly 4 numeric characters")
        return value


class CardCreateSerializer(serializers.Serializer):
    """Serializer for creating new cards with direct card details"""
    cardholder_name = serializers.CharField(max_length=255)
    card_number = serializers.CharField(max_length=19)  # Card number with spaces
    exp_month = serializers.IntegerField()
    exp_year = serializers.IntegerField()
    cvv = serializers.CharField(max_length=4)
    set_as_default = serializers.BooleanField(default=True)

    def validate_card_number(self, value):
        # Remove spaces and validate card number
        card_number = value.replace(' ', '')
        if not card_number.isdigit():
            raise serializers.ValidationError("Card number must contain only digits")
        if len(card_number) < 13 or len(card_number) > 19:
            raise serializers.ValidationError("Card number must be between 13 and 19 digits")
        return card_number

    def validate_exp_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError("Expiry month must be between 1 and 12")
        return value

    def validate_exp_year(self, value):
        from datetime import datetime
        current_year = datetime.now().year
        if value < current_year:
            raise serializers.ValidationError("Expiry year cannot be in the past")
        if value > current_year + 20:
            raise serializers.ValidationError("Expiry year is too far in the future")
        return value

    def validate_cvv(self, value):
        if not value.isdigit() or len(value) < 3 or len(value) > 4:
            raise serializers.ValidationError("CVV must be 3 or 4 digits")
        return value


class CardUpdateSerializer(serializers.Serializer):
    """Serializer for updating card properties (SECURITY: only safe fields)"""
    is_default = serializers.BooleanField(required=False)
    # SECURITY: Removed exp_month and exp_year - these must come from Stripe only
    # Client cannot modify sensitive card data