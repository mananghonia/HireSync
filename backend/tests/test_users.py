"""
Tests for apps/users — auth endpoints.
"""
import pytest
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken


BASE = "/api/v1/auth"


# ── Send Registration OTP ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSendRegistrationOTP:
    url = f"{BASE}/send-registration-otp/"

    def test_missing_email_returns_400(self, api_client):
        r = api_client.post(self.url, {}, format="json")
        assert r.status_code == 400

    def test_existing_email_returns_400(self, api_client, seeker):
        r = api_client.post(self.url, {"email": seeker.email}, format="json")
        assert r.status_code == 400
        assert "already exists" in r.data["detail"].lower()

    def test_new_email_sends_otp(self, api_client):
        r = api_client.post(self.url, {"email": "new@test.com"}, format="json")
        assert r.status_code == 200
        assert "sent" in r.data["detail"].lower()

    def test_otp_object_created(self, api_client):
        from apps.users.models import OTPVerification
        api_client.post(self.url, {"email": "otpcheck@test.com"}, format="json")
        assert OTPVerification.objects.filter(email="otpcheck@test.com", is_used=False).exists()


# ── Register ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRegister:
    url = f"{BASE}/register/"

    def _valid_otp(self, email):
        from apps.users.models import OTPVerification
        return OTPVerification.generate(email)

    def test_missing_otp_returns_400(self, api_client):
        r = api_client.post(self.url, {
            "email": "reg@test.com", "password": "Test@1234", "password_confirm": "Test@1234",
            "first_name": "A", "last_name": "B", "role": "seeker",
        }, format="json")
        assert r.status_code == 400

    def test_invalid_otp_returns_400(self, api_client):
        r = api_client.post(self.url, {
            "email": "inv@test.com", "otp": "000000",
            "password": "Test@1234", "password_confirm": "Test@1234",
            "first_name": "A", "last_name": "B", "role": "seeker",
        }, format="json")
        assert r.status_code == 400
        assert "invalid" in r.data["detail"].lower()

    def test_expired_otp_returns_400(self, api_client):
        from apps.users.models import OTPVerification
        otp_obj = self._valid_otp("expired_reg@test.com")
        otp_obj.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        otp_obj.save()
        r = api_client.post(self.url, {
            "email": "expired_reg@test.com", "otp": otp_obj.otp,
            "password": "Test@1234", "password_confirm": "Test@1234",
            "first_name": "A", "last_name": "B", "role": "seeker",
        }, format="json")
        assert r.status_code == 400
        assert "expired" in r.data["detail"].lower()

    def test_successful_registration_returns_201(self, api_client):
        from django.contrib.auth import get_user_model
        otp_obj = self._valid_otp("newreg@test.com")
        r = api_client.post(self.url, {
            "email": "newreg@test.com", "otp": otp_obj.otp,
            "password": "Test@1234", "password_confirm": "Test@1234",
            "first_name": "New", "last_name": "User", "role": "seeker",
        }, format="json")
        assert r.status_code == 201
        assert "tokens" in r.data
        assert "access" in r.data["tokens"]
        User = get_user_model()
        assert User.objects.filter(email="newreg@test.com").exists()

    def test_otp_marked_used_after_register(self, api_client):
        from apps.users.models import OTPVerification
        otp_obj = self._valid_otp("usedotp@test.com")
        api_client.post(self.url, {
            "email": "usedotp@test.com", "otp": otp_obj.otp,
            "password": "Test@1234", "password_confirm": "Test@1234",
            "first_name": "A", "last_name": "B", "role": "seeker",
        }, format="json")
        otp_obj.refresh_from_db()
        assert otp_obj.is_used is True

    def test_password_mismatch_returns_400(self, api_client):
        otp_obj = self._valid_otp("mismatch@test.com")
        r = api_client.post(self.url, {
            "email": "mismatch@test.com", "otp": otp_obj.otp,
            "password": "Test@1234", "password_confirm": "Wrong@1234",
            "first_name": "A", "last_name": "B", "role": "seeker",
        }, format="json")
        assert r.status_code == 400


# ── Login ──────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogin:
    url = f"{BASE}/login/"

    def test_valid_credentials_returns_200(self, api_client, seeker):
        r = api_client.post(self.url, {"email": seeker.email, "password": "Test@1234"}, format="json")
        assert r.status_code == 200
        assert "access" in r.data

    def test_invalid_password_returns_401(self, api_client, seeker):
        r = api_client.post(self.url, {"email": seeker.email, "password": "wrong"}, format="json")
        assert r.status_code == 401

    def test_nonexistent_user_returns_401(self, api_client):
        r = api_client.post(self.url, {"email": "nobody@test.com", "password": "x"}, format="json")
        assert r.status_code == 401

    def test_response_includes_user_data(self, api_client, seeker):
        r = api_client.post(self.url, {"email": seeker.email, "password": "Test@1234"}, format="json")
        assert r.data["user"]["role"] == "seeker"
        assert r.data["user"]["email"] == seeker.email


# ── Me ────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMe:
    url = f"{BASE}/me/"

    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401

    def test_seeker_gets_own_data(self, seeker_client, seeker):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert r.data["email"] == seeker.email
        assert r.data["role"] == "seeker"

    def test_recruiter_gets_own_data(self, recruiter_client, recruiter):
        r = recruiter_client.get(self.url)
        assert r.status_code == 200
        assert r.data["role"] == "recruiter"

    def test_patch_updates_name(self, seeker_client, seeker):
        r = seeker_client.patch(self.url, {"first_name": "Updated"}, format="json")
        assert r.status_code == 200
        seeker.refresh_from_db()
        assert seeker.first_name == "Updated"


# ── Change Password ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestChangePassword:
    url = f"{BASE}/change-password/"

    def test_wrong_old_password_returns_400(self, seeker_client):
        r = seeker_client.patch(self.url, {
            "old_password": "wrong",
            "new_password": "New@1234",
            "new_password_confirm": "New@1234",
        }, format="json")
        assert r.status_code == 400

    def test_successful_change(self, seeker_client, seeker):
        r = seeker_client.patch(self.url, {
            "old_password": "Test@1234",
            "new_password": "New@1234",
            "new_password_confirm": "New@1234",
        }, format="json")
        assert r.status_code == 200
        seeker.refresh_from_db()
        assert seeker.check_password("New@1234")

    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.patch(self.url, {"old_password": "x"}, format="json")
        assert r.status_code == 401


# ── Logout ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogout:
    url = f"{BASE}/logout/"

    def test_authenticated_logout_returns_200(self, seeker_client):
        r = seeker_client.post(self.url, {}, format="json")
        assert r.status_code == 200

    def test_unauthenticated_logout_returns_401(self, api_client):
        r = api_client.post(self.url, {}, format="json")
        assert r.status_code == 401


# ── Token Refresh ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTokenRefresh:
    url = f"{BASE}/token/refresh/"

    def test_valid_refresh_token(self, api_client, seeker):
        refresh = RefreshToken.for_user(seeker)
        r = api_client.post(self.url, {"refresh": str(refresh)}, format="json")
        assert r.status_code == 200
        assert "access" in r.data

    def test_invalid_refresh_token(self, api_client):
        r = api_client.post(self.url, {"refresh": "invalid.token.here"}, format="json")
        assert r.status_code == 401


# ── Forgot Password ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestForgotPassword:
    url = f"{BASE}/forgot-password/"

    def test_nonexistent_email_returns_200_without_leaking(self, api_client):
        r = api_client.post(self.url, {"email": "ghost@test.com"}, format="json")
        assert r.status_code == 200
        assert "sent" in r.data["detail"].lower() or "otp" in r.data["detail"].lower()

    def test_existing_user_sends_otp(self, api_client, seeker):
        from apps.users.models import OTPVerification
        r = api_client.post(self.url, {"email": seeker.email}, format="json")
        assert r.status_code == 200
        assert OTPVerification.objects.filter(email=seeker.email, is_used=False).exists()

    def test_missing_email_returns_400(self, api_client):
        r = api_client.post(self.url, {}, format="json")
        assert r.status_code == 400


# ── Reset Password ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestResetPassword:
    url = f"{BASE}/reset-password/"

    def _make_otp(self, email):
        from apps.users.models import OTPVerification
        return OTPVerification.generate(email)

    def test_missing_fields_returns_400(self, api_client):
        r = api_client.post(self.url, {"email": "a@b.com"}, format="json")
        assert r.status_code == 400

    def test_short_password_returns_400(self, api_client, seeker):
        otp_obj = self._make_otp(seeker.email)
        r = api_client.post(self.url, {
            "email": seeker.email, "otp": otp_obj.otp, "new_password": "short"
        }, format="json")
        assert r.status_code == 400

    def test_invalid_otp_returns_400(self, api_client, seeker):
        r = api_client.post(self.url, {
            "email": seeker.email, "otp": "000000", "new_password": "New@1234"
        }, format="json")
        assert r.status_code == 400

    def test_expired_otp_returns_400(self, api_client, seeker):
        otp_obj = self._make_otp(seeker.email)
        otp_obj.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        otp_obj.save()
        r = api_client.post(self.url, {
            "email": seeker.email, "otp": otp_obj.otp, "new_password": "New@1234"
        }, format="json")
        assert r.status_code == 400

    def test_successful_reset(self, api_client, seeker):
        otp_obj = self._make_otp(seeker.email)
        r = api_client.post(self.url, {
            "email": seeker.email, "otp": otp_obj.otp, "new_password": "Reset@1234"
        }, format="json")
        assert r.status_code == 200
        seeker.refresh_from_db()
        assert seeker.check_password("Reset@1234")
        otp_obj.refresh_from_db()
        assert otp_obj.is_used is True
