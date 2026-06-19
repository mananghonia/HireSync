from django.contrib import admin
from .models import Job, SavedJob, JobView


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ["title", "company", "recruiter", "job_type", "status", "views_count", "created_at"]
    list_filter = ["status", "job_type", "experience_level", "is_remote"]
    search_fields = ["title", "company__name", "recruiter__email"]
    readonly_fields = ["views_count", "created_at", "updated_at"]


@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ["user", "job", "saved_at"]


@admin.register(JobView)
class JobViewAdmin(admin.ModelAdmin):
    list_display = ["job", "user", "viewed_at", "ip_address"]
