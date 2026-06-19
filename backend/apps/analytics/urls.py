from django.urls import path
from .views import RecruiterDashboardView, JobAnalyticsView

urlpatterns = [
    path("recruiter/dashboard/", RecruiterDashboardView.as_view(), name="recruiter_dashboard"),
    path("recruiter/jobs/<str:job_id>/", JobAnalyticsView.as_view(), name="job_analytics"),
]
