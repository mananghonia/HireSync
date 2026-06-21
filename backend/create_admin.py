import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hiresync.settings_dev")
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(email="admin@hiresync.com").exists():
    User.objects.create_superuser(
        email="admin@hiresync.com",
        password="Admin@1234",
        first_name="Admin",
        last_name="HireSync",
    )
    print("Admin created: admin@hiresync.com / Admin@1234")
else:
    print("Admin already exists")
