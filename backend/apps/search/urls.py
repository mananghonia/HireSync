from django.urls import path
from .views import JobSearchView, JobRecommendationView

urlpatterns = [
    path("jobs/", JobSearchView.as_view(), name="job_search"),
    path("recommendations/", JobRecommendationView.as_view(), name="job_recommendations"),
]
