"""
Tests for apps/analytics — recruiter dashboard and job analytics.
"""
import pytest


BASE = "/api/v1/analytics"


@pytest.mark.django_db
class TestRecruiterDashboard:
    url = f"{BASE}/recruiter/dashboard/"

    def test_recruiter_can_access_dashboard(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 200

    def test_dashboard_structure(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert "overview" in r.data
        assert "status_breakdown" in r.data
        assert "top_jobs" in r.data
        assert "daily_applications" in r.data

    def test_overview_fields(self, recruiter_client, job):
        r = recruiter_client.get(self.url)
        overview = r.data["overview"]
        assert "total_jobs" in overview
        assert "active_jobs" in overview
        assert "total_views" in overview
        assert "total_applications" in overview
        assert "hired_count" in overview
        assert "conversion_rate" in overview

    def test_total_jobs_count(self, recruiter_client, job):
        r = recruiter_client.get(self.url)
        assert r.data["overview"]["total_jobs"] >= 1

    def test_seeker_blocked_from_dashboard(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 403

    def test_unauthenticated_blocked(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401

    def test_dashboard_with_applications(self, recruiter_client, application):
        r = recruiter_client.get(self.url)
        assert r.data["overview"]["total_applications"] >= 1
        assert "applied" in r.data["status_breakdown"]

    def test_conversion_rate_is_zero_with_no_hires(self, recruiter_client, job):
        r = recruiter_client.get(self.url)
        assert r.data["overview"]["conversion_rate"] == 0

    def test_top_jobs_list(self, recruiter_client, job):
        r = recruiter_client.get(self.url)
        assert isinstance(r.data["top_jobs"], list)

    def test_daily_applications_list(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert isinstance(r.data["daily_applications"], list)

    def test_hired_count_updates(self, recruiter_client, application):
        application.status = "hired"
        application.save()
        r = recruiter_client.get(self.url)
        assert r.data["overview"]["hired_count"] >= 1
        assert r.data["overview"]["conversion_rate"] > 0


@pytest.mark.django_db
class TestJobAnalytics:
    def test_recruiter_can_view_job_analytics(self, recruiter_client, job):
        r = recruiter_client.get(f"{BASE}/recruiter/jobs/{str(job.pk)}/")
        assert r.status_code == 200

    def test_job_analytics_structure(self, recruiter_client, job):
        r = recruiter_client.get(f"{BASE}/recruiter/jobs/{str(job.pk)}/")
        assert "job_id" in r.data
        assert "title" in r.data
        assert "views" in r.data
        assert "applications" in r.data
        assert "status_breakdown" in r.data

    def test_job_analytics_correct_title(self, recruiter_client, job):
        r = recruiter_client.get(f"{BASE}/recruiter/jobs/{str(job.pk)}/")
        assert r.data["title"] == "Backend Developer"

    def test_application_count_in_analytics(self, recruiter_client, application):
        r = recruiter_client.get(f"{BASE}/recruiter/jobs/{str(application.job.pk)}/")
        assert r.data["applications"] >= 1

    def test_nonexistent_job_returns_404(self, recruiter_client):
        r = recruiter_client.get(f"{BASE}/recruiter/jobs/000000000000000000000000/")
        assert r.status_code == 404

    def test_seeker_blocked(self, seeker_client, job):
        r = seeker_client.get(f"{BASE}/recruiter/jobs/{str(job.pk)}/")
        assert r.status_code == 403

    def test_status_breakdown_populated(self, recruiter_client, application):
        r = recruiter_client.get(f"{BASE}/recruiter/jobs/{str(application.job.pk)}/")
        assert "applied" in r.data["status_breakdown"]
