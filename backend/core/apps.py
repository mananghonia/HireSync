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
