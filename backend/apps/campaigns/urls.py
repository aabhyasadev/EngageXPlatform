from .views import CampaignViewSet
from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'campaigns', CampaignViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
