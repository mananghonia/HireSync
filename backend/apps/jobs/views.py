from django.db.models import F
from django.utils import timezone
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from core.permissions import IsRecruiter, IsJobSeeker, IsOwnerOrAdmin
from .filters import JobFilter
from .models import Job, SavedJob, JobView
from .serializers import (
    JobListSerializer,
    JobDetailSerializer,
    JobCreateUpdateSerializer,
    SavedJobSerializer,
)


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.select_related("recruiter", "company")
    filterset_class = JobFilter
    search_fields = ["title", "description", "company__name", "location"]
    ordering_fields = ["created_at", "salary_min", "salary_max", "views_count"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return JobListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return JobCreateUpdateSerializer
        return JobDetailSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsRecruiter(), IsOwnerOrAdmin()]
        if self.action in ["create", "my_jobs"]:
            return [IsRecruiter()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "list":
            # Public listing shows only active jobs
            if not self.request.user.is_authenticated or self.request.user.role == "seeker":
                qs = qs.filter(status="active")
        return qs

    def perform_create(self, serializer):
        serializer.save(recruiter=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Track view
        ip = request.META.get("REMOTE_ADDR")
        JobView.objects.create(job=instance, user=request.user if request.user.is_authenticated else None, ip_address=ip)
        Job.objects.filter(pk=instance.pk).update(views_count=F("views_count") + 1)
        instance.refresh_from_db(fields=["views_count"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[IsRecruiter])
    def my_jobs(self, request):
        jobs = self.get_queryset().filter(recruiter=request.user)
        page = self.paginate_queryset(jobs)
        serializer = JobListSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)


class SavedJobViewSet(viewsets.ModelViewSet):
    serializer_class = SavedJobSerializer
    permission_classes = [IsJobSeeker]

    def get_queryset(self):
        return SavedJob.objects.filter(user=self.request.user).select_related("job__company")

    def create(self, request, *args, **kwargs):
        job_id = request.data.get("job_id")
        try:
            job = Job.objects.get(id=job_id, status="active")
        except Job.DoesNotExist:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        saved, created = SavedJob.objects.get_or_create(user=request.user, job=job)
        if not created:
            saved.delete()
            return Response({"detail": "Job unsaved."}, status=status.HTTP_200_OK)

        serializer = self.get_serializer(saved)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
