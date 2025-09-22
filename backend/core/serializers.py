from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Organization, User, Domain, ContactGroup, Contact, 
    ContactGroupMembership, EmailTemplate, Campaign, 
    CampaignRecipient, AnalyticsEvent
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
        read_only_fields = ['id', 'created_at', 'updated_at']

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