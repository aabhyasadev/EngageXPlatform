from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContactGroupViewSet, ContactViewSet

router = DefaultRouter()
router.register(r'contact-groups', ContactGroupViewSet)
router.register(r'contacts', ContactViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
