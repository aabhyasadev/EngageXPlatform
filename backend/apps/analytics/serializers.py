from rest_framework import serializers
from apps.analytics.models import AnalyticsEvent


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


class DashboardStatsSerializer(serializers.Serializer):
    total_contacts = serializers.IntegerField()
    active_campaigns = serializers.IntegerField()
    total_sent = serializers.IntegerField()
    total_opened = serializers.IntegerField()
    total_clicked = serializers.IntegerField()
    open_rate = serializers.FloatField()
    click_rate = serializers.FloatField()
