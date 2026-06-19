from django.urls import path
from .views import NotificationListView, mark_all_read, mark_read, unread_count

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications"),
    path("unread-count/", unread_count, name="unread_count"),
    path("mark-all-read/", mark_all_read, name="mark_all_read"),
    path("<int:pk>/read/", mark_read, name="mark_read"),
]
