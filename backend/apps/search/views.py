import io
import json
import math
import re
from collections import Counter

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django.conf import settings

from apps.jobs.serializers import JobListSerializer
from apps.jobs.models import Job
from apps.profiles.models import Skill


# ---------------------------------------------------------------------------
# Resume text extraction
# ---------------------------------------------------------------------------

def _get_resume_text(profile) -> str:
    """Read raw text from the seeker's resume file (PDF / DOCX / plain text)."""
    if not profile.resume:
        return ""
    try:
        resume_file = profile.resume
        filename = (resume_file.name or "").lower()
        resume_file.seek(0)
        raw = resume_file.read()
        resume_file.seek(0)
    except Exception:
        return ""

    try:
        if filename.endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                return " ".join(page.extract_text() or "" for page in pdf.pages)
        if filename.endswith((".docx", ".doc")):
            import docx
            doc = docx.Document(io.BytesIO(raw))
            return " ".join(p.text for p in doc.paragraphs)
        # Plain-text fallback
        return raw.decode("utf-8", errors="ignore")
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# LLM-powered skill extraction (Claude Haiku)
# ---------------------------------------------------------------------------

def _llm_extract_skill_names(resume_text: str) -> list[str]:
    """
    Ask Claude to extract all skills mentioned in the resume.
    Returns a list of skill-name strings (e.g. ["Python", "Django", "AWS"]).
    Returns [] if the API key is absent or the call fails.
    """
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if not api_key or not resume_text.strip():
        return []

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        prompt = (
            "You are a resume parser. Extract every technical and professional skill "
            "mentioned in the resume below — programming languages, frameworks, tools, "
            "cloud platforms, methodologies, databases, and relevant soft skills.\n\n"
            "Return ONLY a JSON array of skill name strings, no explanation. "
            'Example: ["Python", "Django", "AWS", "Team Leadership"]\n\n'
            f"Resume:\n{resume_text[:8000]}"
        )

        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        start, end = raw.find("["), raw.rfind("]") + 1
        if start >= 0 and end > start:
            extracted = json.loads(raw[start:end])
            return [s for s in extracted if isinstance(s, str)]
    except Exception:
        pass
    return []


def _match_to_db_skills(skill_names: list[str]) -> dict:
    """
    Map a list of skill-name strings to Skill DB IDs with weight 1.5.
    Tries exact match first, then partial containment.
    """
    if not skill_names:
        return {}

    all_skills = list(Skill.objects.all())
    # Build lookup: lowercase name → id, lowercase slug → id
    name_map = {s.name.lower(): s.id for s in all_skills}
    slug_map = {s.slug.lower(): s.id for s in all_skills}

    found = {}
    for raw_name in skill_names:
        key = raw_name.lower().strip()
        if key in name_map:
            found[name_map[key]] = 1.5
        elif key in slug_map:
            found[slug_map[key]] = 1.5
        else:
            # Partial: e.g. "React.js" matches "React", "node" matches "Node.js"
            for s in all_skills:
                db = s.name.lower()
                if key in db or db in key:
                    found[s.id] = 1.5
                    break
    return found


def _regex_fallback_skills(resume_text: str) -> dict:
    """Regex keyword matching used when Claude API is unavailable."""
    text_lower = resume_text.lower()
    found = {}
    for skill in Skill.objects.all():
        pattern = r"\b" + re.escape(skill.name.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found[skill.id] = 1.5
    return found


def _extract_resume_skills(profile) -> dict:
    """
    Full pipeline: extract text → Claude extracts skill names → match to Skill DB.
    Falls back to regex keyword matching if Claude is unavailable.
    Returns {skill_id: 1.5} dict.
    """
    text = _get_resume_text(profile)
    if not text.strip():
        return {}

    skill_names = _llm_extract_skill_names(text)
    if skill_names:
        return _match_to_db_skills(skill_names)

    # Claude unavailable — regex fallback
    return _regex_fallback_skills(text)


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class JobSearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        location = request.query_params.get("location", "")
        job_type = request.query_params.get("job_type", "")
        experience = request.query_params.get("experience_level", "")
        salary_min = request.query_params.get("salary_min")
        salary_max = request.query_params.get("salary_max")
        is_remote = request.query_params.get("is_remote")
        skills = request.query_params.getlist("skills")
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        qs = Job.objects.filter(status="active").select_related("company", "recruiter")

        if query:
            qs = qs.filter(
                Q(title__icontains=query) |
                Q(description__icontains=query) |
                Q(company__name__icontains=query) |
                Q(requirements__icontains=query)
            )
        if location:
            qs = qs.filter(location__icontains=location)
        if job_type:
            qs = qs.filter(job_type=job_type)
        if experience:
            qs = qs.filter(experience_level=experience)
        if is_remote is not None:
            qs = qs.filter(is_remote=is_remote.lower() == "true")
        if salary_min:
            qs = qs.filter(salary_min__gte=int(salary_min))
        if salary_max:
            qs = qs.filter(salary_max__lte=int(salary_max))
        if skills:
            for skill_id in skills:
                qs = qs.filter(skills__id=int(skill_id))

        qs = qs.distinct().order_by("-created_at")
        total = qs.count()
        offset = (page - 1) * page_size
        jobs = qs[offset: offset + page_size]

        serializer = JobListSerializer(jobs, many=True, context={"request": request})
        return Response({
            "count": total,
            "total_pages": (total + page_size - 1) // page_size if total else 1,
            "current_page": page,
            "results": serializer.data,
        })


class JobRecommendationView(APIView):
    """
    Recommendation signals (additive weights):
      1. Manually selected profile skills      → weight 2.0
      2. LLM-extracted skills from resume      → weight 1.5
      3. Skills from past applied jobs         → weight 0.5 × frequency
      4. Experience level match bonus          → ×1.2
      5. Job title keyword overlap bonus       → ×1.1
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.applications.models import Application

        try:
            profile = request.user.seeker_profile
        except Exception:
            return Response({"results": []})

        # Signal 1: manually selected skills
        profile_skills = set(profile.skills.values_list("id", flat=True))

        # Signal 3: skills from past applications
        past_apps = (
            Application.objects
            .filter(applicant=request.user)
            .exclude(status="withdrawn")
            .select_related("job")
            .order_by("-applied_at")[:10]
        )
        applied_skill_counts: Counter = Counter()
        applied_titles = []
        for app in past_apps:
            for sk in app.job.skills.values_list("id", flat=True):
                applied_skill_counts[sk] += 1
            applied_titles.append(app.job.title.lower())

        # Signal 2: LLM resume extraction
        resume_skills = _extract_resume_skills(profile)

        # Combine all signals additively
        interest: dict = {sk: 2.0 for sk in profile_skills}
        for sk_id, w in resume_skills.items():
            interest[sk_id] = interest.get(sk_id, 0) + w
        for sk, count in applied_skill_counts.items():
            interest[sk] = interest.get(sk, 0) + count * 0.5

        # No signals at all → return recent active jobs
        if not interest:
            jobs = (
                Job.objects.filter(status="active")
                .select_related("company", "recruiter")
                .order_by("-created_at")[:20]
            )
            return Response({"results": JobListSerializer(jobs, many=True, context={"request": request}).data})

        candidates = (
            Job.objects.filter(status="active")
            .exclude(applications__applicant=request.user)
            .select_related("company", "recruiter")
        )

        interest_magnitude = math.sqrt(sum(v * v for v in interest.values()))
        scored = []

        for job in candidates:
            job_skills = set(job.skills.values_list("id", flat=True))
            if not job_skills:
                continue
            dot = sum(interest.get(sk, 0) for sk in job_skills)
            if dot == 0:
                continue
            score = dot / (interest_magnitude * math.sqrt(len(job_skills)))

            if profile.experience_level and job.experience_level == profile.experience_level:
                score *= 1.2
            if applied_titles:
                job_lower = job.title.lower()
                if any(w in job_lower for t in applied_titles for w in t.split() if len(w) > 3):
                    score *= 1.1

            scored.append((score, job))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_jobs = [job for _, job in scored[:20]]
        return Response({"results": JobListSerializer(top_jobs, many=True, context={"request": request}).data})
