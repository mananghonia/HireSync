import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
            return

        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        has_access = await self.user_in_conversation(user, self.conversation_id)
        if not has_access:
            await self.close()
            return

        self.group_name = f"chat_{self.conversation_id}"
        await self.accept()
        await self.channel_layer.group_add(self.group_name, self.channel_name)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        content = data.get("content", "").strip()
        if not content:
            return

        user = self.scope["user"]
        message = await self.save_message(user, self.conversation_id, content)

        msg_payload = {
            "id": str(message.id),
            "sender_id": str(user.id),
            "sender_name": user.get_full_name(),
            "content": message.content,
            "sent_at": message.sent_at.isoformat(),
            "is_read": False,
        }

        # Broadcast to everyone in the chat room
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat_message", "message": msg_payload},
        )

        # Persist + push popup notification to the other participant. Persisting (not just
        # pushing over the socket) means the notification survives if the recipient isn't
        # connected at this exact moment — it'll show up in their notification list/unread
        # count on next load, same as every other notification type.
        other_id = await self.get_other_participant_id(user, self.conversation_id)
        if other_id:
            notification = await self.create_notification(other_id, user, content)
            await self.channel_layer.group_send(
                f"notifications_{other_id}",
                {
                    "type": "notification_message",
                    "notification": {
                        "id": str(notification.id),
                        "type": notification.notification_type,
                        "title": notification.title,
                        "message": notification.message,
                        "data": notification.data,
                        "created_at": notification.created_at.isoformat(),
                    },
                },
            )

    async def chat_message(self, event):
        await self.send(json.dumps({"type": "message", "message": event["message"]}))

    @database_sync_to_async
    def user_in_conversation(self, user, conversation_id):
        from .models import Conversation
        return Conversation.objects.filter(id=conversation_id, participants=user).exists()

    @database_sync_to_async
    def get_other_participant_id(self, sender, conversation_id):
        from .models import Conversation
        try:
            convo = Conversation.objects.get(id=conversation_id)
            others = [p for p in convo.participants.all() if str(p.id) != str(sender.id)]
            return str(others[0].id) if others else None
        except Exception:
            return None

    @database_sync_to_async
    def save_message(self, user, conversation_id, content):
        from .models import Conversation, Message
        conversation = Conversation.objects.get(id=conversation_id)
        message = Message.objects.create(conversation=conversation, sender=user, content=content)
        Conversation.objects.filter(id=conversation_id).update(updated_at=message.sent_at)
        return message

    @database_sync_to_async
    def create_notification(self, recipient_id, sender, content):
        from apps.notifications.models import Notification
        return Notification.objects.create(
            recipient_id=recipient_id,
            notification_type="new_message",
            title=f"New message from {sender.get_full_name()}",
            message=content[:80] + ("…" if len(content) > 80 else ""),
            data={"conversation_id": str(self.conversation_id)},
        )
