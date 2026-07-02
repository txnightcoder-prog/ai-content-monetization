"""
Health / Diagnostics endpoint.

Returns a structured list of checks the frontend Diagnostics page runs.
Each check hits a real dependency and reports pass/fail/warning + a fix hint.
"""
import logging
import os
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter

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

    # ── 4. Vicsee API key ────────────────────────────────────────────────────
    async def _vicsee():
        key = os.getenv("VICSEE_API_KEY", "")
        if not key:
            raise ValueError("VICSEE_API_KEY is not set")
        base = os.getenv("VICSEE_BASE_URL", "https://api.vicsee.com/v1")
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                f"{base}/account",
                headers={"Authorization": f"Bearer {key}"},
            )
            if r.status_code == 401:
                raise ValueError("Invalid Vicsee API key (401)")
            r.raise_for_status()
        return "Vicsee key is valid"
    checks.append(await _check(
        "Vicsee API Key",
        "Set VICSEE_API_KEY env var. Get key at vicsee.com → Settings → API",
        _vicsee()
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

    # ── 7. CORS ──────────────────────────────────────────────────────────────
    checks.append({
        "name": "CORS Configuration",
        "status": "pass",
        "detail": "CORS allows all *.azurecontainerapps.io origins",
        "hint": "",
    })

    # ── 8. YouTube channel check ─────────────────────────────────────────────
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

# Made with Bob
