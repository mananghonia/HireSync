"""
Tests for apps/profiles — skills, seeker/recruiter profiles, companies.
"""
import pytest


BASE = "/api/v1/profiles"


# ── Skills ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSkills:
    url = f"{BASE}/skills/"

    def test_public_list_returns_200(self, api_client, skill):
        r = api_client.get(self.url)
        assert r.status_code == 200

    def test_list_contains_skill(self, api_client, skill):
        r = api_client.get(self.url)
        names = [s["name"] for s in (r.data.get("results") or r.data)]
        assert "Python" in names

    def test_authenticated_can_create_skill(self, seeker_client):
        r = seeker_client.post(self.url, {"name": "Go Lang", "category": "Programming"}, format="json")
        assert r.status_code == 201
        assert r.data["name"] == "Go Lang"

    def test_unauthenticated_cannot_create(self, api_client):
        r = api_client.post(self.url, {"name": "Hack"}, format="json")
        assert r.status_code == 401

    def test_skill_slug_auto_generated(self, seeker_client):
        r = seeker_client.post(self.url, {"name": "React JS", "category": "Frontend"}, format="json")
        assert r.status_code == 201
        assert r.data["slug"] != ""


# ── Seeker Profile ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSeekerProfile:
    url = f"{BASE}/seeker/"

    def test_seeker_gets_profile(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert "bio" in r.data

    def test_profile_auto_created_on_first_access(self, seeker_client, seeker):
        from apps.profiles.models import JobSeekerProfile
        JobSeekerProfile.objects.filter(user=seeker).delete()
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert JobSeekerProfile.objects.filter(user=seeker).exists()

    def test_recruiter_cannot_access_seeker_profile(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 403

    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401

    def test_seeker_can_update_bio(self, seeker_client, seeker_profile):
        r = seeker_client.patch(self.url, {"bio": "I am a Python developer"}, format="json")
        assert r.status_code == 200
        seeker_profile.refresh_from_db()
        assert seeker_profile.bio == "I am a Python developer"

    def test_seeker_can_update_location(self, seeker_client, seeker_profile):
        r = seeker_client.patch(self.url, {"location": "Bangalore"}, format="json")
        assert r.status_code == 200
        seeker_profile.refresh_from_db()
        assert seeker_profile.location == "Bangalore"

    def test_open_to_work_toggle(self, seeker_client, seeker_profile):
        r = seeker_client.patch(self.url, {"is_open_to_work": False}, format="json")
        assert r.status_code == 200
        seeker_profile.refresh_from_db()
        assert seeker_profile.is_open_to_work is False


# ── Seeker Profile Detail (public) ────────────────────────────────────────────

@pytest.mark.django_db
class TestSeekerProfileDetail:
    def test_authenticated_can_view_other_seeker(self, recruiter_client, seeker, seeker_profile):
        url = f"{BASE}/seeker/{seeker.pk}/"
        r = recruiter_client.get(url)
        assert r.status_code == 200

    def test_unauthenticated_cannot_view(self, api_client, seeker, seeker_profile):
        url = f"{BASE}/seeker/{seeker.pk}/"
        r = api_client.get(url)
        assert r.status_code == 401

    def test_returns_404_for_nonexistent_user(self, recruiter_client):
        import uuid
        url = f"{BASE}/seeker/{uuid.uuid4()}/"
        r = recruiter_client.get(url)
        assert r.status_code == 404

    def test_another_seeker_cannot_view_full_profile(self, seeker_client, make_user):
        """
        Any authenticated user (including unrelated seekers) used to be able to view
        another seeker's full profile, exposing their resume and email. Must be
        recruiter-only now.
        """
        other_seeker = make_user(email="victim_seeker@test.com", role="seeker")
        from apps.profiles.models import JobSeekerProfile
        JobSeekerProfile.objects.get_or_create(user=other_seeker)
        url = f"{BASE}/seeker/{other_seeker.pk}/"
        r = seeker_client.get(url)
        assert r.status_code == 403


# ── Experience ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestExperience:
    url = f"{BASE}/experience/"

    def test_seeker_can_list_experiences(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 200

    def test_seeker_can_create_experience(self, seeker_client):
        r = seeker_client.post(self.url, {
            "company": "Acme Corp",
            "title": "Junior Developer",
            "start_date": "2022-01-01",
            "is_current": True,
        }, format="json")
        assert r.status_code == 201
        assert r.data["company"] == "Acme Corp"

    def test_recruiter_blocked(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 403

    def test_seeker_can_delete_experience(self, seeker_client):
        r = seeker_client.post(self.url, {
            "company": "ToDelete",
            "title": "Dev",
            "start_date": "2020-01-01",
        }, format="json")
        exp_id = r.data["id"]
        r2 = seeker_client.delete(f"{self.url}{exp_id}/")
        assert r2.status_code == 204

    def test_seeker_can_update_experience(self, seeker_client):
        r = seeker_client.post(self.url, {
            "company": "OldCo",
            "title": "Dev",
            "start_date": "2021-01-01",
        }, format="json")
        exp_id = r.data["id"]
        r2 = seeker_client.patch(f"{self.url}{exp_id}/", {"company": "NewCo"}, format="json")
        assert r2.status_code == 200
        assert r2.data["company"] == "NewCo"


# ── Education ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEducation:
    url = f"{BASE}/education/"

    def test_seeker_can_list_education(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 200

    def test_seeker_can_create_education(self, seeker_client):
        r = seeker_client.post(self.url, {
            "institution": "MIT",
            "degree": "BSc Computer Science",
            "start_year": 2018,
            "end_year": 2022,
        }, format="json")
        assert r.status_code == 201
        assert r.data["institution"] == "MIT"

    def test_recruiter_blocked(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 403

    def test_seeker_can_delete_education(self, seeker_client):
        r = seeker_client.post(self.url, {
            "institution": "ToDelete U",
            "degree": "BSc",
            "start_year": 2019,
        }, format="json")
        edu_id = r.data["id"]
        r2 = seeker_client.delete(f"{self.url}{edu_id}/")
        assert r2.status_code == 204


# ── Company ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCompany:
    url = f"{BASE}/companies/"

    def test_public_list_returns_200(self, api_client, company):
        r = api_client.get(self.url)
        assert r.status_code == 200

    def test_company_in_list(self, api_client, company):
        r = api_client.get(self.url)
        results = r.data.get("results") or r.data
        names = [c["name"] for c in results]
        assert "Test Corp" in names

    def test_recruiter_can_create_company_via_my_company(self, recruiter_client):
        r = recruiter_client.post(f"{self.url}my_company/", {
            "name": "NewBiz Inc",
            "industry": "technology",
            "size": "1-10",
        }, format="json")
        assert r.status_code == 201
        assert r.data["name"] == "NewBiz Inc"

    def test_seeker_blocked_from_creating_company(self, seeker_client):
        r = seeker_client.post(f"{self.url}my_company/", {
            "name": "HackCorp",
        }, format="json")
        assert r.status_code == 403

    def test_repeat_post_updates_existing_company_not_duplicate(self, recruiter_client):
        """
        Calling my_company POST when a company already exists used to create a
        brand new Company row every time and silently reassign the recruiter to
        it, orphaning the previous one. Must update in place instead.
        """
        from apps.profiles.models import Company
        before = Company.objects.count()

        r1 = recruiter_client.post(f"{self.url}my_company/", {
            "name": "FirstCo", "industry": "technology", "size": "1-10",
        }, format="json")
        assert r1.status_code == 201
        first_id = r1.data["id"]

        r2 = recruiter_client.post(f"{self.url}my_company/", {
            "name": "RenamedCo", "industry": "finance", "size": "11-50",
        }, format="json")
        assert r2.status_code == 200
        assert r2.data["id"] == first_id
        assert r2.data["name"] == "RenamedCo"

        assert Company.objects.count() == before + 1

    def test_recruiter_gets_own_company(self, recruiter_client, recruiter_profile):
        r = recruiter_client.get(f"{self.url}my_company/")
        assert r.status_code == 200

    def test_my_company_returns_none_when_no_company(self, recruiter_client, recruiter):
        from apps.profiles.models import RecruiterProfile
        RecruiterProfile.objects.filter(user=recruiter).delete()
        r = recruiter_client.get(f"{self.url}my_company/")
        assert r.status_code == 200
        assert r.data is None


# ── Recruiter Profile ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRecruiterProfile:
    url = f"{BASE}/recruiter/"

    def test_recruiter_gets_profile(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 200
        assert "job_title" in r.data

    def test_recruiter_auto_creates_profile(self, recruiter_client, recruiter):
        from apps.profiles.models import RecruiterProfile
        RecruiterProfile.objects.filter(user=recruiter).delete()
        r = recruiter_client.get(self.url)
        assert r.status_code == 200
        assert RecruiterProfile.objects.filter(user=recruiter).exists()

    def test_seeker_blocked(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 403

    def test_recruiter_can_update_job_title(self, recruiter_client):
        recruiter_client.get(self.url)  # auto-create
        r = recruiter_client.patch(self.url, {"job_title": "Senior HR Manager"}, format="json")
        assert r.status_code == 200
        assert r.data["job_title"] == "Senior HR Manager"
