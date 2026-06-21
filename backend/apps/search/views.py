from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q

from apps.jobs.serializers import JobListSerializer
from apps.jobs.models import Job
from apps.profiles.models import Skill


def _extract_resume_skills(profile):
    """
    Extract text from the seeker's resume (PDF or DOCX) and return a dict
    {skill_id: 1.5} for every skill whose name appears in the text.
    Weight 1.5 sits between manually-selected skills (2.0) and
    applied-job signals (0.5×freq).
    """
    if not profile.resume:
        return {}

    try:
        resume_file = profile.resume
        name = (resume_file.name or "").lower()
        resume_file.seek(0)
        raw_bytes = resume_file.read()
        resume_file.seek(0)
    except Exception:
        return {}

    text = ""
    try:
        if name.endswith(".pdf"):
            import pdfplumber, io
            with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
                text = " ".join(page.extract_text() or "" for page in pdf.pages)
        elif name.endswith((".docx", ".doc")):
            import docx, io
            doc = docx.Document(io.BytesIO(raw_bytes))
            text = " ".join(p.text for p in doc.paragraphs)
        else:
            # Try plain-text resume as fallback
            text = raw_bytes.decode("utf-8", errors="ignore")
    except Exception:
        return {}

    if not text.strip():
        return {}

    text_lower = text.lower()
    found = {}
    for skill in Skill.objects.all():
        skill_name = skill.name.lower()
        # Match whole word / token — avoids "Java" matching inside "JavaScript"
        import re
        pattern = r"\b" + re.escape(skill_name) + r"\b"
        if re.search(pattern, text_lower):
            found[skill.id] = 1.5
    return found


class JobSearchView(APIView):
    """
    Falls back to ORM-based search when Elasticsearch is unavailable.
    Replace with Elasticsearch when running via Docker.
    """
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
    Returns top job matches based on:
    1. Seeker's profile skills (primary signal)
    2. Skills from jobs they've previously applied to (interest signal)
    3. Experience level match
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import math
        from collections import Counter
        from apps.applications.models import Application

        try:
            profile = request.user.seeker_profile
        except Exception:
            return Response({"results": []})

        # --- Build interest profile ---
        profile_skills = set(profile.skills.values_list("id", flat=True))

        # Skills from previously applied jobs (weighted by recency — last 10 applications)
        past_apps = (
            Application.objects
            .filter(applicant=request.user)
            .exclude(status="withdrawn")
            .select_related("job")
            .order_by("-applied_at")[:10]
        )
        applied_skill_counts = Counter()
        applied_titles = []
        for app in past_apps:
            job_skills = list(app.job.skills.values_list("id", flat=True))
            for sk in job_skills:
                applied_skill_counts[sk] += 1
            applied_titles.append(app.job.title.lower())

        # --- Resume-extracted skills (weight 1.5 each) ---
        resume_skills = _extract_resume_skills(profile)

        # Combined interest: manual skills (2.0) + resume skills (1.5) + applied skills (0.5×freq)
        # Additive — a skill reinforced by multiple sources scores higher
        interest: dict = {sk: 2.0 for sk in profile_skills}
        for sk_id, weight in resume_skills.items():
            interest[sk_id] = interest.get(sk_id, 0) + weight
        for sk, count in applied_skill_counts.items():
            interest[sk] = interest.get(sk, 0) + count * 0.5

        # If no interest signals at all, return recent jobs
        if not interest:
            jobs = (
                Job.objects.filter(status="active")
                .select_related("company", "recruiter")
                .order_by("-created_at")[:20]
            )
            serializer = JobListSerializer(jobs, many=True, context={"request": request})
            return Response({"results": serializer.data})

        # Candidate jobs: active, not yet applied
        candidates = (
            Job.objects.filter(status="active")
            .exclude(applications__applicant=request.user)
            .select_related("company", "recruiter")
        )

        scored = []
        interest_magnitude = math.sqrt(sum(v * v for v in interest.values()))

        for job in candidates:
            job_skills = set(job.skills.values_list("id", flat=True))
            if not job_skills:
                continue

            # Cosine-like score against interest profile
            dot = sum(interest.get(sk, 0) for sk in job_skills)
            if dot == 0:
                continue
            job_magnitude = math.sqrt(len(job_skills))
            score = dot / (interest_magnitude * job_magnitude)

            # Bonus: experience level match
            if profile.experience_level and job.experience_level == profile.experience_level:
                score *= 1.2

            # Bonus: title keyword overlap with past applications
            if applied_titles:
                job_title_lower = job.title.lower()
                if any(word in job_title_lower for title in applied_titles for word in title.split() if len(word) > 3):
                    score *= 1.1

            scored.append((score, job))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_jobs = [job for _, job in scored[:20]]

        serializer = JobListSerializer(top_jobs, many=True, context={"request": request})
        return Response({"results": serializer.data})
