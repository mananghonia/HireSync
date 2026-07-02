from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='conversation',
            name='participant_key',
            field=models.CharField(blank=True, editable=False, max_length=200, null=True),
        ),
    ]
