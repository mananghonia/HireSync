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


def _generate_interview_questions(application) -> list:
    """
    Use Claude to generate tailored interview questions for an applicant.
    Returns a list of {name, questions} category dicts.
    """
    import io, json
    from django.conf import settings

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "")

    # --- Extract resume text ---
    resume_text = ""
    try:
        resume_file = application.resume_snapshot
        if resume_file:
            name = (resume_file.name or "").lower()
            resume_file.seek(0)
            raw = resume_file.read()
            resume_file.seek(0)
            if name.endswith(".pdf"):
                import pdfplumber
                with pdfplumber.open(io.BytesIO(raw)) as pdf:
                    resume_text = " ".join(p.extract_text() or "" for p in pdf.pages)
            elif name.endswith((".docx", ".doc")):
                import docx
                doc = docx.Document(io.BytesIO(raw))
                resume_text = " ".join(p.text for p in doc.paragraphs)
            else:
                resume_text = raw.decode("utf-8", errors="ignore")
    except Exception:
        pass

    job = application.job
    skills = ", ".join(s.name for s in job.skills.all()) or "Not specified"

    prompt = f"""You are an expert technical interviewer. Generate tailored interview questions for this candidate.

JOB DETAILS:
Title: {job.title}
Description: {job.description[:1500]}
Requirements: {job.requirements[:800]}
Required Skills: {skills}
Experience Level: {job.experience_level or "Not specified"}

CANDIDATE RESUME:
{resume_text[:3000] if resume_text else "Resume not available — base questions on the job requirements."}

Generate exactly 12 interview questions in 4 categories:
1. Technical Skills (3 questions specific to their tech stack and the job requirements)
2. Problem Solving (3 questions with real scenario-based challenges relevant to this role)
3. Behavioral (3 STAR-method questions relevant to this specific role)
4. Role Fit (3 questions about motivation, culture, and goals specific to this position)

Return ONLY valid JSON in this exact format:
{{
  "categories": [
    {{
      "name": "Technical Skills",
      "questions": ["question 1", "question 2", "question 3"]
    }},
    {{
      "name": "Problem Solving",
      "questions": ["question 1", "question 2", "question 3"]
    }},
    {{
      "name": "Behavioral",
      "questions": ["question 1", "question 2", "question 3"]
    }},
    {{
      "name": "Role Fit",
      "questions": ["question 1", "question 2", "question 3"]
    }}
  ]
}}"""

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
            start, end = raw.find("{"), raw.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(raw[start:end])
                return data.get("categories", [])
        except Exception:
            pass

    # Fallback: generic questions based on job title + skills
    return [
        {"name": "Technical Skills", "questions": [
            f"Walk me through your experience with {skills.split(',')[0].strip() if skills != 'Not specified' else 'the core technologies for this role'}.",
            f"How have you approached technical challenges in previous {job.title} roles?",
            "Describe a technically complex project you've led or contributed to significantly.",
        ]},
        {"name": "Problem Solving", "questions": [
            "Describe a time you had to debug a critical issue under time pressure. What was your approach?",
            "How do you prioritize when you have multiple urgent tasks competing for your attention?",
            "Tell me about a time you had to learn a new technology quickly for a project.",
        ]},
        {"name": "Behavioral", "questions": [
            "Tell me about a time you disagreed with a team decision. How did you handle it?",
            "Describe a project where you had to collaborate with people from different backgrounds.",
            "Give an example of when you received critical feedback. How did you respond?",
        ]},
        {"name": "Role Fit", "questions": [
            f"Why are you interested in this {job.title} position specifically?",
            "Where do you see your career heading in the next 3 years?",
            "What does your ideal team culture look like?",
        ]},
    ]


def _fire(task_name, *args):
    try:
        from apps.notifications import tasks as t
        getattr(t, task_name)(*args)
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

    def _attach_resume(self, application, request):
        """Attach resume: use uploaded file, or fall back to profile resume."""
        uploaded = request.FILES.get("resume_snapshot")
        if uploaded:
            application.resume_snapshot = uploaded
            application.save(update_fields=["resume_snapshot"])
            return True
        # Fall back to profile resume
        try:
            profile = request.user.seeker_profile
            if profile.resume:
                application.resume_snapshot.name = profile.resume.name
                application.save(update_fields=["resume_snapshot"])
                return True
        except Exception:
            pass
        return False

    def create(self, request, *_args, **_kwargs):
        job_id = request.data.get("job")
        cover_letter = request.data.get("cover_letter", "")

        # Ensure seeker has a resume (profile or uploaded)
        has_upload = bool(request.FILES.get("resume_snapshot"))
        has_profile_resume = False
        try:
            has_profile_resume = bool(request.user.seeker_profile.resume)
        except Exception:
            pass
        if not has_upload and not has_profile_resume:
            return Response(
                {"detail": "Please upload a resume before applying. Go to your Profile page to upload one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If a withdrawn application exists, reactivate it
        existing = Application.objects.filter(applicant=request.user, job_id=job_id).first()
        if existing:
            if existing.status == "withdrawn":
                old_status = existing.status
                existing.status = "applied"
                existing.cover_letter = cover_letter
                existing.save()
                self._attach_resume(existing, request)
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
        self._attach_resume(application, request)
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
        interview_at = serializer.validated_data.get("interview_scheduled_at")

        application.status = new_status
        if new_status == "interview_scheduled" and interview_at:
            application.interview_scheduled_at = interview_at
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
    def generate_questions(self, request, pk=None):
        application = self.get_object()
        questions = _generate_interview_questions(application)
        return Response({"categories": questions})

    @action(detail=True, methods=["post"])
    def add_note(self, request, pk=None):
        application = self.get_object()
        serializer = RecruiterNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(application=application, recruiter=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
