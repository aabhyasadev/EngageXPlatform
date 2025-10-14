from django.urls import path, include
from .views import AnalyticsEventViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'analytics/events', AnalyticsEventViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
