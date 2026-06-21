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


def _ws_payload(notification):
    return {
        "type": "notification_message",
        "notification": {
            "id": str(notification.id),
            "type": notification.notification_type,
            "title": notification.title,
            "message": notification.message,
            "data": notification.data,
            "created_at": notification.created_at.isoformat(),
        },
    }


@shared_task
def send_application_status_notification(application_id, new_status):
    from .models import Notification
    from apps.applications.models import Application
    from core.email import send_status_update_email

    try:
        application = Application.objects.select_related(
            "applicant", "job", "job__company"
        ).get(id=application_id)
    except Application.DoesNotExist:
        return

    status_labels = {
        "viewed": "Your application has been viewed",
        "shortlisted": "You've been shortlisted!",
        "interview_scheduled": "Interview has been scheduled",
        "offer_made": "You have received an offer",
        "hired": "Congratulations! You've been hired",
        "rejected": "Application update",
    }

    title = status_labels.get(new_status, "Application update")
    message = (
        f"Your application for {application.job.title} at "
        f"{application.job.company.name} is now: {new_status.replace('_', ' ').title()}"
    )

    notification = Notification.objects.create(
        recipient=application.applicant,
        notification_type="application_status",
        title=title,
        message=message,
        data={"application_id": str(application_id), "job_id": str(application.job_id), "status": new_status},
    )

    _push_to_ws(f"notifications_{application.applicant_id}", _ws_payload(notification))

    # Email the seeker
    try:
        if new_status == "interview_scheduled" and application.interview_scheduled_at:
            from core.email import send_interview_scheduled_email
            import zoneinfo
            dt = application.interview_scheduled_at
            # Format as readable string e.g. "Monday, 23 June 2026 at 10:30 AM"
            dt_str = dt.strftime("%A, %d %B %Y at %I:%M %p UTC")
            send_interview_scheduled_email(
                seeker_email=application.applicant.email,
                seeker_name=application.applicant.get_full_name(),
                job_title=application.job.title,
                company_name=application.job.company.name,
                interview_dt=dt_str,
            )
        else:
            send_status_update_email(
                seeker_email=application.applicant.email,
                seeker_name=application.applicant.get_full_name(),
                job_title=application.job.title,
                company_name=application.job.company.name,
                new_status=new_status,
            )
    except Exception:
        pass


@shared_task
def send_new_application_notification(application_id):
    from .models import Notification
    from apps.applications.models import Application
    from core.email import send_application_received_email

    try:
        application = Application.objects.select_related(
            "applicant", "job", "job__recruiter", "job__company"
        ).get(id=application_id)
    except Application.DoesNotExist:
        return

    notification = Notification.objects.create(
        recipient=application.job.recruiter,
        notification_type="new_application",
        title="New Application Received",
        message=f"{application.applicant.get_full_name()} applied to {application.job.title}",
        data={"application_id": str(application_id), "job_id": str(application.job_id)},
    )

    _push_to_ws(f"notifications_{application.job.recruiter_id}", _ws_payload(notification))

    # Email the recruiter
    try:
        send_application_received_email(
            recruiter_email=application.job.recruiter.email,
            recruiter_name=application.job.recruiter.get_full_name(),
            applicant_name=application.applicant.get_full_name(),
            job_title=application.job.title,
        )
    except Exception:
        pass


@shared_task
def send_withdrawal_notification(application_id):
    from .models import Notification
    from apps.applications.models import Application
    from core.email import send_withdrawal_email

    try:
        application = Application.objects.select_related(
            "applicant", "job", "job__recruiter", "job__company"
        ).get(id=application_id)
    except Application.DoesNotExist:
        return

    notification = Notification.objects.create(
        recipient=application.job.recruiter,
        notification_type="application_withdrawn",
        title="Application Withdrawn",
        message=f"{application.applicant.get_full_name()} withdrew their application for {application.job.title}",
        data={"application_id": str(application_id), "job_id": str(application.job_id)},
    )

    _push_to_ws(f"notifications_{application.job.recruiter_id}", _ws_payload(notification))

    # Email the recruiter
    try:
        send_withdrawal_email(
            recruiter_email=application.job.recruiter.email,
            recruiter_name=application.job.recruiter.get_full_name(),
            applicant_name=application.applicant.get_full_name(),
            job_title=application.job.title,
        )
    except Exception:
        pass
