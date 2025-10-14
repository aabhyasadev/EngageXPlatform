from rest_framework import serializers
from apps.campaigns.models import Campaign, CampaignRecipient


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

class CampaignSendSerializer(serializers.Serializer):
    contact_ids = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    group_ids = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    send_all = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if not attrs.get('send_all') and not attrs.get('contact_ids') and not attrs.get('group_ids'):
            raise serializers.ValidationError(
                "Must specify either send_all=True, contact_ids, or group_ids"
            )
        return attrs
