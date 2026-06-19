from rest_framework import serializers
from apps.profiles.serializers import SkillSerializer, CompanySerializer
from .models import Job, SavedJob


class JobListSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)
    recruiter_name = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    has_applied = serializers.SerializerMethodField()
    application_status = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "title", "company", "recruiter_name", "job_type", "experience_level",
            "location", "is_remote", "salary_min", "salary_max", "salary_currency",
            "skills", "status", "views_count", "application_deadline",
            "is_saved", "has_applied", "application_status", "created_at",
        ]

    def get_recruiter_name(self, obj):
        return obj.recruiter.get_full_name()

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return SavedJob.objects.filter(user=request.user, job=obj).exists()
        return False

    def _get_application(self, obj, request):
        if request and request.user.is_authenticated:
            return obj.applications.filter(applicant=request.user).first()
        return None

    def get_has_applied(self, obj):
        request = self.context.get("request")
        app = self._get_application(obj, request)
        # withdrawn is treated as "not applied" — user can re-apply
        return bool(app and app.status != "withdrawn")

    def get_application_status(self, obj):
        request = self.context.get("request")
        app = self._get_application(obj, request)
        return app.status if app else None


class JobDetailSerializer(JobListSerializer):
    class Meta(JobListSerializer.Meta):
        fields = JobListSerializer.Meta.fields + ["description", "requirements", "responsibilities", "updated_at"]


class JobCreateUpdateSerializer(serializers.ModelSerializer):
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, source="skills",
        queryset=__import__("apps.profiles.models", fromlist=["Skill"]).Skill.objects.all(),
    )
    company_id = serializers.PrimaryKeyRelatedField(
        write_only=True, source="company",
        queryset=__import__("apps.profiles.models", fromlist=["Company"]).Company.objects.all(),
    )

    class Meta:
        model = Job
        fields = [
            "id", "title", "company_id", "description", "requirements", "responsibilities",
            "skill_ids", "job_type", "experience_level", "location", "is_remote",
            "salary_min", "salary_max", "salary_currency", "application_deadline", "status",
        ]

    def validate(self, data):
        if data.get("salary_min") and data.get("salary_max"):
            if data["salary_min"] > data["salary_max"]:
                raise serializers.ValidationError("salary_min cannot exceed salary_max.")
        return data


class SavedJobSerializer(serializers.ModelSerializer):
    job = JobListSerializer(read_only=True)

    class Meta:
        model = SavedJob
        fields = ["id", "job", "saved_at"]
