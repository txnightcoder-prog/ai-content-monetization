"""
ElevenLabs Text-to-Speech Service
==================================
Converts script text to an MP3 voiceover file.

API docs: https://elevenlabs.io/docs/api-reference/text-to-speech
Sign up / get key: https://elevenlabs.io (free tier: 10,000 chars/mo)

Required env vars:
  ELEVENLABS_API_KEY   — your ElevenLabs API key
  ELEVENLABS_VOICE_ID  — (optional) voice ID, defaults to Rachel (neutral English)
"""

import os
from typing import Optional

import httpx

# Rachel — neutral, clear English voice available on all plans
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
ELEVENLABS_BASE  = "https://api.elevenlabs.io/v1"


class ElevenLabsService:
    """Convert text to an MP3 audio file using ElevenLabs TTS."""

    def __init__(self, api_key: Optional[str] = None, voice_id: Optional[str] = None):
        self.api_key  = api_key  or os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID)

        if not self.api_key:
            raise ValueError(
                "ElevenLabs API key not set. "
                "Add ELEVENLABS_API_KEY to your .env file. "
                "Get a free key at elevenlabs.io."
            )

    # ------------------------------------------------------------------
    async def text_to_speech(self, text: str, output_path: str) -> str:
        """
        Convert ``text`` to speech and save as MP3 at ``output_path``.

        Returns ``output_path`` on success.
        Raises httpx.HTTPStatusError on API errors.
        """
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{ELEVENLABS_BASE}/text-to-speech/{self.voice_id}",
                json=payload,
                headers={
                    "xi-api-key": self.api_key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
            )
            if r.status_code == 401:
                raise ValueError("Invalid ElevenLabs API key (401).")
            r.raise_for_status()

            with open(output_path, "wb") as f:
                f.write(r.content)

        return output_path

    # ------------------------------------------------------------------
    async def get_account_info(self) -> dict:
        """Return subscription info — used by the health check."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{ELEVENLABS_BASE}/user/subscription",
                headers={"xi-api-key": self.api_key},
            )
            if r.status_code == 401:
                raise ValueError("Invalid ElevenLabs API key (401).")
            r.raise_for_status()
            return r.json()
