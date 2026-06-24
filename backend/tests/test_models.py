"""
Unit tests for model methods, properties, and class methods.
"""
import pytest
from django.utils import timezone


# ── User model ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserModel:
    def test_get_full_name(self, seeker):
        assert seeker.get_full_name() == "John Doe"

    def test_str(self, seeker):
        assert "John Doe" in str(seeker)
        assert "seeker@test.com" in str(seeker)

    def test_is_seeker_true(self, seeker):
        assert seeker.is_seeker is True
        assert seeker.is_recruiter is False
        assert seeker.is_admin_user is False

    def test_is_recruiter_true(self, recruiter):
        assert recruiter.is_recruiter is True
        assert recruiter.is_seeker is False
        assert recruiter.is_admin_user is False

    def test_is_admin_true(self, admin_user):
        assert admin_user.is_admin_user is True
        assert admin_user.is_seeker is False
        assert admin_user.is_recruiter is False

    def test_email_normalized_on_create(self, make_user):
        u = make_user(email="Upper@EXAMPLE.COM")
        assert u.email == "Upper@example.com"

    def test_uuid_primary_key(self, seeker):
        import uuid
        assert isinstance(seeker.pk, uuid.UUID)

    def test_is_verified_default(self, db):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        u = User.objects.create_user(email="fresh@test.com", password="x",
                                      first_name="A", last_name="B")
        assert u.is_verified is False


# ── OTPVerification model ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestOTPVerificationModel:
    def test_generate_creates_otp(self):
        from apps.users.models import OTPVerification
        otp_obj = OTPVerification.generate("otp@test.com")
        assert otp_obj.pk is not None
        assert len(otp_obj.otp) == 6
        assert otp_obj.otp.isdigit()
        assert not otp_obj.is_used

    def test_generate_invalidates_previous_otps(self):
        from apps.users.models import OTPVerification
        OTPVerification.generate("multi@test.com")
        OTPVerification.generate("multi@test.com")
        # Previous unused OTPs should be deleted
        count = OTPVerification.objects.filter(email="multi@test.com", is_used=False).count()
        assert count == 1

    def test_is_valid_fresh(self):
        from apps.users.models import OTPVerification
        otp_obj = OTPVerification.generate("valid@test.com")
        assert otp_obj.is_valid() is True

    def test_is_valid_used(self):
        from apps.users.models import OTPVerification
        otp_obj = OTPVerification.generate("used@test.com")
        otp_obj.is_used = True
        otp_obj.save()
        assert otp_obj.is_valid() is False

    def test_is_valid_expired(self):
        from apps.users.models import OTPVerification
        otp_obj = OTPVerification.generate("expired@test.com")
        otp_obj.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        otp_obj.save()
        assert otp_obj.is_valid() is False


# ── Skill model ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSkillModel:
    def test_str(self, skill):
        assert str(skill) == "Python"

    def test_unique_name(self, skill):
        from django.db import IntegrityError
        from apps.profiles.models import Skill
        with pytest.raises(Exception):
            Skill.objects.create(name="Python", slug="python-2")


# ── Company model ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCompanyModel:
    def test_str(self, company):
        assert str(company) == "Test Corp"

    def test_is_verified_default_false(self, company):
        assert company.is_verified is False


# ── Job model ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobModel:
    def test_str(self, job):
        assert "Backend Developer" in str(job)
        assert "Test Corp" in str(job)

    def test_default_status_active(self, job):
        assert job.status == "active"

    def test_views_count_default_zero(self, job):
        assert job.views_count == 0

    def test_skills_many_to_many(self, job, skill):
        assert skill in job.skills.all()


# ── Application model ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestApplicationModel:
    def test_str(self, application):
        s = str(application)
        assert "John Doe" in s
        assert "Backend Developer" in s

    def test_default_status_applied(self, application):
        assert application.status == "applied"


# ── Notification model ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestNotificationModel:
    def test_str(self, notification):
        assert "general" in str(notification)
        assert "seeker@test.com" in str(notification)

    def test_default_not_read(self, notification):
        assert notification.is_read is False


# ── Permissions unit tests ─────────────────────────────────────────────────────

class TestPermissions:
    """Pure unit tests for permission classes — no DB needed."""

    def _make_request(self, user):
        from unittest.mock import MagicMock
        req = MagicMock()
        req.user = user
        return req

    def _make_user(self, authenticated=True, role="seeker"):
        from unittest.mock import MagicMock
        u = MagicMock()
        u.is_authenticated = authenticated
        u.role = role
        return u

    def test_is_job_seeker_allows_seeker(self):
        from core.permissions import IsJobSeeker
        perm = IsJobSeeker()
        req = self._make_request(self._make_user(role="seeker"))
        assert perm.has_permission(req, None) is True

    def test_is_job_seeker_blocks_recruiter(self):
        from core.permissions import IsJobSeeker
        perm = IsJobSeeker()
        req = self._make_request(self._make_user(role="recruiter"))
        assert perm.has_permission(req, None) is False

    def test_is_job_seeker_blocks_unauthenticated(self):
        from core.permissions import IsJobSeeker
        perm = IsJobSeeker()
        req = self._make_request(self._make_user(authenticated=False, role="seeker"))
        assert perm.has_permission(req, None) is False

    def test_is_recruiter_allows_recruiter(self):
        from core.permissions import IsRecruiter
        perm = IsRecruiter()
        req = self._make_request(self._make_user(role="recruiter"))
        assert perm.has_permission(req, None) is True

    def test_is_recruiter_blocks_seeker(self):
        from core.permissions import IsRecruiter
        perm = IsRecruiter()
        req = self._make_request(self._make_user(role="seeker"))
        assert perm.has_permission(req, None) is False

    def test_is_admin_allows_admin(self):
        from core.permissions import IsAdmin
        perm = IsAdmin()
        req = self._make_request(self._make_user(role="admin"))
        assert perm.has_permission(req, None) is True

    def test_is_admin_blocks_seeker(self):
        from core.permissions import IsAdmin
        perm = IsAdmin()
        req = self._make_request(self._make_user(role="seeker"))
        assert perm.has_permission(req, None) is False

    def test_is_owner_or_admin_owner(self):
        from core.permissions import IsOwnerOrAdmin
        from unittest.mock import MagicMock
        perm = IsOwnerOrAdmin()
        user = self._make_user(role="seeker")
        obj = MagicMock()
        obj.user = user
        req = self._make_request(user)
        assert perm.has_object_permission(req, None, obj) is True

    def test_is_owner_or_admin_admin_override(self):
        from core.permissions import IsOwnerOrAdmin
        from unittest.mock import MagicMock
        perm = IsOwnerOrAdmin()
        admin = self._make_user(role="admin")
        other = self._make_user(role="seeker")
        obj = MagicMock()
        obj.user = other
        req = self._make_request(admin)
        assert perm.has_object_permission(req, None, obj) is True

    def test_is_owner_or_admin_non_owner_blocked(self):
        from core.permissions import IsOwnerOrAdmin
        from unittest.mock import MagicMock
        perm = IsOwnerOrAdmin()
        user = self._make_user(role="seeker")
        stranger = self._make_user(role="seeker")
        stranger.role = "seeker"
        obj = MagicMock()
        obj.user = stranger
        obj.owner = None
        req = self._make_request(user)
        assert perm.has_object_permission(req, None, obj) is False


# ── Throttling unit tests ──────────────────────────────────────────────────────

class TestThrottling:
    """Unit tests for custom throttle IP extraction."""

    def _mock_request(self, xff=None, remote_addr="1.2.3.4"):
        from unittest.mock import MagicMock
        req = MagicMock()
        req.META = {}
        if xff:
            req.META["HTTP_X_FORWARDED_FOR"] = xff
        req.META["REMOTE_ADDR"] = remote_addr
        return req

    def test_get_ident_uses_remote_addr_when_no_xff(self):
        from core.throttling import AuthRateThrottle
        throttle = AuthRateThrottle()
        req = self._mock_request(remote_addr="5.6.7.8")
        assert throttle.get_ident(req) == "5.6.7.8"

    def test_get_ident_uses_first_xff_ip(self):
        from core.throttling import AuthRateThrottle
        throttle = AuthRateThrottle()
        req = self._mock_request(xff="10.0.0.1, 192.168.1.1, 172.16.0.1")
        assert throttle.get_ident(req) == "10.0.0.1"

    def test_get_ident_single_xff(self):
        from core.throttling import OTPRateThrottle
        throttle = OTPRateThrottle()
        req = self._mock_request(xff="203.0.113.5")
        assert throttle.get_ident(req) == "203.0.113.5"

    def test_auth_throttle_scope(self):
        from core.throttling import AuthRateThrottle
        assert AuthRateThrottle.scope == "auth"

    def test_otp_throttle_scope(self):
        from core.throttling import OTPRateThrottle
        assert OTPRateThrottle.scope == "otp"
