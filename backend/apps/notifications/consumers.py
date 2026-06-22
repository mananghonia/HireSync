import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
            return

        await self.accept()
        self.group_name = f"notifications_{user.id}"
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            count = await self.get_unread_count(user)
            await self.send(json.dumps({"type": "unread_count", "count": count}))
        except Exception as e:
            await self.send(json.dumps({"type": "error", "message": str(e)}))
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "mark_read":
            notification_id = data.get("notification_id")
            if notification_id:
                await self.mark_notification_read(notification_id, self.scope["user"])

    async def notification_message(self, event):
        await self.send(json.dumps({
            "type": "notification",
            "notification": event["notification"],
        }))

    @database_sync_to_async
    def get_unread_count(self, user):
        from .models import Notification
        return Notification.objects.filter(recipient=user, is_read=False).count()

    @database_sync_to_async
    def mark_notification_read(self, notification_id, user):
        from .models import Notification
        Notification.objects.filter(id=notification_id, recipient=user).update(is_read=True)
