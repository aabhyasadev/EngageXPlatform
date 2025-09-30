from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AnalyticsEventViewSet

router = DefaultRouter()
router.register(r'analytics/events', AnalyticsEventViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
