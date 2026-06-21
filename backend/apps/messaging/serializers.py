from rest_framework import serializers
from apps.users.serializers import UserSerializer
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "sender", "content", "is_read", "sent_at"]
        read_only_fields = ["id", "sender", "is_read", "sent_at"]


class ConversationSerializer(serializers.ModelSerializer):
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "other_participant", "last_message", "unread_count", "updated_at"]

    def get_other_participant(self, obj):
        user = self.context["request"].user
        # .exclude() on M2M can be unreliable on MongoDB — iterate instead
        others = [p for p in obj.participants.all() if str(p.id) != str(user.id)]
        return UserSerializer(others[0]).data if others else None

    def get_last_message(self, obj):
        msg = obj.messages.last()
        return MessageSerializer(msg).data if msg else None

    def get_unread_count(self, obj):
        user = self.context["request"].user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()
