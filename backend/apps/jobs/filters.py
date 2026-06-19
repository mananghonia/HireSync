import django_filters
from .models import Job


class JobFilter(django_filters.FilterSet):
    title = django_filters.CharFilter(lookup_expr="icontains")
    location = django_filters.CharFilter(lookup_expr="icontains")
    salary_min = django_filters.NumberFilter(field_name="salary_min", lookup_expr="gte")
    salary_max = django_filters.NumberFilter(field_name="salary_max", lookup_expr="lte")
    skills = django_filters.BaseInFilter(field_name="skills__id", lookup_expr="in")
    company = django_filters.NumberFilter(field_name="company__id")

    class Meta:
        model = Job
        fields = ["job_type", "experience_level", "is_remote", "status", "title", "location", "salary_min", "salary_max", "skills", "company"]
