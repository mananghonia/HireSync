from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q

from apps.jobs.serializers import JobListSerializer
from apps.jobs.models import Job


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
    """Returns top job matches for the authenticated seeker based on skill overlap."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import math
        try:
            profile = request.user.seeker_profile
        except Exception:
            return Response({"results": []})

        seeker_skills = set(profile.skills.values_list("id", flat=True))
        if not seeker_skills:
            jobs = Job.objects.filter(status="active").select_related("company", "recruiter").order_by("-created_at")[:20]
            serializer = JobListSerializer(jobs, many=True, context={"request": request})
            return Response({"results": serializer.data})

        jobs = (
            Job.objects.filter(status="active")
            .exclude(applications__applicant=request.user)
            .select_related("company", "recruiter")
        )

        scored = []
        for job in jobs:
            job_skills = set(job.skills.values_list("id", flat=True))
            if not job_skills:
                continue
            intersection = len(seeker_skills & job_skills)
            score = intersection / math.sqrt(len(seeker_skills) * len(job_skills))
            if score > 0:
                scored.append((score, job))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_jobs = [job for _, job in scored[:20]]

        serializer = JobListSerializer(top_jobs, many=True, context={"request": request})
        return Response({"results": serializer.data})
