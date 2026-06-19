from django.contrib import admin
from .models import Skill, JobSeekerProfile, Experience, Education, Company, RecruiterProfile


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "category"]
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ["name"]


@admin.register(JobSeekerProfile)
class JobSeekerProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "headline", "experience_level", "is_open_to_work"]
    list_filter = ["experience_level", "is_open_to_work"]
    search_fields = ["user__email", "user__first_name"]


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "industry", "size", "is_verified"]
    list_filter = ["industry", "is_verified"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(RecruiterProfile)
class RecruiterProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "company", "job_title"]
    search_fields = ["user__email", "company__name"]
