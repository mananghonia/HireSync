from collections import Counter, defaultdict
from datetime import timedelta

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response

from core.permissions import IsRecruiter
from apps.jobs.models import Job
from apps.applications.models import Application


class RecruiterDashboardView(APIView):
    permission_classes = [IsRecruiter]

    def get(self, request):
        recruiter = request.user
        jobs = list(Job.objects.filter(recruiter=recruiter))

        total_jobs = len(jobs)
        active_jobs = sum(1 for j in jobs if j.status == "active")
        total_views = sum(j.views_count for j in jobs)

        applications = list(Application.objects.filter(job__recruiter=recruiter))
        total_applications = len(applications)

        status_counts = Counter(a.status for a in applications)
        status_breakdown = dict(status_counts)

        hired_count = status_counts.get("hired", 0)
        successful = hired_count + status_counts.get("offer_made", 0)
        conversion_rate = round(successful / total_applications * 100, 1) if total_applications else 0

        # Top performing jobs (by application count)
        job_app_counts = Counter(str(a.job_id) for a in applications)
        top_jobs = sorted(
            [
                {
                    "id": str(j.id),
                    "title": j.title,
                    "views_count": j.views_count,
                    "app_count": job_app_counts.get(str(j.id), 0),
                }
                for j in jobs if j.status == "active"
            ],
            key=lambda x: x["app_count"],
            reverse=True,
        )[:5]

        # Daily applications — last 30 days
        thirty_days_ago = timezone.now() - timedelta(days=30)
        daily: dict = defaultdict(int)
        for app in applications:
            if app.applied_at >= thirty_days_ago:
                daily[app.applied_at.strftime("%Y-%m-%d")] += 1
        daily_applications = [{"date": d, "count": c} for d, c in sorted(daily.items())]

        return Response({
            "overview": {
                "total_jobs": total_jobs,
                "active_jobs": active_jobs,
                "total_views": total_views,
                "total_applications": total_applications,
                "hired_count": hired_count,
                "conversion_rate": conversion_rate,
            },
            "status_breakdown": status_breakdown,
            "top_jobs": top_jobs,
            "daily_applications": daily_applications,
        })


class JobAnalyticsView(APIView):
    permission_classes = [IsRecruiter]

    def get(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id, recruiter=request.user)
        except Job.DoesNotExist:
            return Response({"detail": "Job not found."}, status=404)

        applications = list(Application.objects.filter(job=job))
        status_breakdown = dict(Counter(a.status for a in applications))

        return Response({
            "job_id": str(job.id),
            "title": job.title,
            "views": job.views_count,
            "applications": len(applications),
            "status_breakdown": status_breakdown,
        })
