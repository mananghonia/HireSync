from django.db import models
from django.conf import settings
from django_mongodb_backend.fields import ObjectIdAutoField


class Notification(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    TYPE_CHOICES = [
        ("application_status", "Application Status Update"),
        ("new_application", "New Application Received"),
        ("new_message", "New Message"),
        ("job_recommendation", "Job Recommendation"),
        ("general", "General"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="general")
    title = models.CharField(max_length=200)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.notification_type} → {self.recipient.email}"
