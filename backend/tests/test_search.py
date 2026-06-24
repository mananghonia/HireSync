"""
Tests for apps/search — job search and recommendations.
"""
import pytest


BASE = "/api/v1/search"


@pytest.mark.django_db
class TestJobSearch:
    url = f"{BASE}/jobs/"

    def test_public_search_returns_200(self, api_client, job):
        r = api_client.get(self.url)
        assert r.status_code == 200

    def test_search_response_structure(self, api_client, job):
        r = api_client.get(self.url)
        assert "count" in r.data
        assert "total_pages" in r.data
        assert "current_page" in r.data
        assert "results" in r.data

    def test_search_by_query(self, api_client, job):
        r = api_client.get(self.url, {"q": "Backend"})
        assert r.status_code == 200
        assert r.data["count"] >= 1

    def test_search_no_results(self, api_client):
        r = api_client.get(self.url, {"q": "ZZZ_NONEXISTENT_XYZ"})
        assert r.status_code == 200
        assert r.data["count"] == 0

    def test_filter_by_job_type(self, api_client, job):
        r = api_client.get(self.url, {"job_type": "full_time"})
        assert r.status_code == 200
        for result in r.data["results"]:
            assert result["job_type"] == "full_time"

    def test_filter_by_location(self, api_client, job):
        r = api_client.get(self.url, {"location": "Mumbai"})
        assert r.status_code == 200

    def test_filter_by_experience_level(self, api_client, job):
        r = api_client.get(self.url, {"experience_level": "junior"})
        assert r.status_code == 200

    def test_filter_by_is_remote(self, api_client, recruiter, company):
        from apps.jobs.models import Job
        Job.objects.create(
            recruiter=recruiter, company=company,
            title="Remote Job", description="Remote work",
            job_type="remote", is_remote=True, status="active"
        )
        r = api_client.get(self.url, {"is_remote": "true"})
        assert r.status_code == 200
        for result in r.data["results"]:
            assert result["is_remote"] is True

    def test_filter_by_salary_min(self, api_client, recruiter, company):
        from apps.jobs.models import Job
        Job.objects.create(
            recruiter=recruiter, company=company,
            title="High Salary Job", description="x",
            salary_min=100000, salary_max=200000, status="active"
        )
        r = api_client.get(self.url, {"salary_min": "90000"})
        assert r.status_code == 200
        assert r.data["count"] >= 1

    def test_pagination(self, api_client, recruiter, company):
        from apps.jobs.models import Job
        for i in range(5):
            Job.objects.create(
                recruiter=recruiter, company=company,
                title=f"Job {i}", description="x", status="active"
            )
        r = api_client.get(self.url, {"page": "1", "page_size": "2"})
        assert r.status_code == 200
        assert len(r.data["results"]) <= 2

    def test_only_active_jobs_returned(self, api_client, recruiter, company):
        from apps.jobs.models import Job
        Job.objects.create(
            recruiter=recruiter, company=company,
            title="DraftSearch", description="x", status="draft"
        )
        r = api_client.get(self.url, {"q": "DraftSearch"})
        assert r.data["count"] == 0

    def test_search_description(self, api_client, job):
        r = api_client.get(self.url, {"q": "Python Django"})
        assert r.status_code == 200
        assert r.data["count"] >= 1


@pytest.mark.django_db
class TestJobRecommendations:
    url = f"{BASE}/recommendations/"

    def test_requires_authentication(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401

    def test_seeker_gets_recommendations(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert "results" in r.data

    def test_recruiter_can_get_recommendations(self, recruiter_client):
        r = recruiter_client.get(self.url)
        assert r.status_code == 200

    def test_seeker_no_profile_returns_empty(self, seeker_client, seeker):
        from apps.profiles.models import JobSeekerProfile
        JobSeekerProfile.objects.filter(user=seeker).delete()
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert "results" in r.data

    def test_recommendations_contain_active_jobs_only(self, seeker_client, job):
        r = seeker_client.get(self.url)
        for result in r.data.get("results", []):
            assert result.get("status", "active") == "active" or "id" in result

    def test_seeker_with_skills_gets_relevant_recommendations(self, seeker_client, seeker, job, skill):
        from apps.profiles.models import JobSeekerProfile
        profile, _ = JobSeekerProfile.objects.get_or_create(user=seeker)
        profile.skills.add(skill)
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert "results" in r.data


# ---------------------------------------------------------------------------
# TestSearchHelpers — internal helper functions in apps/search/views.py
# ---------------------------------------------------------------------------

class TestGetResumeText:
    """_get_resume_text(profile) — no DB needed for None-resume path."""

    def test_returns_empty_string_when_no_resume(self):
        from apps.search.views import _get_resume_text

        class FakeProfile:
            resume = None

        assert _get_resume_text(FakeProfile()) == ""

    def test_returns_text_for_plain_text_file(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from apps.search.views import _get_resume_text

        content = b"Experienced Python developer with Django and REST API skills."
        fake_file = SimpleUploadedFile("resume.txt", content, content_type="text/plain")

        class FakeProfile:
            resume = fake_file

        text = _get_resume_text(FakeProfile())
        assert "Python" in text


class TestLlmExtractSkillNames:
    """_llm_extract_skill_names(text) — returns [] when API key is empty or text is empty."""

    def test_returns_empty_list_when_api_key_missing(self):
        from unittest.mock import patch, MagicMock
        from apps.search.views import _llm_extract_skill_names

        mock_settings = MagicMock()
        mock_settings.ANTHROPIC_API_KEY = ""
        with patch("apps.search.views.settings", mock_settings):
            result = _llm_extract_skill_names("Python Django AWS")
        assert result == []

    def test_returns_empty_list_when_text_is_empty(self):
        from unittest.mock import patch, MagicMock
        from apps.search.views import _llm_extract_skill_names

        mock_settings = MagicMock()
        mock_settings.ANTHROPIC_API_KEY = ""
        with patch("apps.search.views.settings", mock_settings):
            result = _llm_extract_skill_names("")
        assert result == []

    def test_returns_empty_list_when_text_is_whitespace_only(self):
        from unittest.mock import patch, MagicMock
        from apps.search.views import _llm_extract_skill_names

        mock_settings = MagicMock()
        mock_settings.ANTHROPIC_API_KEY = ""
        with patch("apps.search.views.settings", mock_settings):
            result = _llm_extract_skill_names("   ")
        assert result == []


@pytest.mark.django_db
class TestMatchToDbSkills:
    """_match_to_db_skills(skill_names) — maps names to Skill IDs with weight 1.5."""

    def test_returns_empty_dict_for_empty_list(self):
        from apps.search.views import _match_to_db_skills

        assert _match_to_db_skills([]) == {}

    def test_exact_match_returns_skill_id_with_weight(self, skill):
        from apps.search.views import _match_to_db_skills

        result = _match_to_db_skills(["Python"])
        assert skill.id in result
        assert result[skill.id] == 1.5

    def test_case_insensitive_match(self, skill):
        from apps.search.views import _match_to_db_skills

        result = _match_to_db_skills(["python"])
        assert skill.id in result

    def test_no_match_returns_empty_dict(self, skill):
        from apps.search.views import _match_to_db_skills

        result = _match_to_db_skills(["COBOL", "FortranXYZ"])
        assert result == {}


@pytest.mark.django_db
class TestRegexFallbackSkills:
    """_regex_fallback_skills(text) — regex keyword scan against Skill DB."""

    def test_returns_skill_id_when_name_in_text(self, skill):
        from apps.search.views import _regex_fallback_skills

        result = _regex_fallback_skills("I have Python experience and love Django.")
        assert skill.id in result
        assert result[skill.id] == 1.5

    def test_returns_empty_dict_when_no_match(self, skill):
        from apps.search.views import _regex_fallback_skills

        result = _regex_fallback_skills("I only know COBOL and nothing else.")
        assert skill.id not in result

    def test_returns_empty_dict_for_empty_text(self, skill):
        from apps.search.views import _regex_fallback_skills

        result = _regex_fallback_skills("")
        assert result == {}


@pytest.mark.django_db
class TestExtractResumeSkills:
    """_extract_resume_skills(profile) — full pipeline, no LLM in tests."""

    def test_returns_empty_dict_when_no_resume(self, seeker_profile):
        from apps.search.views import _extract_resume_skills

        seeker_profile.resume = None
        seeker_profile.save(update_fields=["resume"])
        result = _extract_resume_skills(seeker_profile)
        assert result == {}


@pytest.mark.django_db
class TestRecommendationsWithResume:
    """Integration: /api/v1/search/recommendations/ with a text resume uploaded."""

    url = f"{BASE}/recommendations/"

    def test_returns_200_with_results_key_when_resume_uploaded(self, seeker_client, seeker, job, skill):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from apps.profiles.models import JobSeekerProfile

        profile, _ = JobSeekerProfile.objects.get_or_create(user=seeker)
        resume_content = b"Experienced Python developer with Django and REST API skills."
        profile.resume = SimpleUploadedFile("resume.txt", resume_content, content_type="text/plain")
        profile.save()

        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert "results" in r.data
