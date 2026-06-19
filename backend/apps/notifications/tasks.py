try:
    from celery import shared_task
except ImportError:
    def shared_task(fn):
        return fn

try:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    _channels_available = True
except Exception:
    _channels_available = False


def _push_to_ws(group_name, payload):
    if not _channels_available:
        return
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(group_name, payload)
    except Exception:
        pass


@shared_task
def send_application_status_notification(application_id, new_status):
    from .models import Notification
    from apps.applications.models import Application

    try:
        application = Application.objects.select_related("applicant", "job__company").get(id=application_id)
    except Application.DoesNotExist:
        return

    status_labels = {
        "viewed": "Your application has been viewed",
        "shortlisted": "You've been shortlisted",
        "interview_scheduled": "Interview has been scheduled",
        "offer_made": "You have received an offer",
        "hired": "Congratulations! You've been hired",
        "rejected": "Application update",
    }

    title = status_labels.get(new_status, "Application update")
    message = f"Your application for {application.job.title} at {application.job.company.name} is now: {new_status.replace('_', ' ').title()}"

    notification = Notification.objects.create(
        recipient=application.applicant,
        notification_type="application_status",
        title=title,
        message=message,
        data={"application_id": application_id, "job_id": application.job_id, "status": new_status},
    )

    _push_to_ws(
        f"notifications_{application.applicant_id}",
        {
            "type": "notification_message",
            "notification": {
                "id": notification.id,
                "type": notification.notification_type,
                "title": notification.title,
                "message": notification.message,
                "data": notification.data,
                "created_at": notification.created_at.isoformat(),
            },
        },
    )


@shared_task
def send_new_application_notification(application_id):
    from .models import Notification
    from apps.applications.models import Application

    try:
        application = Application.objects.select_related("applicant", "job__recruiter", "job__company").get(id=application_id)
    except Application.DoesNotExist:
        return

    notification = Notification.objects.create(
        recipient=application.job.recruiter,
        notification_type="new_application",
        title="New Application Received",
        message=f"{application.applicant.get_full_name()} applied to {application.job.title}",
        data={"application_id": application_id, "job_id": application.job_id},
    )

    _push_to_ws(
        f"notifications_{application.job.recruiter_id}",
        {
            "type": "notification_message",
            "notification": {
                "id": notification.id,
                "type": notification.notification_type,
                "title": notification.title,
                "message": notification.message,
                "data": notification.data,
                "created_at": notification.created_at.isoformat(),
            },
        },
    )
