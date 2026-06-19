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
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

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

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "message": {
                    "id": message.id,
                    "sender_id": str(user.id),
                    "sender_name": user.get_full_name(),
                    "content": message.content,
                    "sent_at": message.sent_at.isoformat(),
                    "is_read": False,
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
    def save_message(self, user, conversation_id, content):
        from .models import Conversation, Message
        conversation = Conversation.objects.get(id=conversation_id)
        message = Message.objects.create(conversation=conversation, sender=user, content=content)
        Conversation.objects.filter(id=conversation_id).update(updated_at=message.sent_at)
        return message
