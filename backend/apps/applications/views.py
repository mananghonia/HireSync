from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsJobSeeker, IsRecruiter
from .models import Application, ApplicationStatusHistory, RecruiterNote
from .serializers import (
    ApplicationCreateSerializer,
    ApplicationSeekerSerializer,
    ApplicationRecruiterSerializer,
    UpdateApplicationStatusSerializer,
    RecruiterNoteSerializer,
)


def _fire(task_name, *args):
    try:
        from apps.notifications import tasks as t
        getattr(t, task_name).delay(*args)
    except Exception:
        pass


class SeekerApplicationViewSet(viewsets.ModelViewSet):
    """Seeker applies to jobs, views own applications, withdraws."""
    permission_classes = [IsJobSeeker]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == "create":
            return ApplicationCreateSerializer
        return ApplicationSeekerSerializer

    def get_queryset(self):
        return (
            Application.objects.filter(applicant=self.request.user)
            .select_related("job__company", "job__recruiter")
        )

    def create(self, request, *_args, **_kwargs):
        job_id = request.data.get("job")
        cover_letter = request.data.get("cover_letter", "")

        # If a withdrawn application exists, reactivate it instead of creating a duplicate
        existing = Application.objects.filter(applicant=request.user, job_id=job_id).first()
        if existing:
            if existing.status == "withdrawn":
                old_status = existing.status
                existing.status = "applied"
                existing.cover_letter = cover_letter
                existing.save()
                ApplicationStatusHistory.objects.create(
                    application=existing,
                    old_status=old_status,
                    new_status="applied",
                    changed_by=request.user,
                    note="Re-applied after withdrawal",
                )
                _fire("send_new_application_notification", str(existing.id))
                serializer = ApplicationSeekerSerializer(existing, context={"request": request})
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(
                {"detail": "You have already applied to this job."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = serializer.save(applicant=request.user)
        ApplicationStatusHistory.objects.create(
            application=application,
            old_status="",
            new_status="applied",
            changed_by=request.user,
        )
        _fire("send_new_application_notification", str(application.id))
        out = ApplicationSeekerSerializer(application, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        application = self.get_object()
        if application.status in ("hired", "rejected"):
            return Response({"detail": "Cannot withdraw at this stage."}, status=status.HTTP_400_BAD_REQUEST)
        old_status = application.status
        application.status = "withdrawn"
        application.save()
        ApplicationStatusHistory.objects.create(
            application=application,
            old_status=old_status,
            new_status="withdrawn",
            changed_by=request.user,
        )
        _fire("send_withdrawal_notification", str(application.id))
        return Response({"detail": "Application withdrawn."})


class RecruiterApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    """Recruiter views applicants for their jobs and manages ATS pipeline."""
    permission_classes = [IsRecruiter]

    def get_serializer_class(self):
        return ApplicationRecruiterSerializer

    def get_queryset(self):
        qs = (
            Application.objects.filter(job__recruiter=self.request.user)
            .select_related("applicant", "job__company")
        )
        job_id = self.request.query_params.get("job_id")
        app_status = self.request.query_params.get("status")
        if job_id:
            qs = qs.filter(job_id=job_id)
        if app_status:
            qs = qs.filter(status=app_status)
        return qs

    @action(detail=True, methods=["patch"])
    def update_status(self, request, pk=None):
        application = self.get_object()
        serializer = UpdateApplicationStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = application.status
        new_status = serializer.validated_data["status"]
        note = serializer.validated_data.get("note", "")

        application.status = new_status
        application.save()

        ApplicationStatusHistory.objects.create(
            application=application,
            old_status=old_status,
            new_status=new_status,
            changed_by=request.user,
            note=note,
        )

        _fire("send_application_status_notification", str(application.id), new_status)

        return Response(ApplicationRecruiterSerializer(application, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def add_note(self, request, pk=None):
        application = self.get_object()
        serializer = RecruiterNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(application=application, recruiter=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
