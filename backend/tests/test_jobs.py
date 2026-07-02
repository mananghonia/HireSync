"""
Tests for apps/jobs — job CRUD, saved jobs, view tracking.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


BASE = "/api/v1/jobs"


def _client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    return client


# ── Job List ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobList:
    url = f"{BASE}/"

    def test_public_list_returns_200(self, api_client, job):
        r = api_client.get(self.url)
        assert r.status_code == 200

    def test_only_active_jobs_for_anonymous(self, api_client, recruiter, company):
        from apps.jobs.models import Job
        Job.objects.create(
            recruiter=recruiter, company=company,
            title="Draft Job", description="x", status="draft"
        )
        Job.objects.create(
            recruiter=recruiter, company=company,
            title="Active Job", description="x", status="active"
        )
        r = api_client.get(self.url)
        results = r.data.get("results") or r.data
        titles = [j["title"] for j in results]
        assert "Draft Job" not in titles
        assert "Active Job" in titles

    def test_only_active_jobs_for_seeker(self, seeker_client, job, recruiter, company):
        from apps.jobs.models import Job
        Job.objects.create(
            recruiter=recruiter, company=company,
            title="PausedJob", description="x", status="paused"
        )
        r = seeker_client.get(self.url)
        results = r.data.get("results") if isinstance(r.data, dict) else r.data
        titles = [j["title"] for j in results]
        assert "PausedJob" not in titles
        assert "Backend Developer" in titles

    def test_recruiter_sees_all_statuses(self, recruiter_client, recruiter, company):
        from apps.jobs.models import Job
        j = Job.objects.create(
            recruiter=recruiter, company=company,
            title="DraftVisible", description="x", status="draft"
        )
        r = recruiter_client.get(self.url)
        results = r.data.get("results") or r.data
        titles = [j["title"] for j in results]
        assert "DraftVisible" in titles

    def test_search_by_title(self, api_client, job):
        r = api_client.get(self.url, {"search": "Backend Developer"})
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        assert len(results) >= 1

    def test_ordering_by_created_at(self, api_client, job):
        r = api_client.get(self.url, {"ordering": "-created_at"})
        assert r.status_code == 200


# ── Job Retrieve ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobRetrieve:
    def test_public_retrieve_returns_200(self, api_client, job):
        r = api_client.get(f"{BASE}/{str(job.pk)}/")
        assert r.status_code == 200
        assert r.data["title"] == "Backend Developer"

    def test_retrieve_increments_views_count(self, api_client, job):
        api_client.get(f"{BASE}/{str(job.pk)}/")
        job.refresh_from_db()
        assert job.views_count == 1

    def test_retrieve_creates_job_view_record(self, api_client, job):
        from apps.jobs.models import JobView
        api_client.get(f"{BASE}/{str(job.pk)}/")
        assert JobView.objects.filter(job=job).exists()

    def test_authenticated_retrieve_has_applied_false(self, seeker_client, job):
        r = seeker_client.get(f"{BASE}/{str(job.pk)}/")
        assert r.status_code == 200
        assert r.data["has_applied"] is False

    def test_nonexistent_job_returns_404(self, api_client):
        r = api_client.get(f"{BASE}/000000000000000000000000/")
        assert r.status_code == 404


# ── Job Create ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobCreate:
    url = f"{BASE}/"

    def test_recruiter_can_create_job(self, recruiter_client, company, skill):
        r = recruiter_client.post(self.url, {
            "title": "New Job",
            "description": "Great job",
            "requirements": "Skills needed",
            "company_id": str(company.pk),
            "skill_ids": [str(skill.pk)],
            "job_type": "full_time",
            "experience_level": "junior",
            "location": "Delhi",
            "status": "active",
        }, format="json")
        assert r.status_code == 201
        assert r.data["title"] == "New Job"

    def test_seeker_cannot_create_job(self, seeker_client, company):
        r = seeker_client.post(self.url, {
            "title": "Hack Job",
            "description": "x",
            "company_id": str(company.pk),
        }, format="json")
        assert r.status_code == 403

    def test_unauthenticated_cannot_create_job(self, api_client):
        r = api_client.post(self.url, {"title": "x"}, format="json")
        assert r.status_code == 401

    def test_recruiter_is_auto_set_to_current_user(self, recruiter_client, recruiter, company):
        r = recruiter_client.post(self.url, {
            "title": "Auto Recruiter Job",
            "description": "x",
            "company_id": str(company.pk),
            "job_type": "full_time",
            "experience_level": "any",
            "skill_ids": [],
        }, format="json")
        assert r.status_code == 201
        from apps.jobs.models import Job
        created = Job.objects.get(title="Auto Recruiter Job")
        assert created.recruiter == recruiter


# ── Job Update ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobUpdate:
    def test_recruiter_can_update_own_job(self, recruiter_client, job):
        r = recruiter_client.patch(f"{BASE}/{str(job.pk)}/", {
            "title": "Updated Backend Developer"
        }, format="json")
        assert r.status_code == 200
        job.refresh_from_db()
        assert job.title == "Updated Backend Developer"

    def test_seeker_cannot_update_job(self, seeker_client, job):
        r = seeker_client.patch(f"{BASE}/{str(job.pk)}/", {"title": "Hack"}, format="json")
        assert r.status_code == 403

    def test_recruiter_can_close_job(self, recruiter_client, job):
        r = recruiter_client.patch(f"{BASE}/{str(job.pk)}/", {"status": "closed"}, format="json")
        assert r.status_code == 200
        job.refresh_from_db()
        assert job.status == "closed"

    def test_other_recruiter_cannot_update_job(self, job, make_user):
        other = make_user(email="other-update@test.com", role="recruiter")
        r = _client_for(other).patch(f"{BASE}/{str(job.pk)}/", {"title": "Hijacked"}, format="json")
        assert r.status_code == 403
        job.refresh_from_db()
        assert job.title == "Backend Developer"


# ── Job Delete ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobDelete:
    def test_recruiter_can_delete_own_job(self, recruiter_client, job):
        r = recruiter_client.delete(f"{BASE}/{str(job.pk)}/")
        assert r.status_code == 204

    def test_seeker_cannot_delete_job(self, seeker_client, job):
        r = seeker_client.delete(f"{BASE}/{str(job.pk)}/")
        assert r.status_code == 403

    def test_other_recruiter_cannot_delete_job(self, job, make_user):
        from apps.jobs.models import Job
        other = make_user(email="other-delete@test.com", role="recruiter")
        r = _client_for(other).delete(f"{BASE}/{str(job.pk)}/")
        assert r.status_code == 403
        assert Job.objects.filter(pk=job.pk).exists()


# ── My Jobs ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMyJobs:
    url = f"{BASE}/my_jobs/"

    def test_recruiter_sees_own_jobs(self, recruiter_client, job):
        r = recruiter_client.get(self.url)
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        titles = [j["title"] for j in results]
        assert "Backend Developer" in titles

    def test_seeker_cannot_access_my_jobs(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 403

    def test_recruiter_sees_only_own_jobs(self, recruiter_client, job, make_user, company):
        from apps.jobs.models import Job
        other_recruiter = make_user(email="other@test.com", role="recruiter")
        Job.objects.create(
            recruiter=other_recruiter, company=company,
            title="Other Recruiter Job", description="x", status="active"
        )
        r = recruiter_client.get(self.url)
        results = r.data.get("results") if isinstance(r.data, dict) else r.data
        titles = [j["title"] for j in results]
        assert "Other Recruiter Job" not in titles
        assert "Backend Developer" in titles


# ── Saved Jobs ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSavedJobs:
    list_url = f"{BASE}/saved/"

    def test_seeker_can_list_saved_jobs(self, seeker_client):
        r = seeker_client.get(self.list_url)
        assert r.status_code == 200

    def test_seeker_can_save_job(self, seeker_client, job):
        r = seeker_client.post(self.list_url, {"job_id": str(job.pk)}, format="json")
        assert r.status_code == 201

    def test_saving_again_unsaves(self, seeker_client, job):
        seeker_client.post(self.list_url, {"job_id": str(job.pk)}, format="json")
        r = seeker_client.post(self.list_url, {"job_id": str(job.pk)}, format="json")
        assert r.status_code == 200
        assert "unsaved" in r.data["detail"].lower()

    def test_save_nonexistent_job_returns_404(self, seeker_client):
        r = seeker_client.post(self.list_url, {"job_id": "000000000000000000000000"}, format="json")
        assert r.status_code == 404

    def test_recruiter_cannot_save_jobs(self, recruiter_client, job):
        r = recruiter_client.post(self.list_url, {"job_id": str(job.pk)}, format="json")
        assert r.status_code == 403

    def test_saved_job_appears_in_list(self, seeker_client, job):
        seeker_client.post(self.list_url, {"job_id": str(job.pk)}, format="json")
        r = seeker_client.get(self.list_url)
        results = r.data.get("results") or r.data
        job_ids = [str(s["job"]["id"]) for s in results]
        assert str(job.pk) in job_ids

    def test_cannot_save_closed_job(self, seeker_client, job, recruiter_client):
        recruiter_client.patch(f"{BASE}/{str(job.pk)}/", {"status": "closed"}, format="json")
        r = seeker_client.post(self.list_url, {"job_id": str(job.pk)}, format="json")
        assert r.status_code == 404
