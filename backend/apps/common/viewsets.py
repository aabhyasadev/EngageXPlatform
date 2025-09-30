"""
Common base viewsets for EngageX API endpoints.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated


class BaseOrganizationViewSet(viewsets.ModelViewSet):
    """Base viewset that filters by organization"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.organization:
            return self.queryset.none()
        return self.queryset.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        if self.request.user.organization:
            serializer.save(organization=self.request.user.organization)
