from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SkillListView,
    SeekerProfileView,
    SeekerProfileDetailView,
    ExperienceViewSet,
    EducationViewSet,
    CompanyViewSet,
    RecruiterProfileView,
)

router = DefaultRouter()
router.register("experience", ExperienceViewSet, basename="experience")
router.register("education", EducationViewSet, basename="education")
router.register("companies", CompanyViewSet, basename="company")

urlpatterns = [
    path("skills/", SkillListView.as_view(), name="skills"),
    path("seeker/", SeekerProfileView.as_view(), name="seeker_profile"),
    path("seeker/<uuid:user_id>/", SeekerProfileDetailView.as_view(), name="seeker_profile_detail"),
    path("recruiter/", RecruiterProfileView.as_view(), name="recruiter_profile"),
    path("", include(router.urls)),
]
