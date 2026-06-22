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
        # Django registers it with a dispatch_uid — must pass the same uid to disconnect.
        # django-mongodb-backend creates ContentType instances without PKs before
        # hashing them into a set(), causing TypeError. Safe to remove because
        # this project uses JWT + custom role permission classes, not Django model permissions.
        try:
            from django.db.models.signals import post_migrate
            post_migrate.disconnect(
                dispatch_uid="django.contrib.auth.management.create_permissions"
            )
        except Exception:
            pass
