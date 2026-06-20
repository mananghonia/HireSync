from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from core.permissions import IsAdmin
from .serializers import UserSerializer

User = get_user_model()


class AdminStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.jobs.models import Job
        from apps.applications.models import Application

        now = timezone.now()
        week_ago = now - timezone.timedelta(days=7)
        month_ago = now - timezone.timedelta(days=30)

        total_users = User.objects.count()
        new_users_week = User.objects.filter(created_at__gte=week_ago).count()
        seekers = User.objects.filter(role="seeker").count()
        recruiters = User.objects.filter(role="recruiter").count()

        total_jobs = Job.objects.count()
        active_jobs = Job.objects.filter(status="open").count()
        jobs_this_month = Job.objects.filter(created_at__gte=month_ago).count()

        total_applications = Application.objects.count()
        applications_this_week = Application.objects.filter(applied_at__gte=week_ago).count()

        hired = Application.objects.filter(status="hired").count()

        return Response({
            "users": {
                "total": total_users,
                "new_this_week": new_users_week,
                "seekers": seekers,
                "recruiters": recruiters,
            },
            "jobs": {
                "total": total_jobs,
                "active": active_jobs,
                "posted_this_month": jobs_this_month,
            },
            "applications": {
                "total": total_applications,
                "this_week": applications_this_week,
                "hired": hired,
            },
        })


class AdminUserListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = User.objects.all().order_by("-created_at")

        role = request.query_params.get("role")
        search = request.query_params.get("search", "").strip()
        is_active = request.query_params.get("is_active")

        if role:
            qs = qs.filter(role=role)
        if search:
            qs = [u for u in qs if search.lower() in u.email.lower()
                  or search.lower() in u.get_full_name().lower()]
        if is_active is not None:
            active_val = is_active.lower() == "true"
            if isinstance(qs, list):
                qs = [u for u in qs if u.is_active == active_val]
            else:
                qs = qs.filter(is_active=active_val)

        users = list(qs)
        data = []
        for u in users:
            data.append({
                "id": str(u.id),
                "email": u.email,
                "full_name": u.get_full_name(),
                "role": u.role,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "created_at": u.created_at.isoformat(),
            })
        return Response(data)


class AdminUserDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        if str(user.id) == str(request.user.id):
            return Response({"detail": "Cannot modify your own admin account."}, status=400)

        if "is_active" in request.data:
            user.is_active = bool(request.data["is_active"])
            user.save(update_fields=["is_active"])

        return Response({
            "id": str(user.id),
            "email": user.email,
            "full_name": user.get_full_name(),
            "role": user.role,
            "is_active": user.is_active,
        })

    def delete(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        if str(user.id) == str(request.user.id):
            return Response({"detail": "Cannot delete your own account."}, status=400)

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminJobListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.jobs.models import Job

        qs = Job.objects.select_related("company", "recruiter").order_by("-created_at")

        job_status = request.query_params.get("status")
        search = request.query_params.get("search", "").strip()

        if job_status:
            qs = qs.filter(status=job_status)

        jobs = list(qs)
        if search:
            jobs = [j for j in jobs if search.lower() in j.title.lower()
                    or search.lower() in j.company.name.lower()]

        data = []
        for j in jobs:
            data.append({
                "id": str(j.id),
                "title": j.title,
                "company": j.company.name,
                "recruiter": j.recruiter.get_full_name(),
                "recruiter_email": j.recruiter.email,
                "status": j.status,
                "location": j.location,
                "created_at": j.created_at.isoformat(),
            })
        return Response(data)


class AdminJobDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, job_id):
        from apps.jobs.models import Job
        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            return Response({"detail": "Job not found."}, status=404)

        new_status = request.data.get("status")
        if new_status not in ("open", "closed", "paused"):
            return Response({"detail": "Invalid status."}, status=400)

        job.status = new_status
        job.save(update_fields=["status"])
        return Response({"id": str(job.id), "title": job.title, "status": job.status})

    def delete(self, request, job_id):
        from apps.jobs.models import Job
        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            return Response({"detail": "Job not found."}, status=404)

        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
