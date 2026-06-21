from django.urls import path
from .views import ConversationListView, ConversationCreateView, MessageListView

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversations"),
    path("conversations/start/", ConversationCreateView.as_view(), name="start_conversation"),
    path("conversations/<str:conversation_id>/messages/", MessageListView.as_view(), name="messages"),
]
