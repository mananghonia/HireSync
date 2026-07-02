from django.urls import path
from .views import ConversationListView, ConversationCreateView, MessageListView, MarkMessagesReadView

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversations"),
    path("conversations/start/", ConversationCreateView.as_view(), name="start_conversation"),
    path("conversations/<str:conversation_id>/messages/", MessageListView.as_view(), name="messages"),
    path("conversations/<str:conversation_id>/read/", MarkMessagesReadView.as_view(), name="mark_messages_read"),
]
