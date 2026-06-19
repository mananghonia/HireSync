from rest_framework import generics, viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from core.permissions import IsJobSeeker, IsRecruiter
from .models import Skill, JobSeekerProfile, Experience, Education, Company, RecruiterProfile
from .serializers import (
    SkillSerializer,
    JobSeekerProfileSerializer,
    ExperienceSerializer,
    EducationSerializer,
    CompanySerializer,
    RecruiterProfileSerializer,
)


class SkillListView(generics.ListCreateAPIView):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["name", "category"]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]


class SeekerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = JobSeekerProfileSerializer
    permission_classes = [IsJobSeeker]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, _ = JobSeekerProfile.objects.get_or_create(user=self.request.user)
        return profile

    def perform_update(self, serializer):
        resume = self.request.FILES.get("resume")
        if resume:
            serializer.save(resume_filename=resume.name)
        else:
            serializer.save()


class SeekerProfileDetailView(generics.RetrieveAPIView):
    """Public read-only view of a seeker profile."""
    queryset = JobSeekerProfile.objects.select_related("user")
    serializer_class = JobSeekerProfileSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "user__id"
    lookup_url_kwarg = "user_id"


class ExperienceViewSet(viewsets.ModelViewSet):
    serializer_class = ExperienceSerializer
    permission_classes = [IsJobSeeker]

    def get_queryset(self):
        return Experience.objects.filter(profile__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = JobSeekerProfile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile)


class EducationViewSet(viewsets.ModelViewSet):
    serializer_class = EducationSerializer
    permission_classes = [IsJobSeeker]

    def get_queryset(self):
        return Education.objects.filter(profile__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = JobSeekerProfile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile)


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["name", "industry", "location"]
    filterset_fields = ["industry", "size"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsRecruiter()]

    @action(detail=False, methods=["get", "post"], permission_classes=[IsRecruiter])
    def my_company(self, request):
        """Get or create the recruiter's own company."""
        profile, _ = RecruiterProfile.objects.get_or_create(user=request.user)

        if request.method == "POST":
            serializer = CompanySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            company = serializer.save()
            profile.company = company
            profile.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        if profile.company:
            return Response(CompanySerializer(profile.company).data)
        return Response(None)


class RecruiterProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = RecruiterProfileSerializer
    permission_classes = [IsRecruiter]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, _ = RecruiterProfile.objects.get_or_create(user=self.request.user)
        return profile
