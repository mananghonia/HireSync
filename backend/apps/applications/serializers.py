from rest_framework import serializers
from apps.jobs.serializers import JobListSerializer
from apps.users.serializers import UserSerializer
from .models import Application, ApplicationStatusHistory, RecruiterNote


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationStatusHistory
        fields = ["id", "old_status", "new_status", "changed_by_name", "note", "changed_at"]

    def get_changed_by_name(self, obj):
        return obj.changed_by.get_full_name() if obj.changed_by else "System"


class RecruiterNoteSerializer(serializers.ModelSerializer):
    recruiter_name = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterNote
        fields = ["id", "note", "recruiter_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_recruiter_name(self, obj):
        return obj.recruiter.get_full_name()


class ApplicationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ["id", "job", "cover_letter", "resume_snapshot"]

    def validate_job(self, job):
        if job.status != "active":
            raise serializers.ValidationError("This job is no longer accepting applications.")
        return job


class ApplicationSeekerSerializer(serializers.ModelSerializer):
    """Seeker view — shows their own applications."""
    job = JobListSerializer(read_only=True)
    status_history = ApplicationStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = ["id", "job", "cover_letter", "resume_snapshot", "status", "applied_at", "updated_at", "status_history"]
        read_only_fields = ["id", "status", "applied_at", "updated_at"]


class ApplicationRecruiterSerializer(serializers.ModelSerializer):
    """Recruiter view — shows applicant info."""
    applicant = UserSerializer(read_only=True)
    status_history = ApplicationStatusHistorySerializer(many=True, read_only=True)
    recruiter_notes = RecruiterNoteSerializer(many=True, read_only=True)
    skill_match_score = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "applicant", "cover_letter", "resume_snapshot",
            "status", "applied_at", "updated_at",
            "status_history", "recruiter_notes", "skill_match_score",
        ]

    def get_skill_match_score(self, obj):
        import math
        try:
            seeker_skills = set(obj.applicant.seeker_profile.skills.values_list("id", flat=True))
            job_skills = set(obj.job.skills.values_list("id", flat=True))
            if not seeker_skills or not job_skills:
                return 0
            intersection = len(seeker_skills & job_skills)
            return round(intersection / math.sqrt(len(seeker_skills) * len(job_skills)) * 100, 1)
        except Exception:
            return 0


class UpdateApplicationStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Application.STATUS_CHOICES)
    note = serializers.CharField(required=False, allow_blank=True)
