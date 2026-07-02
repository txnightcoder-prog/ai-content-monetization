"""
Daily diagnostic service.

Runs all health checks and sends an alert email via SendGrid if any
check fails or warns.  Called by the /api/v1/health/run-daily endpoint,
which is triggered every morning by a GitHub Actions scheduled workflow.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

ALERT_TO   = "txnightcoder@gmail.com"
ALERT_FROM = os.getenv("ALERT_EMAIL_FROM", "diagnostics@ai-content-bot.dev")


async def send_alert_email(subject: str, html_body: str) -> None:
    """
    Send an alert email using SendGrid.

    Requires env var:
      SENDGRID_API_KEY  — API key from sendgrid.com (free tier: 100 emails/day)
    """
    import httpx

    api_key = os.getenv("SENDGRID_API_KEY", "")
    if not api_key:
        logger.error("SENDGRID_API_KEY is not set — cannot send alert email")
        return

    payload = {
        "personalizations": [{"to": [{"email": ALERT_TO}]}],
        "from": {"email": ALERT_FROM, "name": "AI Content Monitor"},
        "subject": subject,
        "content": [{"type": "text/html", "value": html_body}],
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        if r.status_code == 202:
            logger.info("Alert email sent to %s", ALERT_TO)
        else:
            logger.error("SendGrid returned %s: %s", r.status_code, r.text)


def _build_html_report(
    checks: List[Dict[str, Any]],
    summary: Dict[str, int],
    run_at: str,
) -> str:
    """Build a readable HTML email body from check results."""
    status_color = {"pass": "#16a34a", "fail": "#dc2626", "warn": "#d97706"}
    status_icon  = {"pass": "✅", "fail": "❌", "warn": "⚠️"}

    rows = ""
    for c in checks:
        color = status_color.get(c["status"], "#6b7280")
        icon  = status_icon.get(c["status"], "•")
        hint_row = (
            f"<tr><td colspan='3' style='padding:4px 12px 10px;color:#dc2626;font-size:13px'>"
            f"💡 Fix: {c['hint']}</td></tr>"
        ) if c.get("hint") else ""
        rows += f"""
        <tr style='border-top:1px solid #e5e7eb'>
          <td style='padding:10px 12px;font-weight:600;color:#111827'>{icon} {c['name']}</td>
          <td style='padding:10px 12px;text-align:center'>
            <span style='background:{color};color:#fff;border-radius:12px;padding:2px 10px;font-size:12px;font-weight:700'>
              {c['status'].upper()}
            </span>
          </td>
          <td style='padding:10px 12px;color:#374151;font-size:13px'>{c['detail']}</td>
        </tr>{hint_row}"""

    overall_color = "#dc2626" if summary["failed"] > 0 else ("#d97706" if summary["warned"] > 0 else "#16a34a")
    overall_label = "🚨 FAILURES DETECTED" if summary["failed"] > 0 else ("⚠️ WARNINGS" if summary["warned"] > 0 else "✅ ALL SYSTEMS HEALTHY")

    return f"""
<!DOCTYPE html><html><body style='font-family:-apple-system,Segoe UI,sans-serif;background:#f9fafb;margin:0;padding:24px'>
<div style='max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb'>
  <div style='background:{overall_color};padding:20px 24px'>
    <h1 style='margin:0;color:#fff;font-size:20px'>{overall_label}</h1>
    <p style='margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px'>
      AI Content Monetization Platform · {run_at}
    </p>
  </div>
  <div style='padding:16px 24px;background:#f3f4f6;display:flex;gap:24px'>
    <span style='font-size:14px;color:#111827'><strong style='color:#16a34a'>{summary['passed']}</strong> passed</span>
    <span style='font-size:14px;color:#111827'><strong style='color:#dc2626'>{summary['failed']}</strong> failed</span>
    <span style='font-size:14px;color:#111827'><strong style='color:#d97706'>{summary['warned']}</strong> warned</span>
    <span style='font-size:14px;color:#6b7280'>{summary['total']} total checks</span>
  </div>
  <table style='width:100%;border-collapse:collapse'>
    <thead>
      <tr style='background:#f9fafb'>
        <th style='padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase'>Check</th>
        <th style='padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase'>Status</th>
        <th style='padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase'>Detail</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
  <div style='padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center'>
    Sent automatically every day at 08:00 UTC · AI Content Monetization Platform
  </div>
</div>
</body></html>"""


async def run_daily_diagnostic() -> Dict[str, Any]:
    """
    Run all health checks.  If any check fails or warns, send an alert email.
    Always returns the full check results so the endpoint can relay them.
    """
    # Import here to avoid circular imports at module load time
    from app.api.routes.health_checks import run_checks

    result   = await run_checks()
    checks   = result["checks"]
    summary  = result["summary"]
    run_at   = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    needs_alert = summary["failed"] > 0 or summary["warned"] > 0

    if needs_alert:
        failed_names = [c["name"] for c in checks if c["status"] == "fail"]
        warned_names = [c["name"] for c in checks if c["status"] == "warn"]

        parts = []
        if failed_names:
            parts.append(f"{summary['failed']} failed: {', '.join(failed_names)}")
        if warned_names:
            parts.append(f"{summary['warned']} warned: {', '.join(warned_names)}")

        subject = f"🚨 AI Platform Alert [{run_at}] — {'; '.join(parts)}"
        html    = _build_html_report(checks, summary, run_at)

        try:
            await send_alert_email(subject, html)
            result["alert_sent"] = True
            result["alert_to"]   = ALERT_TO
        except Exception:
            logger.exception("Failed to send alert email")
            result["alert_sent"]  = False
            result["alert_error"] = "Email send failed — check SENDGRID_API_KEY"
    else:
        logger.info("Daily diagnostic passed — no alert needed")
        result["alert_sent"] = False

    result["run_at"] = run_at
    return result

# Made with Bob
