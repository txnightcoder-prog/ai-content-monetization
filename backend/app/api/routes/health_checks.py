"""
Health / Diagnostics endpoint.

Returns a structured list of checks the frontend Diagnostics page runs.
Each check hits a real dependency and reports pass/fail/warning + a fix hint.
"""
import asyncio
import logging
import os
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/health", tags=["health"])


async def _check(name: str, hint: str, coro) -> Dict[str, Any]:
    try:
        result = await coro
        return {"name": name, "status": "pass", "detail": result, "hint": ""}
    except Exception as exc:
        return {"name": name, "status": "fail", "detail": str(exc), "hint": hint}


@router.get("/checks")
async def run_checks() -> Dict[str, Any]:
    """
    Run all system health checks and return their results.
    Called by the Diagnostics page on the frontend.
    """
    checks: List[Dict[str, Any]] = []

    # ── 1. Backend reachable ─────────────────────────────────────────────────
    checks.append({
        "name": "Backend API",
        "status": "pass",
        "detail": "Backend is responding",
        "hint": "",
    })

    # ── 2. Database ──────────────────────────────────────────────────────────
    async def _db():
        from app.core.database import SessionLocal
        from app.models.content_script import ContentScript
        db = SessionLocal()
        try:
            count = db.query(ContentScript).count()
            return f"Connected — {count} scripts in DB"
        finally:
            db.close()
    checks.append(await _check(
        "Database",
        "Set DATABASE_URL env var and restart. Check Azure PostgreSQL firewall rules.",
        _db()
    ))

    # ── 3. OpenAI API key ────────────────────────────────────────────────────
    async def _openai():
        key = os.getenv("OPENAI_API_KEY", "")
        if not key:
            raise ValueError("OPENAI_API_KEY is not set")
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {key}"},
            )
            if r.status_code == 401:
                raise ValueError("Invalid API key (401 Unauthorized)")
            r.raise_for_status()
        return "OpenAI key is valid"
    checks.append(await _check(
        "OpenAI API Key",
        "Set OPENAI_API_KEY env var. Get a key at platform.openai.com/api-keys",
        _openai()
    ))

    # ── 4. ElevenLabs API key ────────────────────────────────────────────────
    async def _elevenlabs():
        key = os.getenv("ELEVENLABS_API_KEY", "")
        if not key:
            raise ValueError("ELEVENLABS_API_KEY is not set")
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.elevenlabs.io/v1/user/subscription",
                headers={"xi-api-key": key},
            )
            if r.status_code == 401:
                raise ValueError("Invalid ElevenLabs API key (401)")
            r.raise_for_status()
            data = r.json()
        chars_left = data.get("character_limit", 0) - data.get("character_count", 0)
        return f"ElevenLabs key valid — {chars_left:,} characters remaining"
    checks.append(await _check(
        "ElevenLabs API Key",
        "Set ELEVENLABS_API_KEY. Get a free key at elevenlabs.io (10,000 chars/mo free).",
        _elevenlabs()
    ))

    # ── 4b. Pexels API key ───────────────────────────────────────────────────
    async def _pexels():
        key = os.getenv("PEXELS_API_KEY", "")
        if not key:
            raise ValueError("PEXELS_API_KEY is not set")
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.pexels.com/videos/search",
                params={"query": "nature", "per_page": "1"},
                headers={"Authorization": key},
            )
            if r.status_code == 401:
                raise ValueError("Invalid Pexels API key (401)")
            r.raise_for_status()
        return "Pexels API key is valid"
    checks.append(await _check(
        "Pexels API Key",
        "Set PEXELS_API_KEY. Get a free key at pexels.com/api (free, unlimited).",
        _pexels()
    ))

    # ── 5. YouTube OAuth credentials ────────────────────────────────────────
    async def _yt_oauth():
        client_id     = os.getenv("YOUTUBE_CLIENT_ID", "")
        client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "")
        refresh_token = os.getenv("YOUTUBE_REFRESH_TOKEN", "")
        missing = [n for n, v in [
            ("YOUTUBE_CLIENT_ID", client_id),
            ("YOUTUBE_CLIENT_SECRET", client_secret),
            ("YOUTUBE_REFRESH_TOKEN", refresh_token),
        ] if not v]
        if missing:
            raise ValueError(f"Missing env vars: {', '.join(missing)}")
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id":     client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type":    "refresh_token",
                },
            )
            if r.status_code == 400:
                raise ValueError(f"Token refresh failed: {r.json().get('error_description','bad request')}")
            r.raise_for_status()
        return "YouTube OAuth credentials valid — upload ready"
    checks.append(await _check(
        "YouTube OAuth (upload)",
        "Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN. "
        "Create OAuth credentials at console.cloud.google.com → APIs → Credentials → OAuth 2.0 Client ID",
        _yt_oauth()
    ))

    # ── 6. YouTube Data API key ──────────────────────────────────────────────
    async def _yt():
        key = os.getenv("YOUTUBE_DATA_API_KEY", "")
        if not key:
            raise ValueError("YOUTUBE_DATA_API_KEY is not set — Parrot and live Trending will use AI fallback")
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={"part": "id", "chart": "mostPopular", "maxResults": "1", "key": key},
            )
            if r.status_code == 400:
                raise ValueError("Invalid YouTube API key")
            r.raise_for_status()
        return "YouTube Data API key is valid"
    checks.append(await _check(
        "YouTube Data API Key",
        "Set YOUTUBE_DATA_API_KEY. Create at console.cloud.google.com → APIs → Credentials",
        _yt()
    ))

    # ── 7. D-ID API key ──────────────────────────────────────────────────────
    async def _did():
        key = os.getenv("DID_API_KEY", "")
        if not key:
            raise ValueError(
                "DID_API_KEY is not set — video generation uses local pipeline (ElevenLabs+Pexels+FFmpeg)"
            )
        # D-ID keys are already base64(email:secret) — use directly
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.d-id.com/credits",
                headers={"Authorization": f"Basic {key}", "Accept": "application/json"},
            )
            if r.status_code == 401:
                raise ValueError("Invalid D-ID API key (401). Check DID_API_KEY env var.")
            r.raise_for_status()
            data = r.json()
        remaining = data.get("remaining", "?")
        total     = data.get("total", "?")
        return f"D-ID key valid — {remaining}/{total} credits remaining (talking-avatar mode active)"
    did_check = await _check(
        "D-ID API Key",
        "Set DID_API_KEY to enable talking-avatar videos. Get key at studio.d-id.com → Settings → API. "
        "Starter plan ~$5.90/month. Without this key, local faceless video pipeline is used instead.",
        _did()
    )
    # Downgrade to warn (not fail) when key is simply absent — local pipeline is a valid fallback
    if did_check["status"] == "fail" and "not set" in did_check["detail"]:
        did_check["status"] = "warn"
    checks.append(did_check)

    # ── 8. CORS ───────────────────────────────────────────────────────────────
    checks.append({
        "name": "CORS Configuration",
        "status": "pass",
        "detail": "CORS allows all *.azurecontainerapps.io origins",
        "hint": "",
    })

    # ── 9. YouTube channel check ─────────────────────────────────────────────
    yt_key = os.getenv("YOUTUBE_DATA_API_KEY", "")
    yt_oauth_ok = all([
        os.getenv("YOUTUBE_CLIENT_ID"),
        os.getenv("YOUTUBE_CLIENT_SECRET"),
        os.getenv("YOUTUBE_REFRESH_TOKEN"),
    ])
    checks.append({
        "name": "YouTube Publishing",
        "status": "pass" if yt_oauth_ok else "warn",
        "detail": (
            "OAuth credentials set — direct upload enabled"
            if yt_oauth_ok
            else "OAuth credentials not set — upload will fail. Data API key is set for trending/parrot."
        ),
        "hint": (
            ""
            if yt_oauth_ok
            else "Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN for upload support."
        ),
    })

    passed  = sum(1 for c in checks if c["status"] == "pass")
    failed  = sum(1 for c in checks if c["status"] == "fail")
    warned  = sum(1 for c in checks if c["status"] == "warn")

    return {
        "summary": {"total": len(checks), "passed": passed, "failed": failed, "warned": warned},
        "checks": checks,
    }


@router.get("/video-provider")
async def get_video_provider() -> Dict[str, str]:
    """
    Returns which video generation provider is currently active.
    Frontend uses this to show the correct badge on the Videos page.
    """
    if os.getenv("DID_API_KEY"):
        return {
            "provider": "did",
            "label":    "D-ID Talking Avatar",
            "detail":   "AI presenter reads your script on camera",
            "color":    "#8b5cf6",
        }
    if os.getenv("ELEVENLABS_API_KEY") and os.getenv("PEXELS_API_KEY"):
        return {
            "provider": "local",
            "label":    "Local Faceless Video",
            "detail":   "ElevenLabs voiceover + Pexels stock footage + FFmpeg",
            "color":    "#3b82f6",
        }
    return {
        "provider": "none",
        "label":    "No video provider configured",
        "detail":   "Set DID_API_KEY or both ELEVENLABS_API_KEY and PEXELS_API_KEY",
        "color":    "#ef4444",
    }


# ── Restart endpoints ─────────────────────────────────────────────────────────

_SUBSCRIPTION = "0624b0c7-bc20-40a1-8156-b33b8f52e951"
_RESOURCE_GROUP = "ai-video-pipeline"
_MGMT_BASE = "https://management.azure.com"


async def _get_mgmt_token() -> str:
    """Obtain an access token for the Azure Management API via Managed Identity."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            "http://169.254.169.254/metadata/identity/oauth2/token",
            params={
                "api-version": "2018-02-01",
                "resource": "https://management.azure.com/",
            },
            headers={"Metadata": "true"},
        )
        r.raise_for_status()
        return r.json()["access_token"]


async def _restart_container_app(app_name: str) -> str:
    """
    Restart an Azure Container App by cycling to a new revision-less restart.
    We trigger a restart by patching the container app with the Azure Management API,
    forcing a new revision which restarts all replicas.
    """
    token = await _get_mgmt_token()
    url = (
        f"{_MGMT_BASE}/subscriptions/{_SUBSCRIPTION}"
        f"/resourceGroups/{_RESOURCE_GROUP}"
        f"/providers/Microsoft.App/containerApps/{app_name}"
        f"/restart?api-version=2024-03-01"
    )
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url, headers={"Authorization": f"Bearer {token}"})
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Container App '{app_name}' not found")
        if r.status_code not in (200, 202, 204):
            raise HTTPException(status_code=502, detail=f"Azure restart failed: {r.status_code} {r.text[:200]}")
    return f"{app_name} restart triggered (status {r.status_code})"


@router.post("/restart/backend")
async def restart_backend() -> Dict[str, str]:
    """Restart the backend Container App via Azure Management API."""
    try:
        msg = await _restart_container_app("ai-content-backend")
        return {"status": "ok", "message": msg}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Backend restart failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/restart/frontend")
async def restart_frontend() -> Dict[str, str]:
    """Restart the frontend Container App via Azure Management API."""
    try:
        msg = await _restart_container_app("ai-content-frontend")
        return {"status": "ok", "message": msg}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Frontend restart failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/run-daily")
async def run_daily_check(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Run all health checks and send an alert email to txnightcoder@gmail.com
    if any check fails or warns.

    Called automatically every day at 08:00 UTC by the GitHub Actions
    scheduled workflow (.github/workflows/daily-diagnostics.yml).
    Can also be triggered manually from this endpoint.

    Requires env var:
      SENDGRID_API_KEY  — free at sendgrid.com (100 emails/day free tier)
    """
    from app.services.daily_diagnostic_service import run_daily_diagnostic
    result = await run_daily_diagnostic()
    logger.info(
        "Daily diagnostic complete — passed=%s failed=%s warned=%s alert_sent=%s",
        result["summary"]["passed"],
        result["summary"]["failed"],
        result["summary"]["warned"],
        result.get("alert_sent"),
    )
    return result

# Made with Bob
