import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hiresync.settings_dev")

import django
django.setup()

from apps.users.models import User

if not User.objects.filter(email="admin@hiresync.com").exists():
    User.objects.create_superuser(
        email="admin@hiresync.com",
        password="Admin@123",
        first_name="Admin",
        last_name="HireSync",
        role="admin",
    )
    print("Superuser created: admin@hiresync.com / Admin@123")
else:
    print("Superuser already exists.")
