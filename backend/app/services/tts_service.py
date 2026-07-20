"""
Text-to-Speech Service (Unified)
=================================
Multi-provider TTS with automatic fallback chain:

  1. ElevenLabs    — ultra-realistic voices, 17 options  (ELEVENLABS_API_KEY)
  2. Google Cloud TTS — natural Neural2 voices, free quota (GOOGLE_API_KEY)
  3. OpenAI TTS    — tts-1 model, "onyx" voice            (OPENAI_API_KEY)
  4. Silent MP3    — ffmpeg-generated silence so pipeline never hard-crashes

All methods return the ``output_path`` string on success.

Usage::

    svc = TTSService()
    await svc.speak("Hello world", "/tmp/voice.mp3")
    await svc.speak("Hello world", "/tmp/voice.mp3", voice_style="kids")
"""

import logging
import os
import shutil
import subprocess
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
_GOOGLE_TTS_URL  = "https://texttospeech.googleapis.com/v1/text:synthesize"
_OPENAI_TTS_URL  = "https://api.openai.com/v1/audio/speech"

# ElevenLabs voice presets by style
_ELEVEN_VOICES = {
    "default":    "21m00Tcm4TlvDq8ikWAM",   # Rachel — neutral female
    "kids":       "EXAVITQu4vr4xnSDxMaL",   # Bella  — soft, warm female
    "energetic":  "AZnzlk1XvdvUeBnXmlld",   # Domi   — energetic female
    "deep":       "29vD33N1CtxCmqQRPOHJ",   # Drew   — deep male
    "calm":       "GBv7mTt0atIp3Br8iCZE",   # Thomas — calm male
    "narrator":   "VR6AewLTigWG4xSOukaG",   # Arnold — strong narrator
}

# Google Neural2 voice presets by style
_GOOGLE_VOICES = {
    "default":   ("en-US-Neural2-D", "MALE"),
    "kids":      ("en-US-Neural2-F", "FEMALE"),   # softer female voice for kids content
    "energetic": ("en-US-Neural2-J", "MALE"),
    "deep":      ("en-US-Neural2-D", "MALE"),
    "calm":      ("en-US-Neural2-C", "FEMALE"),
    "narrator":  ("en-US-Neural2-D", "MALE"),
}


class TTSService:
    """
    Unified TTS: tries ElevenLabs → Google Cloud TTS → OpenAI TTS → silent placeholder.
    All providers produce an MP3 file at ``output_path``.
    """

    def __init__(
        self,
        elevenlabs_key: Optional[str] = None,
        google_key:     Optional[str] = None,
        openai_key:     Optional[str] = None,
        preferred_voice_id: Optional[str] = None,
    ):
        self._eleven_key    = elevenlabs_key    or os.getenv("ELEVENLABS_API_KEY", "")
        self._google_key    = google_key        or os.getenv("GOOGLE_API_KEY", "")
        self._openai_key    = openai_key        or os.getenv("OPENAI_API_KEY", "")
        self._voice_id_override = preferred_voice_id  # explicit ElevenLabs voice ID

    # ------------------------------------------------------------------
    async def speak(
        self,
        text: str,
        output_path: str,
        voice_style: str = "default",    # default | kids | energetic | deep | calm | narrator
    ) -> str:
        """
        Convert ``text`` to MP3 at ``output_path``.
        ``voice_style`` picks the best voice preset per provider.
        Returns ``output_path``.
        """
        # ── 1. ElevenLabs ────────────────────────────────────────────────────
        if self._eleven_key:
            try:
                voice_id = self._voice_id_override or _ELEVEN_VOICES.get(voice_style, _ELEVEN_VOICES["default"])
                await self._elevenlabs(text, output_path, voice_id)
                logger.info("TTSService: voiceover via ElevenLabs (%s) → %s", voice_style, output_path)
                return output_path
            except Exception as exc:
                logger.warning("TTSService: ElevenLabs failed (%s) — trying Google TTS", exc)

        # ── 2. Google Cloud TTS ───────────────────────────────────────────────
        if self._google_key:
            try:
                voice_name, gender = _GOOGLE_VOICES.get(voice_style, _GOOGLE_VOICES["default"])
                await self._google_tts(text, output_path, voice_name, gender)
                logger.info("TTSService: voiceover via Google TTS (%s) → %s", voice_style, output_path)
                return output_path
            except Exception as exc:
                logger.warning("TTSService: Google TTS failed (%s) — trying OpenAI TTS", exc)

        # ── 3. OpenAI TTS ─────────────────────────────────────────────────────
        if self._openai_key:
            try:
                await self._openai_tts(text, output_path)
                logger.info("TTSService: voiceover via OpenAI TTS → %s", output_path)
                return output_path
            except Exception as exc:
                logger.warning("TTSService: OpenAI TTS failed (%s) — using silent placeholder", exc)

        # ── 4. Silent placeholder ─────────────────────────────────────────────
        logger.error("TTSService: all TTS providers failed — writing silent placeholder")
        return self._silent_mp3(output_path)

    # ------------------------------------------------------------------
    async def _elevenlabs(self, text: str, output_path: str, voice_id: str) -> None:
        payload = {
            "text": text[:5000],
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True},
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{_ELEVENLABS_BASE}/text-to-speech/{voice_id}",
                json=payload,
                headers={"xi-api-key": self._eleven_key},
            )
            resp.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(resp.content)

    async def _google_tts(self, text: str, output_path: str, voice_name: str, gender: str) -> None:
        import base64 as _b64
        chunks = [text[i:i+4900] for i in range(0, len(text), 4900)]
        parts: list[bytes] = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for chunk in chunks:
                body = {
                    "input": {"text": chunk},
                    "voice": {"languageCode": "en-US", "name": voice_name, "ssmlGender": gender},
                    "audioConfig": {"audioEncoding": "MP3", "speakingRate": 1.05},
                }
                resp = await client.post(f"{_GOOGLE_TTS_URL}?key={self._google_key}", json=body)
                resp.raise_for_status()
                audio = resp.json().get("audioContent", "")
                if audio:
                    parts.append(_b64.b64decode(audio))
        with open(output_path, "wb") as f:
            for p in parts:
                f.write(p)

    async def _openai_tts(self, text: str, output_path: str) -> None:
        chunks = [text[i:i+4096] for i in range(0, len(text), 4096)]
        parts: list[bytes] = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for chunk in chunks:
                resp = await client.post(
                    _OPENAI_TTS_URL,
                    headers={"Authorization": f"Bearer {self._openai_key}"},
                    json={"model": "tts-1", "input": chunk, "voice": "onyx", "response_format": "mp3"},
                )
                resp.raise_for_status()
                parts.append(resp.content)
        with open(output_path, "wb") as f:
            for p in parts:
                f.write(p)

    def _silent_mp3(self, output_path: str) -> str:
        ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
        subprocess.run(
            [ffmpeg, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
             "-t", "30", "-q:a", "9", "-acodec", "libmp3lame", output_path],
            capture_output=True,
        )
        return output_path


# Made with Bob
