from django.db import models
from django.conf import settings
from django_mongodb_backend.fields import ObjectIdAutoField


class Skill(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    category = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "skills"
        ordering = ["name"]

    def __str__(self):
        return self.name


class JobSeekerProfile(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    EXPERIENCE_CHOICES = [
        ("fresher", "Fresher (0 years)"),
        ("junior", "Junior (1-2 years)"),
        ("mid", "Mid-level (3-5 years)"),
        ("senior", "Senior (6-9 years)"),
        ("lead", "Lead/Principal (10+ years)"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seeker_profile"
    )
    photo = models.ImageField(upload_to="profiles/photos/", blank=True, null=True)
    bio = models.TextField(max_length=1000, blank=True)
    headline = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=200, blank=True)
    website = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    resume = models.FileField(upload_to="profiles/resumes/", blank=True, null=True)
    resume_filename = models.CharField(max_length=255, blank=True)
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_CHOICES, blank=True)
    skills = models.ManyToManyField(Skill, blank=True, related_name="seekers")
    expected_salary_min = models.PositiveIntegerField(null=True, blank=True)
    expected_salary_max = models.PositiveIntegerField(null=True, blank=True)
    is_open_to_work = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "seeker_profiles"

    def __str__(self):
        return f"Seeker: {self.user.get_full_name()}"


class Experience(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    profile = models.ForeignKey(JobSeekerProfile, on_delete=models.CASCADE, related_name="experiences")
    company = models.CharField(max_length=200)
    title = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "seeker_experiences"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.title} at {self.company}"


class Education(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    profile = models.ForeignKey(JobSeekerProfile, on_delete=models.CASCADE, related_name="education")
    institution = models.CharField(max_length=200)
    degree = models.CharField(max_length=200)
    field_of_study = models.CharField(max_length=200, blank=True)
    start_year = models.PositiveIntegerField()
    end_year = models.PositiveIntegerField(null=True, blank=True)
    grade = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "seeker_education"
        ordering = ["-start_year"]

    def __str__(self):
        return f"{self.degree} from {self.institution}"


class Company(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    INDUSTRY_CHOICES = [
        ("technology", "Technology"),
        ("finance", "Finance"),
        ("healthcare", "Healthcare"),
        ("education", "Education"),
        ("ecommerce", "E-Commerce"),
        ("media", "Media & Entertainment"),
        ("manufacturing", "Manufacturing"),
        ("consulting", "Consulting"),
        ("other", "Other"),
    ]

    SIZE_CHOICES = [
        ("1-10", "1-10 employees"),
        ("11-50", "11-50 employees"),
        ("51-200", "51-200 employees"),
        ("201-500", "201-500 employees"),
        ("501-1000", "501-1000 employees"),
        ("1000+", "1000+ employees"),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    logo = models.ImageField(upload_to="companies/logos/", blank=True, null=True)
    description = models.TextField(blank=True)
    industry = models.CharField(max_length=50, choices=INDUSTRY_CHOICES, blank=True)
    size = models.CharField(max_length=20, choices=SIZE_CHOICES, blank=True)
    website = models.URLField(blank=True)
    location = models.CharField(max_length=200, blank=True)
    founded_year = models.PositiveIntegerField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "companies"
        verbose_name_plural = "companies"

    def __str__(self):
        return self.name


class RecruiterProfile(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recruiter_profile"
    )
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="recruiters")
    job_title = models.CharField(max_length=200, blank=True)
    photo = models.ImageField(upload_to="profiles/photos/", blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    linkedin_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "recruiter_profiles"

    def __str__(self):
        return f"Recruiter: {self.user.get_full_name()}"
