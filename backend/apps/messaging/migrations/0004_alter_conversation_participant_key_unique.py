from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0003_backfill_participant_key'),
    ]

    operations = [
        migrations.AlterField(
            model_name='conversation',
            name='participant_key',
            field=models.CharField(blank=True, editable=False, max_length=200, null=True, unique=True),
        ),
    ]
