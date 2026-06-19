from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SeekerApplicationViewSet, RecruiterApplicationViewSet

router = DefaultRouter()
router.register("my", SeekerApplicationViewSet, basename="my_application")
router.register("manage", RecruiterApplicationViewSet, basename="manage_application")

urlpatterns = [
    path("", include(router.urls)),
]
