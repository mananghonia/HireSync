"""
Tests for apps/applications — apply, withdraw, recruiter ATS pipeline.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


SEEKER_BASE = "/api/v1/applications/my"
RECRUITER_BASE = "/api/v1/applications/manage"


def _resume():
    return SimpleUploadedFile(
        "resume.txt", b"Python developer with 3 years experience.",
        content_type="text/plain"
    )


# ── Seeker: Apply ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSeekerApply:
    url = f"{SEEKER_BASE}/"

    def test_no_resume_returns_400(self, seeker_client, job):
        r = seeker_client.post(self.url, {
            "job": str(job.pk),
            "cover_letter": "I am interested",
        }, format="json")
        assert r.status_code == 400
        assert "resume" in r.data["detail"].lower()

    def test_successful_application_with_uploaded_resume(self, seeker_client, job):
        r = seeker_client.post(self.url, {
            "job": str(job.pk),
            "cover_letter": "I am interested",
            "resume_snapshot": _resume(),
        }, format="multipart")
        assert r.status_code == 201
        assert r.data["status"] == "applied"

    def test_application_from_profile_resume(self, seeker_client, seeker, job):
        from apps.profiles.models import JobSeekerProfile
        profile, _ = JobSeekerProfile.objects.get_or_create(user=seeker)
        profile.resume = _resume()
        profile.save()
        r = seeker_client.post(self.url, {
            "job": str(job.pk),
            "cover_letter": "Using profile resume",
        }, format="json")
        assert r.status_code == 201

    def test_duplicate_application_returns_400(self, seeker_client, application):
        r = seeker_client.post(self.url, {
            "job": str(application.job.pk),
            "cover_letter": "Duplicate",
            "resume_snapshot": _resume(),
        }, format="multipart")
        assert r.status_code == 400
        assert "already applied" in r.data["detail"].lower()

    def test_recruiter_cannot_apply(self, recruiter_client, job):
        r = recruiter_client.post(self.url, {
            "job": str(job.pk),
        }, format="json")
        assert r.status_code == 403

    def test_history_created_on_apply(self, seeker_client, job):
        from apps.applications.models import ApplicationStatusHistory, Application
        r = seeker_client.post(self.url, {
            "job": str(job.pk),
            "cover_letter": "Test",
            "resume_snapshot": _resume(),
        }, format="multipart")
        assert r.status_code == 201
        app_id = r.data["id"]
        history = ApplicationStatusHistory.objects.filter(
            application__id=app_id, new_status="applied"
        )
        assert history.exists()


# ── Seeker: List Applications ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestSeekerApplicationList:
    url = f"{SEEKER_BASE}/"

    def test_seeker_sees_own_applications(self, seeker_client, application):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        assert len(results) >= 1

    def test_seeker_does_not_see_others_applications(self, seeker_client, make_user, job):
        from apps.applications.models import Application
        other = make_user(email="other_seeker@test.com", role="seeker")
        Application.objects.create(applicant=other, job=job, cover_letter="other")
        r = seeker_client.get(self.url)
        # seeker hasn't applied — their list is empty
        results = r.data.get("results") if isinstance(r.data, dict) else r.data
        assert len(results) == 0

    def test_recruiter_blocked_from_seeker_list(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 403


# ── Seeker: Withdraw ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestWithdraw:
    def test_seeker_can_withdraw(self, seeker_client, application):
        url = f"{SEEKER_BASE}/{str(application.pk)}/withdraw/"
        r = seeker_client.post(url, {}, format="json")
        assert r.status_code == 200
        application.refresh_from_db()
        assert application.status == "withdrawn"

    def test_cannot_withdraw_hired_application(self, seeker_client, application):
        application.status = "hired"
        application.save()
        url = f"{SEEKER_BASE}/{str(application.pk)}/withdraw/"
        r = seeker_client.post(url, {}, format="json")
        assert r.status_code == 400

    def test_cannot_withdraw_rejected_application(self, seeker_client, application):
        application.status = "rejected"
        application.save()
        url = f"{SEEKER_BASE}/{str(application.pk)}/withdraw/"
        r = seeker_client.post(url, {}, format="json")
        assert r.status_code == 400

    def test_withdraw_creates_history(self, seeker_client, application):
        from apps.applications.models import ApplicationStatusHistory
        url = f"{SEEKER_BASE}/{str(application.pk)}/withdraw/"
        seeker_client.post(url, {}, format="json")
        assert ApplicationStatusHistory.objects.filter(
            application=application, new_status="withdrawn"
        ).exists()


# ── Seeker: Re-apply ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReApply:
    url = f"{SEEKER_BASE}/"

    def test_reapply_after_withdrawal(self, seeker_client, application):
        application.status = "withdrawn"
        application.save()
        r = seeker_client.post(self.url, {
            "job": str(application.job.pk),
            "cover_letter": "Re-applying!",
            "resume_snapshot": _resume(),
        }, format="multipart")
        assert r.status_code == 201
        application.refresh_from_db()
        assert application.status == "applied"


# ── Recruiter: View Applicants ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestRecruiterApplicationList:
    url = f"{RECRUITER_BASE}/"

    def test_recruiter_sees_applicants_for_own_jobs(self, recruiter_client, application):
        r = recruiter_client.get(self.url)
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        assert len(results) >= 1

    def test_recruiter_can_filter_by_job(self, recruiter_client, application):
        r = recruiter_client.get(self.url, {"job_id": str(application.job.pk)})
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        assert len(results) >= 1

    def test_recruiter_can_filter_by_status(self, recruiter_client, application):
        r = recruiter_client.get(self.url, {"status": "applied"})
        assert r.status_code == 200

    def test_seeker_blocked_from_recruiter_list(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 403

    def test_recruiter_only_sees_own_job_applications(self, recruiter_client, application, make_user, company, skill):
        from apps.jobs.models import Job
        from apps.applications.models import Application
        other_rec = make_user(email="other_rec@test.com", role="recruiter")
        other_job = Job.objects.create(
            recruiter=other_rec, company=company,
            title="Other Job", description="x", status="active"
        )
        seeker2 = make_user(email="seeker2@test.com", role="seeker")
        Application.objects.create(applicant=seeker2, job=other_job)
        r = recruiter_client.get(self.url)
        results = r.data.get("results") if isinstance(r.data, dict) else r.data
        # Recruiter serializer has applicant info, not job — check applicant emails
        applicant_emails = [a["applicant"]["email"] for a in results]
        assert "seeker2@test.com" not in applicant_emails
        assert "seeker@test.com" in applicant_emails


# ── Recruiter: Update Status ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestUpdateStatus:
    def test_recruiter_can_update_to_shortlisted(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/update_status/"
        r = recruiter_client.patch(url, {"status": "shortlisted"}, format="json")
        assert r.status_code == 200
        application.refresh_from_db()
        assert application.status == "shortlisted"

    def test_status_history_created(self, recruiter_client, application):
        from apps.applications.models import ApplicationStatusHistory
        url = f"{RECRUITER_BASE}/{str(application.pk)}/update_status/"
        recruiter_client.patch(url, {"status": "shortlisted", "note": "Good fit"}, format="json")
        history = ApplicationStatusHistory.objects.filter(
            application=application, new_status="shortlisted"
        ).first()
        assert history is not None
        assert history.note == "Good fit"

    def test_update_to_interview_scheduled(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/update_status/"
        r = recruiter_client.patch(url, {
            "status": "interview_scheduled",
            "interview_scheduled_at": "2026-08-01T10:00:00Z",
        }, format="json")
        assert r.status_code == 200
        application.refresh_from_db()
        assert application.status == "interview_scheduled"
        assert application.interview_scheduled_at is not None

    def test_update_to_hired(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/update_status/"
        r = recruiter_client.patch(url, {"status": "hired"}, format="json")
        assert r.status_code == 200

    def test_update_to_rejected(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/update_status/"
        r = recruiter_client.patch(url, {"status": "rejected", "note": "Not qualified"}, format="json")
        assert r.status_code == 200

    def test_seeker_cannot_update_status(self, seeker_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/update_status/"
        r = seeker_client.patch(url, {"status": "shortlisted"}, format="json")
        assert r.status_code == 403


# ── Recruiter: Add Note ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAddNote:
    def test_recruiter_can_add_note(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/add_note/"
        r = recruiter_client.post(url, {"note": "Strong technical skills"}, format="json")
        assert r.status_code == 201
        assert r.data["note"] == "Strong technical skills"

    def test_note_saved_to_db(self, recruiter_client, application):
        from apps.applications.models import RecruiterNote
        url = f"{RECRUITER_BASE}/{str(application.pk)}/add_note/"
        recruiter_client.post(url, {"note": "Great candidate"}, format="json")
        assert RecruiterNote.objects.filter(
            application=application, note="Great candidate"
        ).exists()

    def test_seeker_cannot_add_note(self, seeker_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/add_note/"
        r = seeker_client.post(url, {"note": "x"}, format="json")
        assert r.status_code == 403


# ── AI Features (fallback mode, no API key) ───────────────────────────────────

@pytest.mark.django_db
class TestAIFeatures:
    def test_generate_questions_returns_categories(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/generate_questions/"
        r = recruiter_client.post(url, {}, format="json")
        assert r.status_code == 200
        assert "categories" in r.data
        assert len(r.data["categories"]) == 4

    def test_analyze_transcript_too_short_returns_400(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/analyze_transcript/"
        r = recruiter_client.post(url, {"transcript": "short"}, format="json")
        assert r.status_code == 400

    def test_analyze_transcript_valid_returns_result(self, recruiter_client, application):
        url = f"{RECRUITER_BASE}/{str(application.pk)}/analyze_transcript/"
        transcript = "Interviewer: Tell me about yourself. " * 10
        r = recruiter_client.post(url, {"transcript": transcript}, format="json")
        assert r.status_code == 200
        assert "recommendation" in r.data
