from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Organization, User, Invitation, OrganizationMembership
from apps.common.constants import MembershipStatus

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
    role = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()  # Organization-scoped activity status
    membership_status = serializers.SerializerMethodField()  # Explicit membership status

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'profile_image_url',
            'organization', 'role', 'is_active', 'membership_status', 
            'created_at', 'updated_at', 'full_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def _get_membership(self, obj):
        """Helper method to get organization membership"""
        request = self.context.get('request')
        if not request:
            return None
        
        current_organization_id = request.session.get('current_organization_id')
        if not current_organization_id:
            return None
        
        return OrganizationMembership.objects.filter(
            user=obj,
            organization_id=current_organization_id
        ).first()

    def get_role(self, obj):
        """Get the user's role in the current organization context"""
        membership = self._get_membership(obj)
        return membership.role if membership else obj.role

    def get_is_active(self, obj):
        """Get organization-scoped activity status (NOT global User.is_active)"""
        membership = self._get_membership(obj)
        if not membership:
            return False
        
        return membership.status == MembershipStatus.ACTIVE

    def get_membership_status(self, obj):
        """Get explicit membership status for clarity"""
        membership = self._get_membership(obj)
        return membership.status if membership else 'none'


class InvitationSerializer(serializers.ModelSerializer):
    organization_name = serializers.SerializerMethodField()
    invited_by_name = serializers.SerializerMethodField()
    role_display = serializers.ReadOnlyField(source='get_role_display')
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = Invitation
        fields = [
            'id', 'email', 'role', 'status', 'expires_at',
            'created_at', 'updated_at', 'organization_name', 'invited_by_name',
            'role_display', 'is_expired'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_organization_name(self, obj):
        return obj.organization.name

    def get_invited_by_name(self, obj):
        return obj.invited_by.full_name


class InvitationVerifySerializer(serializers.ModelSerializer):
    organization_name = serializers.SerializerMethodField()
    invited_by_name = serializers.SerializerMethodField()
    role_display = serializers.ReadOnlyField(source='get_role_display')
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = Invitation
        fields = [
            'id', 'email', 'role', 'status', 'expires_at',
            'created_at', 'updated_at', 'organization_name', 'invited_by_name',
            'role_display', 'is_expired'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_organization_name(self, obj):
        return obj.organization.name

    def get_invited_by_name(self, obj):
        return obj.invited_by.full_name
