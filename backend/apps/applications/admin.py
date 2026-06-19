from django.contrib import admin
from .models import Application, ApplicationStatusHistory, RecruiterNote


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["applicant", "job", "status", "applied_at"]
    list_filter = ["status"]
    search_fields = ["applicant__email", "job__title"]


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ["application", "old_status", "new_status", "changed_by", "changed_at"]


@admin.register(RecruiterNote)
class RecruiterNoteAdmin(admin.ModelAdmin):
    list_display = ["application", "recruiter", "created_at"]
