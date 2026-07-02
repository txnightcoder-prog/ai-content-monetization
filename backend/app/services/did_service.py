"""
D-ID Talking Avatar Video Service
===================================
Generates a presenter-style video from a script using the D-ID API.

D-ID creates an AI talking-head video with a photorealistic presenter
reading the script aloud — ideal for YouTube face-cam style content.

API docs : https://docs.d-id.com/reference/createtalk
Pricing  : ~$5.90/month for 10 minutes of video credit (starter plan)
Sign up  : https://studio.d-id.com

Required env var:
  DID_API_KEY  — Basic auth key from D-ID dashboard (Settings → API)

Optional env vars:
  DID_PRESENTER_ID    — D-ID presenter image URL or ID (defaults to a neutral avatar)
  DID_VOICE_ID        — Microsoft Azure voice for TTS (default: en-US-JennyNeural)
"""

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

DID_BASE         = "https://api.d-id.com"
# Default neutral female presenter included in every D-ID account
DEFAULT_PRESENTER = "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg"
DEFAULT_VOICE     = "en-US-JennyNeural"


class DIDService:
    """
    Generate a talking-avatar video via D-ID's /talks endpoint.

    Workflow:
      1. POST /talks              — submit script → returns talk_id
      2. Poll GET /talks/{id}     — wait until status == "done"
      3. Return result_url        — direct MP4 download link
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key       = api_key or os.getenv("DID_API_KEY", "")
        self.presenter_url = os.getenv("DID_PRESENTER_ID", DEFAULT_PRESENTER)
        self.voice_id      = os.getenv("DID_VOICE_ID", DEFAULT_VOICE)

        if not self.api_key:
            raise ValueError(
                "DID_API_KEY is not set. "
                "Get your API key at studio.d-id.com → Settings → API. "
                "Starter plan is ~$5.90/month for 10 minutes of video."
            )

    # ── Auth helper ────────────────────────────────────────────────────────────

    def _headers(self) -> Dict[str, str]:
        import base64
        # D-ID uses HTTP Basic auth: base64(api_key:)
        token = base64.b64encode(f"{self.api_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {token}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }

    # ── Core methods ───────────────────────────────────────────────────────────

    async def create_talk(self, script: str) -> str:
        """
        Submit a script to D-ID and return the talk_id.
        Raises on API error.
        """
        payload = {
            "source_url": self.presenter_url,
            "script": {
                "type":          "text",
                "input":         script[:2000],   # D-ID max per talk
                "provider": {
                    "type":      "microsoft",
                    "voice_id":  self.voice_id,
                },
            },
            "config": {
                "fluent":        True,
                "pad_audio":     0.0,
                "stitch":        True,
            },
        }

        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{DID_BASE}/talks", json=payload, headers=self._headers())
            if r.status_code == 401:
                raise ValueError("Invalid D-ID API key (401). Check DID_API_KEY env var.")
            if r.status_code == 402:
                raise ValueError("D-ID account out of credits. Upgrade at studio.d-id.com.")
            r.raise_for_status()
            data = r.json()

        talk_id = data.get("id")
        if not talk_id:
            raise RuntimeError(f"D-ID returned no talk ID. Response: {data}")
        logger.info("D-ID talk created: %s", talk_id)
        return talk_id

    async def get_talk(self, talk_id: str) -> Dict[str, Any]:
        """Poll a single talk status. Returns the full D-ID response dict."""
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{DID_BASE}/talks/{talk_id}", headers=self._headers())
            r.raise_for_status()
            return r.json()

    async def wait_for_completion(
        self,
        talk_id: str,
        poll_interval: int = 8,
        max_attempts: int = 60,       # 60 × 8s = 8 minutes max
    ) -> Dict[str, Any]:
        """
        Poll until the talk is done or failed.
        Returns dict with keys: video_url, thumbnail_url, duration, status.
        """
        import asyncio

        for attempt in range(max_attempts):
            data = await self.get_talk(talk_id)
            status = data.get("status", "")
            logger.debug("D-ID talk %s status=%s (attempt %d)", talk_id, status, attempt + 1)

            if status == "done":
                return {
                    "video_url":     data.get("result_url"),
                    "thumbnail_url": data.get("thumbnail_url"),
                    "duration":      data.get("duration"),
                    "status":        "completed",
                }
            if status == "error":
                raise RuntimeError(
                    f"D-ID talk {talk_id} failed: {data.get('error', {}).get('description', 'unknown error')}"
                )

            await asyncio.sleep(poll_interval)

        raise TimeoutError(f"D-ID talk {talk_id} did not complete within {max_attempts * poll_interval}s")

# Made with Bob
