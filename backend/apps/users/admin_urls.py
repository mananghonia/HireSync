from django.urls import path
from .admin_views import (
    AdminStatsView,
    AdminUserListView,
    AdminUserDetailView,
    AdminJobListView,
    AdminJobDetailView,
)

urlpatterns = [
    path("stats/", AdminStatsView.as_view(), name="admin_stats"),
    path("users/", AdminUserListView.as_view(), name="admin_users"),
    path("users/<str:user_id>/", AdminUserDetailView.as_view(), name="admin_user_detail"),
    path("jobs/", AdminJobListView.as_view(), name="admin_jobs"),
    path("jobs/<str:job_id>/", AdminJobDetailView.as_view(), name="admin_job_detail"),
]
