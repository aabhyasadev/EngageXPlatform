from rest_framework import status
from apps.subscriptions.models import Card
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.common.viewsets import BaseOrganizationViewSet
from apps.subscriptions.serializers import (CardSerializer, CardCreateSerializer, CardUpdateSerializer)


class CardViewSet(BaseOrganizationViewSet):
    """ViewSet for managing cards"""
    queryset = Card.objects.all()
    serializer_class = CardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get cards for the current organization"""
        if not self.request.user.organization:
            return Card.objects.none()
        return Card.objects.filter(organization=self.request.user.organization).order_by('-is_default', '-created_at')

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return CardCreateSerializer
        elif self.action == 'update' or self.action == 'partial_update':
            return CardUpdateSerializer
        return CardSerializer

    def create(self, request, *args, **kwargs):
        """Create a new card with direct card details"""        
        if not request.user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        org = request.user.organization
        
        try:
            # Extract safe card details from validated data
            validated_data = serializer.validated_data
            
            # Create card record with safe details only (PCI compliant)
            card = Card.objects.create(
                organization=org,
                cardholder_name=validated_data.get('cardholder_name'),
                last4=validated_data.get('last4'),  # Already validated to be 4 digits
                brand=validated_data.get('brand'),  # Already validated brand
                exp_month=validated_data.get('exp_month'),
                exp_year=validated_data.get('exp_year'),
                is_default=validated_data.get('set_as_default', True)
            )

            return Response(
                CardSerializer(card).data,
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            return Response({
                'error': f'Error creating card: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



    def destroy(self, request, pk=None):
        """Delete a card"""
        try:
            card = self.get_object()
            
            # If this was the default card, set another card as default
            if card.is_default:
                org = request.user.organization
                other_card = Card.objects.filter(
                    organization=org
                ).exclude(id=card.id).first()
                
                if other_card:
                    other_card.is_default = True
                    other_card.save()
            
            # Delete the card
            card.delete()
            
            return Response({'message': 'Card deleted successfully'})
            
        except Exception as e:
            return Response({
                'error': f'Error deleting card: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def default(self, request):
        """Get the default card for the organization"""
        if not request.user.organization:
            return Response({
                'error': 'User not associated with organization'
            }, status=status.HTTP_400_BAD_REQUEST)

        default_card = Card.objects.filter(
            organization=request.user.organization,
            is_default=True
        ).first()

        if not default_card:
            return Response({
                'message': 'No default card found'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response(CardSerializer(default_card).data)
