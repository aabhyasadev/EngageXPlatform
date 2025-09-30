from rest_framework import serializers

from apps.domains.models import Domain


class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = [
            'id', 'organization', 'domain', 'status', 'dkim_record',
            'cname_record', 'dmarc_record', 'txt_record', 'verified_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'verified_at', 'created_at', 'updated_at']
