from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

User = get_user_model()

ALLOWED_PAIRS = {("seeker", "recruiter"), ("recruiter", "seeker")}


class ConversationListView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        me = self.request.user
        all_convos = Conversation.objects.filter(participants=me).order_by("-updated_at")

        # Only return conversations where the other participant has the opposite role (seeker ↔ recruiter)
        valid = []
        for convo in all_convos:
            others = [p for p in convo.participants.all() if str(p.id) != str(me.id)]
            if others and (me.role, others[0].role) in ALLOWED_PAIRS:
                valid.append(convo)
        return valid

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class ConversationCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        other_user_id = request.data.get("user_id")
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if str(other_user.id) == str(request.user.id):
            return Response({"detail": "Cannot message yourself."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce seeker ↔ recruiter only
        if (request.user.role, other_user.role) not in ALLOWED_PAIRS:
            return Response(
                {"detail": "Messaging is only allowed between seekers and recruiters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find existing conversation (Python intersection — M2M chained filter unreliable on MongoDB)
        my_ids = set(str(c.id) for c in Conversation.objects.filter(participants=request.user))
        their_ids = set(str(c.id) for c in Conversation.objects.filter(participants=other_user))
        common = my_ids & their_ids

        conversation = Conversation.objects.filter(id__in=list(common)).first() if common else None

        if not conversation:
            conversation = Conversation.objects.create()
            conversation.participants.add(request.user, other_user)

        serializer = ConversationSerializer(conversation, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class MessageListView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs["conversation_id"]
        conversation = Conversation.objects.filter(
            id=conversation_id, participants=self.request.user
        ).first()
        if not conversation:
            return Message.objects.none()
        Message.objects.filter(conversation=conversation, is_read=False).exclude(
            sender=self.request.user
        ).update(is_read=True)
        return Message.objects.filter(conversation=conversation)

    def perform_create(self, serializer):
        conversation_id = self.kwargs["conversation_id"]
        conversation = Conversation.objects.filter(
            id=conversation_id, participants=self.request.user
        ).first()
        if not conversation:
            return
        serializer.save(sender=self.request.user, conversation=conversation)
