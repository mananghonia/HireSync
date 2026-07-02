from django.db import models
from django.conf import settings
from django_mongodb_backend.fields import ObjectIdAutoField


class Conversation(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="conversations")
    # Deterministic fingerprint of the two participant IDs (sorted, so order doesn't matter).
    # A DB-level unique constraint on this — rather than the participants M2M, which can't
    # express "exactly these two users" as a uniqueness rule — closes the race where two
    # concurrent "start conversation" calls between the same pair would otherwise both
    # succeed and create duplicate conversations.
    participant_key = models.CharField(max_length=200, unique=True, null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "conversations"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Conversation {self.id}"

    def get_other_participant(self, user):
        return self.participants.exclude(id=user.id).first()

    @staticmethod
    def key_for(user_id_a, user_id_b):
        return ":".join(sorted([str(user_id_a), str(user_id_b)]))


class Message(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messages"
        ordering = ["sent_at"]

    def __str__(self):
        return f"Message from {self.sender.get_full_name()} in Conv#{self.conversation_id}"
