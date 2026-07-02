"""
Tests for apps/messaging — conversations and messages.
"""
import pytest


BASE = "/api/v1/messaging"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def conversation(db, seeker, recruiter):
    from apps.messaging.models import Conversation
    conv = Conversation.objects.create(participant_key=Conversation.key_for(seeker.id, recruiter.id))
    conv.participants.add(seeker, recruiter)
    return conv


# ── Conversation List ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestConversationList:
    url = f"{BASE}/conversations/"

    def test_seeker_sees_own_conversations(self, seeker_client, conversation):
        r = seeker_client.get(self.url)
        assert r.status_code == 200

    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401

    def test_empty_list_for_user_without_conversations(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert r.data == []

    def test_recruiter_sees_conversations(self, recruiter_client, conversation):
        r = recruiter_client.get(self.url)
        assert r.status_code == 200


# ── Create Conversation ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateConversation:
    url = f"{BASE}/conversations/start/"

    def test_seeker_can_start_conversation_with_recruiter(self, seeker_client, recruiter):
        r = seeker_client.post(self.url, {"user_id": str(recruiter.pk)}, format="json")
        assert r.status_code == 200

    def test_recruiter_can_start_conversation_with_seeker(self, recruiter_client, seeker):
        r = recruiter_client.post(self.url, {"user_id": str(seeker.pk)}, format="json")
        assert r.status_code == 200

    def test_cannot_message_self(self, seeker_client, seeker):
        r = seeker_client.post(self.url, {"user_id": str(seeker.pk)}, format="json")
        assert r.status_code == 400
        assert "yourself" in r.data["detail"].lower()

    def test_seeker_cannot_message_another_seeker(self, seeker_client, make_user):
        other_seeker = make_user(email="seeker2@test.com", role="seeker")
        r = seeker_client.post(self.url, {"user_id": str(other_seeker.pk)}, format="json")
        assert r.status_code == 400

    def test_recruiter_cannot_message_another_recruiter(self, recruiter_client, make_user):
        other_rec = make_user(email="rec2@test.com", role="recruiter")
        r = recruiter_client.post(self.url, {"user_id": str(other_rec.pk)}, format="json")
        assert r.status_code == 400

    def test_nonexistent_user_returns_404(self, seeker_client):
        import uuid
        r = seeker_client.post(self.url, {"user_id": str(uuid.uuid4())}, format="json")
        assert r.status_code == 404

    def test_existing_conversation_returned_without_duplicate(self, seeker_client, recruiter, conversation):
        from apps.messaging.models import Conversation
        count_before = Conversation.objects.count()
        r = seeker_client.post(self.url, {"user_id": str(recruiter.pk)}, format="json")
        assert r.status_code == 200
        assert Conversation.objects.count() == count_before

    def test_unauthenticated_returns_401(self, api_client, seeker):
        r = api_client.post(self.url, {"user_id": str(seeker.pk)}, format="json")
        assert r.status_code == 401

    def test_creating_conversation_is_idempotent_under_key_collision(self, seeker, recruiter):
        """
        Simulates the race: another concurrent request already won and created the
        conversation for this exact pair. get_or_create on the unique participant_key
        must find that row instead of creating a second one.
        """
        from apps.messaging.models import Conversation
        key = Conversation.key_for(seeker.id, recruiter.id)
        winner = Conversation.objects.create(participant_key=key)
        winner.participants.add(seeker, recruiter)

        conv, created = Conversation.objects.get_or_create(participant_key=key)
        assert created is False
        assert conv.pk == winner.pk
        assert Conversation.objects.filter(participant_key=key).count() == 1


# ── Messages ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMessages:
    def _url(self, conv_id):
        return f"{BASE}/conversations/{conv_id}/messages/"

    def test_seeker_can_list_messages(self, seeker_client, conversation):
        r = seeker_client.get(self._url(str(conversation.pk)))
        assert r.status_code == 200

    def test_seeker_can_send_message(self, seeker_client, conversation):
        r = seeker_client.post(self._url(str(conversation.pk)), {
            "content": "Hello recruiter!"
        }, format="json")
        assert r.status_code == 201
        assert r.data["content"] == "Hello recruiter!"

    def test_recruiter_can_reply(self, recruiter_client, conversation):
        r = recruiter_client.post(self._url(str(conversation.pk)), {
            "content": "Hi seeker, thanks for reaching out!"
        }, format="json")
        assert r.status_code == 201

    def test_listing_messages_does_not_mark_them_read(self, seeker_client, recruiter, conversation):
        """
        GET must be side-effect-free — marking read is now an explicit separate
        action (MarkMessagesReadView), not something that happens just by listing.
        """
        from apps.messaging.models import Message
        msg = Message.objects.create(
            conversation=conversation,
            sender=recruiter,
            content="Unread message from recruiter",
            is_read=False,
        )
        seeker_client.get(self._url(str(conversation.pk)))
        msg.refresh_from_db()
        assert msg.is_read is False

    def test_non_participant_gets_empty_messages(self, seeker_client, make_user):
        from apps.messaging.models import Conversation
        other_seeker = make_user(email="other_participant@test.com", role="seeker")
        other_rec = make_user(email="other_rec2@test.com", role="recruiter")
        other_conv = Conversation.objects.create(participant_key=Conversation.key_for(other_seeker.id, other_rec.id))
        other_conv.participants.add(other_seeker, other_rec)
        r = seeker_client.get(self._url(str(other_conv.pk)))
        assert r.status_code == 200
        # Non-participant gets empty queryset; response may be list or paginated
        count = r.data.get("count", len(r.data)) if isinstance(r.data, dict) else len(r.data)
        assert count == 0

    def test_non_participant_cannot_send_message(self, seeker_client, make_user):
        """
        A non-participant used to get a fake 201 success with the message never
        actually persisted. Must now be rejected outright with no row created.
        """
        from apps.messaging.models import Conversation, Message
        other_seeker = make_user(email="intruder_seeker@test.com", role="seeker")
        other_rec = make_user(email="intruder_rec@test.com", role="recruiter")
        other_conv = Conversation.objects.create(participant_key=Conversation.key_for(other_seeker.id, other_rec.id))
        other_conv.participants.add(other_seeker, other_rec)

        r = seeker_client.post(self._url(str(other_conv.pk)), {"content": "sneaky message"}, format="json")
        assert r.status_code == 404
        assert Message.objects.filter(conversation=other_conv).count() == 0

    def test_unauthenticated_returns_401(self, api_client, conversation):
        r = api_client.get(self._url(str(conversation.pk)))
        assert r.status_code == 401


# ── Mark Messages Read ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMarkMessagesRead:
    def _url(self, conv_id):
        return f"{BASE}/conversations/{conv_id}/read/"

    def test_marks_unread_messages_from_other_sender_as_read(self, seeker_client, recruiter, conversation):
        from apps.messaging.models import Message
        msg = Message.objects.create(
            conversation=conversation, sender=recruiter, content="Hi", is_read=False,
        )
        r = seeker_client.post(self._url(str(conversation.pk)))
        assert r.status_code == 200
        assert r.data["marked_read"] == 1
        msg.refresh_from_db()
        assert msg.is_read is True

    def test_does_not_mark_own_messages_read(self, seeker_client, seeker, conversation):
        from apps.messaging.models import Message
        msg = Message.objects.create(
            conversation=conversation, sender=seeker, content="My own message", is_read=False,
        )
        seeker_client.post(self._url(str(conversation.pk)))
        msg.refresh_from_db()
        assert msg.is_read is False

    def test_non_participant_returns_404(self, seeker_client, make_user):
        from apps.messaging.models import Conversation
        other_seeker = make_user(email="read_intruder_seeker@test.com", role="seeker")
        other_rec = make_user(email="read_intruder_rec@test.com", role="recruiter")
        other_conv = Conversation.objects.create(participant_key=Conversation.key_for(other_seeker.id, other_rec.id))
        other_conv.participants.add(other_seeker, other_rec)
        r = seeker_client.post(self._url(str(other_conv.pk)))
        assert r.status_code == 404

    def test_unauthenticated_returns_401(self, api_client, conversation):
        r = api_client.post(self._url(str(conversation.pk)))
        assert r.status_code == 401
