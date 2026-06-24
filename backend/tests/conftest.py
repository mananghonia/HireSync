"""
Shared fixtures for HireSync test suite.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


# ── Cache / throttle reset ─────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cache():
    """Clear Django cache (throttle counters) before and after every test."""
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


# ── Base API client ────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    return APIClient()


# ── User factories ─────────────────────────────────────────────────────────────

@pytest.fixture
def make_user(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()

    def _make(email="user@test.com", password="Test@1234", role="seeker", **kw):
        return User.objects.create_user(
            email=email,
            password=password,
            first_name=kw.pop("first_name", "Test"),
            last_name=kw.pop("last_name", "User"),
            role=role,
            is_verified=True,
            **kw,
        )
    return _make


@pytest.fixture
def seeker(make_user):
    return make_user(email="seeker@test.com", role="seeker",
                     first_name="John", last_name="Doe")


@pytest.fixture
def recruiter(make_user):
    return make_user(email="recruiter@test.com", role="recruiter",
                     first_name="Jane", last_name="Smith")


@pytest.fixture
def admin_user(make_user):
    return make_user(email="admin@test.com", role="admin",
                     first_name="Admin", last_name="User")


# ── Authenticated clients ──────────────────────────────────────────────────────

def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    return client


@pytest.fixture
def seeker_client(seeker):
    return _auth_client(seeker)


@pytest.fixture
def recruiter_client(recruiter):
    return _auth_client(recruiter)


@pytest.fixture
def admin_client(admin_user):
    return _auth_client(admin_user)


# ── Domain objects ─────────────────────────────────────────────────────────────

@pytest.fixture
def skill(db):
    from apps.profiles.models import Skill
    return Skill.objects.create(name="Python", slug="python", category="Programming")


@pytest.fixture
def company(db):
    from apps.profiles.models import Company
    return Company.objects.create(
        name="Test Corp",
        slug="test-corp",
        industry="technology",
        size="11-50",
        location="Mumbai",
    )


@pytest.fixture
def recruiter_profile(recruiter, company):
    from apps.profiles.models import RecruiterProfile
    profile, _ = RecruiterProfile.objects.get_or_create(user=recruiter)
    profile.company = company
    profile.save()
    return profile


@pytest.fixture
def job(db, recruiter, company, skill):
    from apps.jobs.models import Job
    j = Job.objects.create(
        recruiter=recruiter,
        company=company,
        title="Backend Developer",
        description="Python Django developer needed",
        requirements="2+ years Python",
        job_type="full_time",
        experience_level="junior",
        location="Mumbai",
        status="active",
    )
    j.skills.add(skill)
    return j


@pytest.fixture
def seeker_profile(seeker):
    from apps.profiles.models import JobSeekerProfile
    profile, _ = JobSeekerProfile.objects.get_or_create(user=seeker)
    return profile


@pytest.fixture
def dummy_resume():
    return SimpleUploadedFile(
        "resume.txt", b"Experienced Python developer with Django skills.",
        content_type="text/plain"
    )


@pytest.fixture
def application(db, seeker, job, dummy_resume):
    from apps.applications.models import Application, ApplicationStatusHistory
    app = Application.objects.create(
        applicant=seeker,
        job=job,
        cover_letter="I am interested",
        resume_snapshot=dummy_resume,
    )
    ApplicationStatusHistory.objects.create(
        application=app, old_status="", new_status="applied", changed_by=seeker
    )
    return app


@pytest.fixture
def notification(db, seeker):
    from apps.notifications.models import Notification
    return Notification.objects.create(
        recipient=seeker,
        notification_type="general",
        title="Test Notification",
        message="You have a test notification.",
    )
