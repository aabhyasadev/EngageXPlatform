from rest_framework import serializers
from apps.subscriptions.models import Card


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
