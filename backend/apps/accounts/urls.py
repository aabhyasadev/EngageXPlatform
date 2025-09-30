from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrganizationViewSet, UserViewSet, InvitationViewSet

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'users', UserViewSet)
router.register(r'invitations', InvitationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
