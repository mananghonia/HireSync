from django.db import models
from django.conf import settings
from django_mongodb_backend.fields import ObjectIdAutoField
from apps.profiles.models import Skill, Company


class Job(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    TYPE_CHOICES = [
        ("full_time", "Full Time"),
        ("part_time", "Part Time"),
        ("contract", "Contract"),
        ("internship", "Internship"),
        ("freelance", "Freelance"),
        ("remote", "Remote"),
    ]

    EXPERIENCE_CHOICES = [
        ("fresher", "Fresher"),
        ("junior", "Junior (1-2 years)"),
        ("mid", "Mid-level (3-5 years)"),
        ("senior", "Senior (6+ years)"),
        ("any", "Any Experience Level"),
    ]

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("closed", "Closed"),
    ]

    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posted_jobs"
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="jobs")
    title = models.CharField(max_length=300)
    description = models.TextField()
    requirements = models.TextField(blank=True)
    responsibilities = models.TextField(blank=True)
    skills = models.ManyToManyField(Skill, blank=True, related_name="jobs")
    job_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="full_time")
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_CHOICES, default="any")
    location = models.CharField(max_length=200, blank=True)
    is_remote = models.BooleanField(default=False)
    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)
    salary_currency = models.CharField(max_length=10, default="INR")
    application_deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    views_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "jobs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} @ {self.company.name}"


class SavedJob(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_jobs")
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="saved_by")
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "saved_jobs"
        unique_together = ["user", "job"]

    def __str__(self):
        return f"{self.user.email} saved {self.job.title}"


class JobView(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="job_views")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    viewed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "job_views"
