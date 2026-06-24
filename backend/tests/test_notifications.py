"""
Tests for apps/notifications — list, mark read, unread count.
"""
import pytest


BASE = "/api/v1/notifications"


@pytest.fixture
def unread_notifications(db, seeker):
    from apps.notifications.models import Notification
    n1 = Notification.objects.create(
        recipient=seeker, title="N1", message="msg1", notification_type="general"
    )
    n2 = Notification.objects.create(
        recipient=seeker, title="N2", message="msg2", notification_type="new_application"
    )
    return [n1, n2]


@pytest.mark.django_db
class TestNotificationList:
    url = f"{BASE}/"

    def test_seeker_sees_own_notifications(self, seeker_client, notification):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        assert len(results) >= 1

    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401

    def test_filter_unread(self, seeker_client, unread_notifications):
        r = seeker_client.get(self.url, {"is_read": "false"})
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        assert all(not n["is_read"] for n in results)

    def test_filter_read(self, seeker_client, seeker):
        from apps.notifications.models import Notification
        Notification.objects.create(
            recipient=seeker, title="Read", message="x", is_read=True
        )
        r = seeker_client.get(self.url, {"is_read": "true"})
        results = r.data.get("results") or r.data
        assert all(n["is_read"] for n in results)

    def test_limit_parameter(self, seeker_client, unread_notifications):
        r = seeker_client.get(self.url, {"limit": "1"})
        assert r.status_code == 200
        results = r.data.get("results") or r.data
        assert len(results) <= 1

    def test_user_only_sees_own_notifications(self, seeker_client, notification, make_user):
        from apps.notifications.models import Notification
        other = make_user(email="other@test.com")
        Notification.objects.create(recipient=other, title="Other", message="x")
        r = seeker_client.get(self.url)
        results = r.data.get("results") if isinstance(r.data, dict) else r.data
        titles = [n["title"] for n in results]
        assert "Other" not in titles
        assert "Test Notification" in titles


@pytest.mark.django_db
class TestMarkAllRead:
    url = f"{BASE}/mark-all-read/"

    def test_marks_all_notifications_read(self, seeker_client, unread_notifications):
        r = seeker_client.post(self.url, {}, format="json")
        assert r.status_code == 200
        for n in unread_notifications:
            n.refresh_from_db()
            assert n.is_read is True

    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.post(self.url, {}, format="json")
        assert r.status_code == 401


@pytest.mark.django_db
class TestMarkRead:
    def test_mark_single_notification_read(self, seeker_client, notification):
        url = f"{BASE}/{str(notification.pk)}/read/"
        r = seeker_client.post(url, {}, format="json")
        assert r.status_code == 200
        notification.refresh_from_db()
        assert notification.is_read is True

    def test_mark_nonexistent_returns_404(self, seeker_client):
        r = seeker_client.post(f"{BASE}/000000000000000000000000/read/", {}, format="json")
        assert r.status_code == 404

    def test_cannot_mark_other_users_notification(self, recruiter_client, notification):
        url = f"{BASE}/{str(notification.pk)}/read/"
        r = recruiter_client.post(url, {}, format="json")
        assert r.status_code == 404

    def test_unauthenticated_returns_401(self, api_client, notification):
        url = f"{BASE}/{str(notification.pk)}/read/"
        r = api_client.post(url, {}, format="json")
        assert r.status_code == 401


@pytest.mark.django_db
class TestUnreadCount:
    url = f"{BASE}/unread-count/"

    def test_returns_correct_count(self, seeker_client, unread_notifications):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert r.data["unread_count"] == 2

    def test_count_zero_when_no_notifications(self, seeker_client):
        r = seeker_client.get(self.url)
        assert r.status_code == 200
        assert r.data["unread_count"] == 0

    def test_count_decreases_after_mark_all_read(self, seeker_client, unread_notifications):
        seeker_client.post(f"{BASE}/mark-all-read/", {}, format="json")
        r = seeker_client.get(self.url)
        assert r.data["unread_count"] == 0

    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.get(self.url)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# TestNotificationTasks — direct task function calls (Celery is a passthrough)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNotificationTasks:
    """
    Call task functions directly — shared_task is a passthrough decorator
    in this project, so no Celery worker is needed.
    """

    def test_send_application_status_notification_creates_notification(self, application, seeker):
        from apps.notifications.tasks import send_application_status_notification
        from apps.notifications.models import Notification

        count_before = Notification.objects.filter(recipient=seeker).count()
        send_application_status_notification(str(application.id), "shortlisted")
        assert Notification.objects.filter(recipient=seeker).count() == count_before + 1

    def test_send_application_status_notification_type(self, application, seeker):
        from apps.notifications.tasks import send_application_status_notification
        from apps.notifications.models import Notification

        send_application_status_notification(str(application.id), "offer_made")
        n = Notification.objects.filter(
            recipient=seeker, notification_type="application_status"
        ).latest("created_at")
        assert n.notification_type == "application_status"
        assert n.data["status"] == "offer_made"

    def test_send_application_status_notification_interview_scheduled(self, application, seeker):
        from django.utils import timezone
        from apps.notifications.tasks import send_application_status_notification
        from apps.notifications.models import Notification

        application.interview_scheduled_at = timezone.now()
        application.save(update_fields=["interview_scheduled_at"])

        send_application_status_notification(str(application.id), "interview_scheduled")
        n = Notification.objects.filter(
            recipient=seeker, notification_type="application_status"
        ).latest("created_at")
        assert n.data["status"] == "interview_scheduled"

    def test_send_application_status_notification_invalid_id_silent(self):
        from apps.notifications.tasks import send_application_status_notification
        # Should not raise — DoesNotExist is silently swallowed
        send_application_status_notification("000000000000000000000099", "hired")

    def test_send_new_application_notification_creates_notification(self, application, recruiter):
        from apps.notifications.tasks import send_new_application_notification
        from apps.notifications.models import Notification

        count_before = Notification.objects.filter(recipient=recruiter).count()
        send_new_application_notification(str(application.id))
        assert Notification.objects.filter(recipient=recruiter).count() == count_before + 1

    def test_send_new_application_notification_type(self, application, recruiter):
        from apps.notifications.tasks import send_new_application_notification
        from apps.notifications.models import Notification

        send_new_application_notification(str(application.id))
        n = Notification.objects.filter(
            recipient=recruiter, notification_type="new_application"
        ).latest("created_at")
        assert n.notification_type == "new_application"
        assert n.data["application_id"] == str(application.id)

    def test_send_new_application_notification_invalid_id_silent(self):
        from apps.notifications.tasks import send_new_application_notification
        send_new_application_notification("000000000000000000000099")

    def test_send_withdrawal_notification_creates_notification(self, application, recruiter):
        from apps.notifications.tasks import send_withdrawal_notification
        from apps.notifications.models import Notification

        count_before = Notification.objects.filter(recipient=recruiter).count()
        send_withdrawal_notification(str(application.id))
        assert Notification.objects.filter(recipient=recruiter).count() == count_before + 1

    def test_send_withdrawal_notification_type(self, application, recruiter):
        from apps.notifications.tasks import send_withdrawal_notification
        from apps.notifications.models import Notification

        send_withdrawal_notification(str(application.id))
        n = Notification.objects.filter(
            recipient=recruiter, notification_type="application_withdrawn"
        ).latest("created_at")
        assert n.notification_type == "application_withdrawn"

    def test_send_withdrawal_notification_invalid_id_silent(self):
        from apps.notifications.tasks import send_withdrawal_notification
        send_withdrawal_notification("000000000000000000000099")
