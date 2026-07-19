"""
Email Delivery Service
======================
Sends the personalised video download link to the customer after
the video has been generated and uploaded.

Provider selection:
  1. SendGrid  — if SENDGRID_API_KEY is set   (already in requirements.txt)
  2. Mailgun   — if MAILGUN_API_KEY is set
  3. SMTP      — if SMTP_HOST is set          (generic fallback)
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_FROM_EMAIL = os.getenv("EMAIL_FROM", "noreply@example.com")
_FROM_NAME  = os.getenv("EMAIL_FROM_NAME", "Your Personalised Video")


# ── SendGrid ─────────────────────────────────────────────────────────────────

async def _send_sendgrid(
    to_email: str,
    to_name:  str,
    subject:  str,
    html:     str,
) -> str:
    from sendgrid import SendGridAPIClient          # type: ignore
    from sendgrid.helpers.mail import Mail, To, From, HtmlContent  # type: ignore

    sg = SendGridAPIClient(os.environ["SENDGRID_API_KEY"])
    message = Mail(
        from_email=From(_FROM_EMAIL, _FROM_NAME),
        to_emails=To(to_email, to_name),
        subject=subject,
        html_content=HtmlContent(html),
    )
    response = sg.send(message)
    msg_id = response.headers.get("X-Message-Id", "")
    logger.info("EmailService(SendGrid): sent to %s — msg_id=%s", to_email, msg_id)
    return msg_id


# ── Mailgun ──────────────────────────────────────────────────────────────────

async def _send_mailgun(
    to_email: str,
    to_name:  str,
    subject:  str,
    html:     str,
) -> str:
    import httpx
    domain  = os.environ["MAILGUN_DOMAIN"]
    api_key = os.environ["MAILGUN_API_KEY"]
    r = httpx.post(
        f"https://api.mailgun.net/v3/{domain}/messages",
        auth=("api", api_key),
        data={
            "from":    f"{_FROM_NAME} <{_FROM_EMAIL}>",
            "to":      f"{to_name} <{to_email}>",
            "subject": subject,
            "html":    html,
        },
        timeout=15,
    )
    r.raise_for_status()
    msg_id = r.json().get("id", "")
    logger.info("EmailService(Mailgun): sent to %s — msg_id=%s", to_email, msg_id)
    return msg_id


# ── SMTP fallback ─────────────────────────────────────────────────────────────

async def _send_smtp(
    to_email: str,
    to_name:  str,
    subject:  str,
    html:     str,
) -> str:
    import smtplib, asyncio
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{_FROM_NAME} <{_FROM_EMAIL}>"
    msg["To"]      = f"{to_name} <{to_email}>"
    msg.attach(MIMEText(html, "html"))

    def _sync_send():
        host = os.environ["SMTP_HOST"]
        port = int(os.getenv("SMTP_PORT", "587"))
        user = os.getenv("SMTP_USER", "")
        pw   = os.getenv("SMTP_PASSWORD", "")
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            if user:
                server.login(user, pw)
            server.sendmail(_FROM_EMAIL, [to_email], msg.as_string())

    await asyncio.to_thread(_sync_send)
    logger.info("EmailService(SMTP): sent to %s", to_email)
    return ""


# ── Public interface ──────────────────────────────────────────────────────────

def _render_delivery_email(child_name: Optional[str], video_url: str) -> str:
    name = child_name or "your child"
    return f"""
<html><body style="font-family:sans-serif;max-width:560px;margin:auto">
<h2>🎉 Your personalised video is ready!</h2>
<p>Hi there,</p>
<p>We've finished creating the personalised video for <strong>{name}</strong>.</p>
<p style="margin:24px 0">
  <a href="{video_url}" style="background:#3b82d4;color:#fff;padding:12px 24px;
     border-radius:6px;text-decoration:none;font-size:16px">
     ▶ Watch / Download Video
  </a>
</p>
<p style="color:#888;font-size:12px">If the button doesn't work, copy this link: {video_url}</p>
</body></html>
"""


class EmailService:
    """Send the delivery email with the video download URL."""

    async def send_delivery(
        self,
        to_email:   str,
        to_name:    str,
        child_name: Optional[str],
        video_url:  str,
    ) -> str:
        """Returns the provider message-id (or empty string on SMTP)."""
        subject = f"🎬 Your personalised video for {child_name or 'your child'} is ready!"
        html    = _render_delivery_email(child_name, video_url)

        if os.getenv("SENDGRID_API_KEY"):
            return await _send_sendgrid(to_email, to_name, subject, html)
        if os.getenv("MAILGUN_API_KEY"):
            return await _send_mailgun(to_email, to_name, subject, html)
        if os.getenv("SMTP_HOST"):
            return await _send_smtp(to_email, to_name, subject, html)

        logger.warning(
            "EmailService: no email provider configured — skipping delivery to %s", to_email
        )
        return ""

    def provider_name(self) -> str:
        if os.getenv("SENDGRID_API_KEY"):  return "SendGrid"
        if os.getenv("MAILGUN_API_KEY"):   return "Mailgun"
        if os.getenv("SMTP_HOST"):         return "SMTP"
        return "none"

# Made with Bob
