"""
Tests for admin endpoints under /api/v1/admin/.
Only admin_client should succeed; seeker/recruiter get 403; unauthenticated gets 401.
"""
import pytest

BASE = "/api/v1/admin"


# ---------------------------------------------------------------------------
# AdminStatsView — GET /api/v1/admin/stats/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminStats:
    url = f"{BASE}/stats/"

    def test_admin_gets_200(self, admin_client):
        r = admin_client.get(self.url)
        assert r.status_code == 200

    def test_response_has_users_section(self, admin_client):
        r = admin_client.get(self.url)
        assert "users" in r.data
        assert "total" in r.data["users"]
        assert "new_this_week" in r.data["users"]
        assert "seekers" in r.data["users"]
        assert "recruiters" in r.data["users"]

    def test_response_has_jobs_section(self, admin_client):
        r = admin_client.get(self.url)
        assert "jobs" in r.data
        assert "total" in r.data["jobs"]
        assert "active" in r.data["jobs"]
        assert "posted_this_month" in r.data["jobs"]

    def test_response_has_applications_section(self, admin_client):
        r = admin_client.get(self.url)
        assert "applications" in r.data
        assert "total" in r.data["applications"]
        assert "this_week" in r.data["applications"]
        assert "hired" in r.data["applications"]

    def test_counts_reflect_fixtures(self, admin_client, seeker, recruiter, job, application):
        r = admin_client.get(self.url)
        assert r.data["users"]["total"] >= 3  # seeker + recruiter + admin
        assert r.data["users"]["seekers"] >= 1
        assert r.data["users"]["recruiters"] >= 1
        assert r.data["jobs"]["total"] >= 1
        assert r.data["applications"]["total"] >= 1

    def test_seeker_gets_403(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 403

    def test_recruiter_gets_403(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 403

    def test_unauthenticated_gets_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# AdminUserListView — GET /api/v1/admin/users/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminUserList:
    url = f"{BASE}/users/"

    def test_admin_gets_200(self, admin_client, seeker, recruiter):
        r = admin_client.get(self.url)
        assert r.status_code == 200

    def test_returns_list_of_users(self, admin_client, seeker, recruiter):
        r = admin_client.get(self.url)
        assert isinstance(r.data, list)
        assert len(r.data) >= 2

    def test_user_object_has_expected_fields(self, admin_client, seeker):
        r = admin_client.get(self.url)
        user = next(u for u in r.data if u["email"] == seeker.email)
        assert "id" in user
        assert "email" in user
        assert "full_name" in user
        assert "role" in user
        assert "is_active" in user
        assert "is_verified" in user
        assert "created_at" in user

    def test_filter_by_role_seeker(self, admin_client, seeker, recruiter):
        r = admin_client.get(self.url, {"role": "seeker"})
        assert r.status_code == 200
        assert all(u["role"] == "seeker" for u in r.data)

    def test_filter_by_role_recruiter(self, admin_client, seeker, recruiter):
        r = admin_client.get(self.url, {"role": "recruiter"})
        assert r.status_code == 200
        assert all(u["role"] == "recruiter" for u in r.data)

    def test_search_by_email(self, admin_client, seeker):
        r = admin_client.get(self.url, {"search": "seeker@test.com"})
        assert r.status_code == 200
        assert any(u["email"] == "seeker@test.com" for u in r.data)

    def test_search_no_match(self, admin_client):
        r = admin_client.get(self.url, {"search": "zzz_nobody_xyz@nowhere.com"})
        assert r.status_code == 200
        assert len(r.data) == 0

    def test_filter_is_active_true(self, admin_client, seeker):
        r = admin_client.get(self.url, {"is_active": "true"})
        assert r.status_code == 200
        assert all(u["is_active"] for u in r.data)

    def test_filter_is_active_false(self, admin_client, make_user):
        make_user(email="inactive@test.com", is_active=False)
        r = admin_client.get(self.url, {"is_active": "false"})
        assert r.status_code == 200
        assert all(not u["is_active"] for u in r.data)

    def test_seeker_gets_403(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 403

    def test_recruiter_gets_403(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 403

    def test_unauthenticated_gets_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# AdminUserDetailView — PATCH/DELETE /api/v1/admin/users/<user_id>/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminUserPatch:
    def url(self, user_id):
        return f"{BASE}/users/{user_id}/"

    def test_admin_can_deactivate_user(self, admin_client, seeker):
        r = admin_client.patch(self.url(str(seeker.id)), {"is_active": False}, format="json")
        assert r.status_code == 200
        seeker.refresh_from_db()
        assert seeker.is_active is False

    def test_admin_can_reactivate_user(self, admin_client, make_user):
        user = make_user(email="inactive2@test.com", is_active=False)
        r = admin_client.patch(self.url(str(user.id)), {"is_active": True}, format="json")
        assert r.status_code == 200
        user.refresh_from_db()
        assert user.is_active is True

    def test_patch_own_account_returns_400(self, admin_client, admin_user):
        r = admin_client.patch(self.url(str(admin_user.id)), {"is_active": False}, format="json")
        assert r.status_code == 400

    def test_patch_nonexistent_returns_404(self, admin_client):
        r = admin_client.patch(self.url("00000000-0000-0000-0000-000000000001"), {"is_active": False}, format="json")
        assert r.status_code == 404

    def test_response_contains_user_fields(self, admin_client, seeker):
        r = admin_client.patch(self.url(str(seeker.id)), {"is_active": False}, format="json")
        assert "id" in r.data
        assert "email" in r.data
        assert "role" in r.data
        assert "is_active" in r.data

    def test_seeker_gets_403(self, seeker_client, recruiter):
        r = seeker_client.patch(self.url(str(recruiter.id)), {"is_active": False}, format="json")
        assert r.status_code == 403

    def test_recruiter_gets_403(self, recruiter_client, seeker):
        r = recruiter_client.patch(self.url(str(seeker.id)), {"is_active": False}, format="json")
        assert r.status_code == 403

    def test_unauthenticated_gets_401(self, api_client, seeker):
        r = api_client.patch(self.url(str(seeker.id)), {"is_active": False}, format="json")
        assert r.status_code == 401


@pytest.mark.django_db
class TestAdminUserDelete:
    def url(self, user_id):
        return f"{BASE}/users/{user_id}/"

    def test_admin_can_delete_user(self, admin_client, make_user):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        target = make_user(email="todelete@test.com")
        target_id = str(target.id)
        r = admin_client.delete(self.url(target_id))
        assert r.status_code == 204
        assert not User.objects.filter(id=target_id).exists()

    def test_delete_own_account_returns_400(self, admin_client, admin_user):
        r = admin_client.delete(self.url(str(admin_user.id)))
        assert r.status_code == 400

    def test_delete_nonexistent_returns_404(self, admin_client):
        r = admin_client.delete(self.url("00000000-0000-0000-0000-000000000002"))
        assert r.status_code == 404

    def test_seeker_gets_403(self, seeker_client, recruiter):
        r = seeker_client.delete(self.url(str(recruiter.id)))
        assert r.status_code == 403

    def test_recruiter_gets_403(self, recruiter_client, seeker):
        r = recruiter_client.delete(self.url(str(seeker.id)))
        assert r.status_code == 403

    def test_unauthenticated_gets_401(self, api_client, seeker):
        r = api_client.delete(self.url(str(seeker.id)))
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# AdminJobListView — GET /api/v1/admin/jobs/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminJobList:
    url = f"{BASE}/jobs/"

    def test_admin_gets_200(self, admin_client, job):
        r = admin_client.get(self.url)
        assert r.status_code == 200

    def test_returns_list_of_jobs(self, admin_client, job):
        r = admin_client.get(self.url)
        assert isinstance(r.data, list)
        assert len(r.data) >= 1

    def test_job_object_has_expected_fields(self, admin_client, job):
        r = admin_client.get(self.url)
        j = r.data[0]
        assert "id" in j
        assert "title" in j
        assert "company" in j
        assert "recruiter" in j
        assert "recruiter_email" in j
        assert "status" in j
        assert "location" in j
        assert "created_at" in j

    def test_filter_by_status(self, admin_client, job, recruiter, company):
        from apps.jobs.models import Job
        Job.objects.create(
            recruiter=recruiter, company=company,
            title="Closed Job", description="x", status="closed"
        )
        r = admin_client.get(self.url, {"status": "closed"})
        assert r.status_code == 200
        assert all(j["status"] == "closed" for j in r.data)

    def test_search_by_title(self, admin_client, job):
        r = admin_client.get(self.url, {"search": "Backend"})
        assert r.status_code == 200
        assert any(j["title"] == "Backend Developer" for j in r.data)

    def test_search_no_match(self, admin_client, job):
        r = admin_client.get(self.url, {"search": "ZZZNOMATCH"})
        assert r.status_code == 200
        assert len(r.data) == 0

    def test_search_by_company_name(self, admin_client, job):
        r = admin_client.get(self.url, {"search": "Test Corp"})
        assert r.status_code == 200
        assert len(r.data) >= 1

    def test_seeker_gets_403(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 403

    def test_recruiter_gets_403(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 403

    def test_unauthenticated_gets_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# AdminJobDetailView — PATCH/DELETE /api/v1/admin/jobs/<job_id>/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminJobPatch:
    def url(self, job_id):
        return f"{BASE}/jobs/{job_id}/"

    def test_admin_can_set_status_closed(self, admin_client, job):
        r = admin_client.patch(self.url(str(job.id)), {"status": "closed"}, format="json")
        assert r.status_code == 200
        job.refresh_from_db()
        assert job.status == "closed"

    def test_admin_can_set_status_open(self, admin_client, job):
        r = admin_client.patch(self.url(str(job.id)), {"status": "open"}, format="json")
        assert r.status_code == 200
        job.refresh_from_db()
        assert job.status == "open"

    def test_admin_can_set_status_paused(self, admin_client, job):
        r = admin_client.patch(self.url(str(job.id)), {"status": "paused"}, format="json")
        assert r.status_code == 200
        job.refresh_from_db()
        assert job.status == "paused"

    def test_invalid_status_returns_400(self, admin_client, job):
        r = admin_client.patch(self.url(str(job.id)), {"status": "invalid_status"}, format="json")
        assert r.status_code == 400

    def test_missing_status_returns_400(self, admin_client, job):
        r = admin_client.patch(self.url(str(job.id)), {}, format="json")
        assert r.status_code == 400

    def test_patch_nonexistent_job_returns_404(self, admin_client):
        r = admin_client.patch(self.url("000000000000000000000003"), {"status": "closed"}, format="json")
        assert r.status_code == 404

    def test_response_contains_job_fields(self, admin_client, job):
        r = admin_client.patch(self.url(str(job.id)), {"status": "closed"}, format="json")
        assert "id" in r.data
        assert "title" in r.data
        assert "status" in r.data

    def test_seeker_gets_403(self, seeker_client, job):
        r = seeker_client.patch(self.url(str(job.id)), {"status": "closed"}, format="json")
        assert r.status_code == 403

    def test_recruiter_gets_403(self, recruiter_client, job):
        r = recruiter_client.patch(self.url(str(job.id)), {"status": "closed"}, format="json")
        assert r.status_code == 403

    def test_unauthenticated_gets_401(self, api_client, job):
        r = api_client.patch(self.url(str(job.id)), {"status": "closed"}, format="json")
        assert r.status_code == 401


@pytest.mark.django_db
class TestAdminJobDelete:
    def url(self, job_id):
        return f"{BASE}/jobs/{job_id}/"

    def test_admin_can_delete_job(self, admin_client, recruiter, company):
        from apps.jobs.models import Job
        target = Job.objects.create(
            recruiter=recruiter, company=company,
            title="ToDeleteJob", description="x", status="active"
        )
        target_id = str(target.id)
        r = admin_client.delete(self.url(target_id))
        assert r.status_code == 204
        assert not Job.objects.filter(id=target_id).exists()

    def test_delete_nonexistent_job_returns_404(self, admin_client):
        r = admin_client.delete(self.url("000000000000000000000004"))
        assert r.status_code == 404

    def test_seeker_gets_403(self, seeker_client, job):
        r = seeker_client.delete(self.url(str(job.id)))
        assert r.status_code == 403

    def test_recruiter_gets_403(self, recruiter_client, job):
        r = recruiter_client.delete(self.url(str(job.id)))
        assert r.status_code == 403

    def test_unauthenticated_gets_401(self, api_client, job):
        r = api_client.delete(self.url(str(job.id)))
        assert r.status_code == 401
