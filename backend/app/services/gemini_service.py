"""
Gemini AI Service
=================
Drop-in replacement for OpenAIService using Google Gemini via the Interactions API.
New Google Cloud projects (created after mid-2026) only support the Interactions API;
the legacy generateContent endpoint returns 404 for new projects.

Auth keys (AQ.Ab8...) use ?key= query param — NOT a Bearer header.

Required env vars:
    GOOGLE_API_KEY  — auth key from aistudio.google.com/apikey
    GEMINI_MODEL    — optional override (default: gemini-3.1-flash-lite)

Endpoint: https://generativelanguage.googleapis.com/v1beta/interactions
"""

import asyncio
import os
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

INTERACTIONS_BASE = "https://generativelanguage.googleapis.com/v1beta/interactions"
DEFAULT_MODEL     = "gemini-3.1-flash-lite"


class GeminiService:
    """
    Generate text completions using Google Gemini via the Interactions API.
    Same interface as OpenAIService so it can be swapped in transparently.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY", "")
        self.model   = model   or os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

        if not self.api_key:
            raise ValueError(
                "GOOGLE_API_KEY not set. "
                "Get one at https://aistudio.google.com/apikey"
            )

    # ------------------------------------------------------------------
    async def generate_completion(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        model: Optional[str] = None,
    ) -> str:
        """
        Generate a text completion via Gemini Interactions API.
        Returns the generated text as a plain string.
        """
        use_model = model or self.model

        # Build full prompt — Interactions API uses a single "input" string,
        # so we prepend the system message as an instruction block.
        if system_message:
            full_input = f"{system_message}\n\n{prompt}"
        else:
            full_input = prompt

        body: dict = {
            "model": f"models/{use_model}",
            "input": full_input,
        }

        url = f"{INTERACTIONS_BASE}?key={self.api_key}"

        # Retry up to 3 times on 429 / transient errors with exponential backoff
        delays = [5, 15, 30]
        last_exc: Exception = RuntimeError("No attempts made")
        async with httpx.AsyncClient(timeout=120.0) as client:
            for attempt, delay in enumerate(delays, 1):
                resp = await client.post(url, json=body)

                if resp.status_code == 401:
                    raise ValueError(
                        "Invalid GOOGLE_API_KEY (401). Check your key at aistudio.google.com."
                    )

                if resp.status_code == 429:
                    if attempt == len(delays):
                        raise RuntimeError(
                            "Gemini rate limit hit — all retries exhausted. "
                            "Wait a minute and try again."
                        )
                    logger.warning("Gemini 429 on attempt %d — retrying in %ds", attempt, delay)
                    await asyncio.sleep(delay)
                    continue

                if resp.status_code != 200:
                    data = resp.json()
                    msg = data.get("error", {}).get("message", resp.text[:300])
                    # Transient server errors — retry
                    if resp.status_code >= 500 or "high demand" in msg:
                        if attempt < len(delays):
                            logger.warning("Gemini %d on attempt %d — retrying in %ds: %s",
                                           resp.status_code, attempt, delay, msg)
                            await asyncio.sleep(delay)
                            continue
                    raise RuntimeError(f"Gemini API error {resp.status_code}: {msg}")

                break  # success

        data = resp.json()

        # Extract text from the Interactions API response:
        # { "steps": [ {"type":"thought",...}, {"type":"model_output","content":[{"text":"..."}]} ] }
        try:
            steps = data.get("steps", [])
            for step in steps:
                if step.get("type") == "model_output":
                    content = step.get("content", [])
                    for part in content:
                        if part.get("type") == "text" and part.get("text"):
                            return part["text"].strip()
        except Exception:
            pass

        raise RuntimeError(f"Unexpected Gemini response shape: {data}")

    # ------------------------------------------------------------------
    async def generate_topics(self, niche: str, count: int = 5) -> list[str]:
        """Generate video topic ideas — same interface as OpenAIService."""
        system_message = (
            "You are a viral content strategist specializing in short-form video content. "
            "Generate engaging, attention-grabbing video topics that perform well on "
            "TikTok, Instagram Reels, and YouTube Shorts."
        )
        prompt = (
            f"Generate {count} viral video topic ideas for the '{niche}' niche. "
            "Each topic should be attention-grabbing, suitable for 30-60 second videos, "
            "and have a clear value proposition. Use numbers or specific claims when possible.\n\n"
            "Return only the topics, one per line, without numbering or bullet points."
        )
        response = await self.generate_completion(
            prompt=prompt,
            system_message=system_message,
            temperature=0.85,
            max_tokens=400,
        )
        topics = [line.strip() for line in response.split("\n") if line.strip()]
        return topics[:count]

    # ------------------------------------------------------------------
    async def text_to_speech(self, text: str, output_path: str) -> str:
        """
        Generate voiceover MP3 using Google Cloud TTS REST API.
        Uses the same GOOGLE_API_KEY.
        Returns output_path on success.
        """
        tts_url     = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.api_key}"
        tts_headers = {"Content-Type": "application/json"}

        # Split into 4900-char chunks (Cloud TTS limit per request)
        chunks = [text[i:i+4900] for i in range(0, len(text), 4900)]
        audio_parts: list[bytes] = []

        async with httpx.AsyncClient(timeout=60.0) as client:
            for chunk in chunks:
                body = {
                    "input": {"text": chunk},
                    "voice": {
                        "languageCode": "en-US",
                        "name": "en-US-Neural2-D",
                        "ssmlGender": "MALE",
                    },
                    "audioConfig": {
                        "audioEncoding": "MP3",
                        "speakingRate": 1.05,
                        "pitch": 0.0,
                    },
                }
                resp = await client.post(tts_url, json=body, headers=tts_headers)
                if resp.status_code in (400, 403) and ("API_KEY" in resp.text or "disabled" in resp.text.lower()):
                    logger.warning("GeminiService TTS: Cloud TTS not enabled for this key — creating silent placeholder")
                    return self._silent_mp3(output_path)
                resp.raise_for_status()
                import base64
                audio_content = resp.json().get("audioContent", "")
                if audio_content:
                    audio_parts.append(base64.b64decode(audio_content))

        if not audio_parts:
            return self._silent_mp3(output_path)

        with open(output_path, "wb") as f:
            for part in audio_parts:
                f.write(part)

        logger.info("GeminiService TTS: voiceover written → %s", output_path)
        return output_path

    def _silent_mp3(self, output_path: str) -> str:
        """Write a minimal valid silent MP3 so FFmpeg doesn't crash."""
        import subprocess, shutil
        ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
        subprocess.run(
            [ffmpeg, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
             "-t", "30", "-q:a", "9", "-acodec", "libmp3lame", output_path],
            capture_output=True,
        )
        return output_path

    # ------------------------------------------------------------------
    async def get_account_info(self) -> dict:
        """Health check — confirm key works."""
        try:
            result = await self.generate_completion("Say 'ok' in one word.", max_tokens=5)
            return {"gemini": f"OK — model={self.model}", "response": result}
        except Exception as exc:
            return {"gemini": f"Error: {exc}"}

# Made with Bob
