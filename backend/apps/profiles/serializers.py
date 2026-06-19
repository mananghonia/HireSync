from rest_framework import serializers
from django.utils.text import slugify
from .models import Skill, JobSeekerProfile, Experience, Education, Company, RecruiterProfile


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "name", "slug", "category"]
        read_only_fields = ["slug"]

    def create(self, validated_data):
        validated_data["slug"] = slugify(validated_data["name"])
        return super().create(validated_data)


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = ["id", "company", "title", "location", "start_date", "end_date", "is_current", "description"]


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = ["id", "institution", "degree", "field_of_study", "start_year", "end_year", "grade", "description"]


class JobSeekerProfileSerializer(serializers.ModelSerializer):
    skills = SkillSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Skill.objects.all(), write_only=True, source="skills"
    )
    experiences = ExperienceSerializer(many=True, read_only=True)
    education = EducationSerializer(many=True, read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    class Meta:
        model = JobSeekerProfile
        fields = [
            "id", "full_name", "email", "photo", "bio", "headline", "location",
            "website", "linkedin_url", "github_url", "resume", "resume_filename",
            "experience_level", "skills", "skill_ids",
            "expected_salary_min", "expected_salary_max", "is_open_to_work",
            "experiences", "education", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_email(self, obj):
        return obj.user.email


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id", "name", "slug", "logo", "description", "industry",
            "size", "website", "location", "founded_year", "is_verified", "created_at",
        ]
        read_only_fields = ["slug", "is_verified", "created_at"]

    def create(self, validated_data):
        validated_data["slug"] = slugify(validated_data["name"])
        return super().create(validated_data)


class RecruiterProfileSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    company_id = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(), write_only=True, source="company", required=False
    )
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterProfile
        fields = [
            "id", "full_name", "email", "company", "company_id",
            "job_title", "photo", "bio", "phone", "linkedin_url",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_email(self, obj):
        return obj.user.email
