from rest_framework import serializers
from apps.contacts.models import ContactGroup, Contact, ContactGroupMembership


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


class ContactImportSerializer(serializers.Serializer):
    file = serializers.FileField()
    group_id = serializers.CharField(required=False, allow_blank=True)

    def validate_file(self, value):
        if not value.name.lower().endswith(('.csv', '.xlsx')):
            raise serializers.ValidationError("File must be CSV or Excel format")
        return value
