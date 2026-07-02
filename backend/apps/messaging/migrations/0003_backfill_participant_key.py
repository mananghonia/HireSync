from django.db import migrations


def backfill_participant_key(apps, schema_editor):
    Conversation = apps.get_model('messaging', 'Conversation')
    for convo in Conversation.objects.all():
        ids = sorted(str(p.pk) for p in convo.participants.all())
        convo.participant_key = ":".join(ids)
        convo.save(update_fields=['participant_key'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0002_conversation_participant_key'),
    ]

    operations = [
        migrations.RunPython(backfill_participant_key, noop_reverse),
    ]
