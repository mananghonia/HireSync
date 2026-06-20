import requests
from django.conf import settings


def _send(subject: str, html: str, to_email: str, to_name: str = "") -> bool:
    api_key = getattr(settings, "BREVO_API_KEY", "")
    if not api_key:
        print(f"\n[DEV EMAIL] To: {to_email} | Subject: {subject}\n", flush=True)
        return True

    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        json={
            "sender": {"name": "HireSync", "email": "maddy748496@gmail.com"},
            "to": [{"email": to_email, "name": to_name or to_email}],
            "subject": subject,
            "htmlContent": html,
        },
        timeout=10,
    )
    return resp.status_code == 201


def _base_html(body: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#1d4ed8;margin:0 0 20px">HireSync</h2>
      {body}
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px">
        This is an automated notification from HireSync. Do not reply to this email.
      </p>
    </div>
    """


def send_otp_email(email: str, otp: str, name: str = "", subject: str = "HireSync — Your Verification Code") -> bool:
    html = _base_html(f"""
      <p style="color:#374151;font-size:15px">Hi {name or 'there'},</p>
      <p style="color:#374151;font-size:15px">Use this code to verify your identity. It expires in <strong>10 minutes</strong>.</p>
      <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#0369a1">{otp}</span>
      </div>
      <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email.</p>
    """)
    return _send(subject, html, email, name)


def send_application_received_email(recruiter_email: str, recruiter_name: str,
                                     applicant_name: str, job_title: str) -> bool:
    html = _base_html(f"""
      <p style="color:#374151;font-size:15px">Hi {recruiter_name or 'there'},</p>
      <p style="color:#374151;font-size:15px">
        <strong>{applicant_name}</strong> has applied to your job posting:
      </p>
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:16px 20px;margin:20px 0">
        <p style="margin:0;font-size:16px;font-weight:600;color:#15803d">📋 {job_title}</p>
      </div>
      <p style="color:#374151;font-size:14px">Log in to HireSync to review their application.</p>
    """)
    return _send(f"New application for {job_title}", html, recruiter_email, recruiter_name)


def send_withdrawal_email(recruiter_email: str, recruiter_name: str,
                           applicant_name: str, job_title: str) -> bool:
    html = _base_html(f"""
      <p style="color:#374151;font-size:15px">Hi {recruiter_name or 'there'},</p>
      <p style="color:#374151;font-size:15px">
        <strong>{applicant_name}</strong> has withdrawn their application for:
      </p>
      <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:16px 20px;margin:20px 0">
        <p style="margin:0;font-size:16px;font-weight:600;color:#dc2626">📋 {job_title}</p>
      </div>
    """)
    return _send(f"Application withdrawn — {job_title}", html, recruiter_email, recruiter_name)


def send_status_update_email(seeker_email: str, seeker_name: str,
                              job_title: str, company_name: str, new_status: str) -> bool:
    status_labels = {
        "viewed": ("Your application has been viewed", "#2563eb", "👀", "#eff6ff", "#bfdbfe"),
        "shortlisted": ("You've been shortlisted!", "#15803d", "⭐", "#f0fdf4", "#86efac"),
        "interview_scheduled": ("Interview Scheduled", "#7c3aed", "📅", "#faf5ff", "#c4b5fd"),
        "offer_made": ("You have received an offer!", "#d97706", "🎉", "#fffbeb", "#fcd34d"),
        "hired": ("Congratulations — You're hired!", "#15803d", "🏆", "#f0fdf4", "#86efac"),
        "rejected": ("Application Update", "#6b7280", "📩", "#f9fafb", "#e5e7eb"),
    }
    label, color, icon, bg, border = status_labels.get(
        new_status, ("Application Update", "#6b7280", "📩", "#f9fafb", "#e5e7eb")
    )
    html = _base_html(f"""
      <p style="color:#374151;font-size:15px">Hi {seeker_name or 'there'},</p>
      <p style="color:#374151;font-size:15px">There's an update on your application for <strong>{job_title}</strong> at <strong>{company_name}</strong>.</p>
      <div style="background:{bg};border:1.5px solid {border};border-radius:10px;padding:20px;margin:20px 0;text-align:center">
        <p style="font-size:28px;margin:0">{icon}</p>
        <p style="font-size:17px;font-weight:700;color:{color};margin:8px 0 0">{label}</p>
      </div>
      <p style="color:#374151;font-size:14px">Log in to HireSync to view the full details.</p>
    """)
    return _send(f"Application update — {job_title}", html, seeker_email, seeker_name)
