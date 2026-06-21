from django.db import models
from django.conf import settings
from django_mongodb_backend.fields import ObjectIdAutoField
from apps.jobs.models import Job


class Application(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    STATUS_CHOICES = [
        ("applied", "Applied"),
        ("viewed", "Viewed"),
        ("shortlisted", "Shortlisted"),
        ("interview_scheduled", "Interview Scheduled"),
        ("interviewed", "Interviewed"),
        ("offer_made", "Offer Made"),
        ("hired", "Hired"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ]

    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications"
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="applications")
    cover_letter = models.TextField(blank=True)
    resume_snapshot = models.FileField(upload_to="applications/resumes/", blank=True, null=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="applied")
    interview_scheduled_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "applications"
        unique_together = ["applicant", "job"]
        ordering = ["-applied_at"]

    def __str__(self):
        return f"{self.applicant.get_full_name()} → {self.job.title}"


class ApplicationStatusHistory(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="status_history")
    old_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    note = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "application_status_history"
        ordering = ["-changed_at"]


class RecruiterNote(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="recruiter_notes")
    recruiter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recruiter_notes"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note on {self.application} by {self.recruiter.get_full_name()}"
