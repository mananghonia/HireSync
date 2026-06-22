from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "core"

    def ready(self):
        # Register ObjectIdAutoField → CharField in DRF's serializer field mapping
        # so all ModelSerializers treat MongoDB ObjectId primary keys as strings.
        try:
            from rest_framework import serializers
            from django_mongodb_backend.fields import ObjectIdAutoField
            serializers.ModelSerializer.serializer_field_mapping[ObjectIdAutoField] = serializers.CharField
        except ImportError:
            pass

        # Disconnect Django's create_permissions post_migrate signal.
        # django-mongodb-backend creates ContentType instances without PKs before
        # hashing them into a set(), causing TypeError. We don't use Django's
        # model-level permissions (JWT + custom role checks instead), so this is safe.
        try:
            from django.contrib.auth.management import create_permissions
            from django.db.models.signals import post_migrate
            post_migrate.disconnect(create_permissions)
        except Exception:
            pass
