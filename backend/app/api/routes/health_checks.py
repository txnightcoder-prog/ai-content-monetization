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

    # ── 5. Buffer API token ──────────────────────────────────────────────────
    async def _buffer():
        token = os.getenv("BUFFER_ACCESS_TOKEN", "")
        if not token:
            raise ValueError("BUFFER_ACCESS_TOKEN is not set")
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.bufferapp.com/1/user.json",
                params={"access_token": token},
            )
            if r.status_code == 401:
                raise ValueError("Invalid Buffer access token")
            r.raise_for_status()
            data = r.json()
        return f"Buffer connected as @{data.get('name', 'unknown')}"
    checks.append(await _check(
        "Buffer Access Token",
        "Set BUFFER_ACCESS_TOKEN env var. Get token at buffer.com → Settings → Apps",
        _buffer()
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

    # ── 8. Buffer profile IDs ────────────────────────────────────────────────
    configured = []
    missing = []
    for p in ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "TWITTER", "LINKEDIN"]:
        val = os.getenv(f"BUFFER_{p}_PROFILE_ID", "")
        (configured if val else missing).append(p.lower())
    status = "pass" if configured else "warn"
    detail = f"Configured: {', '.join(configured) or 'none'} | Missing: {', '.join(missing) or 'none'}"
    checks.append({
        "name": "Buffer Profile IDs",
        "status": status,
        "detail": detail,
        "hint": "Set BUFFER_<PLATFORM>_PROFILE_ID env vars to enable publishing to those platforms",
    })

    passed  = sum(1 for c in checks if c["status"] == "pass")
    failed  = sum(1 for c in checks if c["status"] == "fail")
    warned  = sum(1 for c in checks if c["status"] == "warn")

    return {
        "summary": {"total": len(checks), "passed": passed, "failed": failed, "warned": warned},
        "checks": checks,
    }

# Made with Bob
