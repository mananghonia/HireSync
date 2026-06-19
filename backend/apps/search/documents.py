# Elasticsearch document — only used when running with Docker + Elasticsearch.
# Local dev falls back to ORM search in views.py.
try:
    from django_elasticsearch_dsl import Document, fields
    from django_elasticsearch_dsl.registries import registry
    from apps.jobs.models import Job

    @registry.register_document
    class JobDocument(Document):
        company_name = fields.TextField(attr="company.name")
        skills = fields.NestedField(properties={
            "id": fields.IntegerField(),
            "name": fields.TextField(),
            "slug": fields.KeywordField(),
        })

        class Index:
            name = "jobs"
            settings = {"number_of_shards": 1, "number_of_replicas": 0}

        class Django:
            model = Job
            fields = ["id", "title", "description", "job_type", "experience_level",
                      "location", "is_remote", "salary_min", "salary_max", "status", "created_at"]

        def prepare_skills(self, instance):
            return [{"id": s.id, "name": s.name, "slug": s.slug} for s in instance.skills.all()]

except ImportError:
    pass
