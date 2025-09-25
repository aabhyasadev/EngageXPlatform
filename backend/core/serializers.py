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
    template_name = serializers.CharField(source='template.name', read_only=True)
    domain_name = serializers.CharField(source='domain.domain', read_only=True)
    contact_group_name = serializers.CharField(source='contact_group.name', read_only=True)
    open_rate = serializers.ReadOnlyField()
    click_rate = serializers.ReadOnlyField()

    class Meta:
        model = Campaign
        fields = [
            'id', 'organization', 'name', 'subject', 'from_email', 'from_name',
            'reply_to_email', 'template', 'domain', 'contact_group', 
            'html_content', 'text_content', 'status',
            'scheduled_at', 'sent_at', 'total_recipients', 'total_sent',
            'total_delivered', 'total_opened', 'total_clicked', 'total_bounced',
            'total_unsubscribed', 'created_by', 'created_at', 'updated_at',
            'created_by_name', 'organization_name', 'template_name', 
            'domain_name', 'contact_group_name', 'open_rate', 'click_rate'
        ]
        read_only_fields = [
            'id', 'total_recipients', 'total_sent', 'total_delivered',
            'total_opened', 'total_clicked', 'total_bounced',
            'total_unsubscribed', 'sent_at', 'created_at', 'updated_at',
            'organization', 'created_by'
        ]

    def to_representation(self, instance):
        """Convert snake_case field names to camelCase for frontend compatibility"""
        data = super().to_representation(instance)
        
        # Transform snake_case keys to camelCase
        camel_case_data = {}
        for key, value in data.items():
            if key == 'created_at':
                camel_case_data['createdAt'] = value
            elif key == 'updated_at':
                camel_case_data['updatedAt'] = value  
            elif key == 'scheduled_at':
                camel_case_data['scheduledAt'] = value
            elif key == 'sent_at':
                camel_case_data['sentAt'] = value
            elif key == 'from_email':
                camel_case_data['fromEmail'] = value
            elif key == 'from_name':
                camel_case_data['fromName'] = value
            elif key == 'reply_to_email':
                camel_case_data['replyToEmail'] = value
            elif key == 'html_content':
                camel_case_data['htmlContent'] = value
            elif key == 'text_content':
                camel_case_data['textContent'] = value
            elif key == 'total_recipients':
                camel_case_data['totalRecipients'] = value
            elif key == 'total_sent':
                camel_case_data['totalSent'] = value
            elif key == 'total_delivered':
                camel_case_data['totalDelivered'] = value
            elif key == 'total_opened':
                camel_case_data['totalOpened'] = value
            elif key == 'total_clicked':
                camel_case_data['totalClicked'] = value
            elif key == 'total_bounced':
                camel_case_data['totalBounced'] = value
            elif key == 'total_unsubscribed':
                camel_case_data['totalUnsubscribed'] = value
            elif key == 'created_by':
                camel_case_data['createdBy'] = value
            elif key == 'created_by_name':
                camel_case_data['createdByName'] = value
            elif key == 'organization_name':
                camel_case_data['organizationName'] = value
            elif key == 'template_name':
                camel_case_data['templateName'] = value
            elif key == 'domain_name':
                camel_case_data['domainName'] = value  
            elif key == 'contact_group_name':
                camel_case_data['contactGroupName'] = value
            elif key == 'contact_group':
                camel_case_data['contactGroup'] = value
            elif key == 'open_rate':
                camel_case_data['openRate'] = value
            elif key == 'click_rate':
                camel_case_data['clickRate'] = value
            else:
                # Keep other fields as-is (id, name, subject, status, organization, template, domain)
                camel_case_data[key] = value
                
        return camel_case_data


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

    def validate(self, attrs):
        if not attrs.get('send_all') and not attrs.get('contact_ids') and not attrs.get('group_ids'):
            raise serializers.ValidationError(
                "Must specify either send_all=True, contact_ids, or group_ids"
            )
        return attrs


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

    def update(self, instance, validated_data):
        """
        Custom update method to handle setting cards as default.
        When setting a card as default, all other cards for the same organization
        should be set to non-default.
        """
        # Check if we're updating the is_default field
        if 'is_default' in validated_data and validated_data['is_default']:
            # Set all other cards for this organization to non-default
            Card.objects.filter(
                organization=instance.organization
            ).exclude(id=instance.id).update(is_default=False)
        
        # Update the instance with the validated data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class CardCreateSerializer(serializers.Serializer):
    """Serializer for creating new cards with safe card details only (PCI compliant)"""
    cardholder_name = serializers.CharField(max_length=255)
    last4 = serializers.CharField(max_length=4, min_length=4)  # Only last 4 digits
    brand = serializers.CharField(max_length=20)  # Card brand (Visa, Mastercard, etc.)
    exp_month = serializers.IntegerField()
    exp_year = serializers.IntegerField()
    set_as_default = serializers.BooleanField(default=True)

    def validate_last4(self, value):
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError("Last 4 digits must be exactly 4 numeric characters")
        return value

    def validate_brand(self, value):
        valid_brands = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Unknown']
        if value not in valid_brands:
            raise serializers.ValidationError(f"Brand must be one of: {', '.join(valid_brands)}")
        return value

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


class CardUpdateSerializer(serializers.Serializer):
    """Serializer for updating card properties (SECURITY: only safe fields)"""
    is_default = serializers.BooleanField(required=False)
    # SECURITY: Removed exp_month and exp_year - these must come from Stripe only
    # Client cannot modify sensitive card data