from rest_framework import serializers

from apps.templates.models import EmailTemplate


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'organization', 'name', 'subject', 'html_content',
            'text_content', 'is_default', 'category',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def to_internal_value(self, data):
        """Transform field names from camelCase to snake_case for backend"""
        transformed_data = {}
        
        for key, value in data.items():
            if key == 'htmlContent':
                transformed_data['html_content'] = value
            elif key == 'textContent':
                transformed_data['text_content'] = value
            elif key == 'isDefault':
                transformed_data['is_default'] = value
            elif key == 'createdAt':
                transformed_data['created_at'] = value
            elif key == 'updatedAt':
                transformed_data['updated_at'] = value
            else:
                transformed_data[key] = value
        
        return super().to_internal_value(transformed_data)
    
    def to_representation(self, instance):
        """Transform field names from snake_case to camelCase for frontend"""
        data = super().to_representation(instance)
        return {
            'id': data['id'],
            'organization': data['organization'],
            'name': data['name'],
            'subject': data['subject'],
            'htmlContent': data['html_content'],
            'textContent': data['text_content'],
            'isDefault': data['is_default'],
            'category': data['category'],
            'createdAt': data['created_at'],
            'updatedAt': data['updated_at']
        }
