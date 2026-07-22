"""
Gemini AI Service
=================
Drop-in replacement for OpenAIService using Google Gemini 2.0 Flash.
Uses the same GOOGLE_API_KEY already set for Veo video generation.

Model: gemini-2.0-flash  — fast, cheap, excellent for scripts & content
       gemini-1.5-pro     — higher quality, slower

Required env vars:
    GOOGLE_API_KEY  — same key used for Veo video generation

Endpoint: https://generativelanguage.googleapis.com/v1beta/models/...
"""

import asyncio
import os
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

GEMINI_BASE   = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.0-flash"


class GeminiService:
    """
    Generate text completions using Google Gemini 2.0 Flash.
    Same interface as OpenAIService so it can be swapped in transparently.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY", "")
        self.model   = model   or os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

        if not self.api_key:
            raise ValueError(
                "GOOGLE_API_KEY not set. "
                "Get one free at https://aistudio.google.com/app/apikey"
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
        Generate a text completion via Gemini REST API.
        Returns the generated text as a plain string.
        """
        use_model = model or self.model

        # Build the contents list
        contents = []
        if system_message:
            # Gemini uses a system_instruction field, not a message role
            pass  # handled below

        contents.append({
            "role": "user",
            "parts": [{"text": prompt}],
        })

        body: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "topP": 0.95,
            },
        }

        if system_message:
            body["system_instruction"] = {
                "parts": [{"text": system_message}]
            }

        url = f"{GEMINI_BASE}/models/{use_model}:generateContent?key={self.api_key}"

        # Retry up to 3 times on 429 with exponential backoff (5s, 15s, 30s)
        delays = [5, 15, 30]
        async with httpx.AsyncClient(timeout=120.0) as client:
            for attempt, delay in enumerate(delays, 1):
                resp = await client.post(url, json=body)
                if resp.status_code == 401:
                    raise ValueError("Invalid GOOGLE_API_KEY (401). Check your key at aistudio.google.com.")
                if resp.status_code == 429:
                    if attempt == len(delays):
                        raise RuntimeError(
                            "Gemini rate limit hit — all retries exhausted. "
                            "Wait a minute and try again, or add a paid Gemini key."
                        )
                    logger.warning("Gemini 429 on attempt %d — retrying in %ds", attempt, delay)
                    await asyncio.sleep(delay)
                    continue
                if resp.status_code != 200:
                    raise RuntimeError(
                        f"Gemini API error {resp.status_code}: {resp.text[:300]}"
                    )
                break  # success

        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError) as exc:
            raise RuntimeError(f"Unexpected Gemini response shape: {data}") from exc

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
        Uses the same GOOGLE_API_KEY — no extra billing setup needed.
        Returns output_path on success.
        """
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.api_key}"

        # Split into 5000-char chunks (Cloud TTS limit per request)
        chunks = [text[i:i+4900] for i in range(0, len(text), 4900)]
        audio_parts: list[bytes] = []

        async with httpx.AsyncClient(timeout=60.0) as client:
            for chunk in chunks:
                body = {
                    "input": {"text": chunk},
                    "voice": {
                        "languageCode": "en-US",
                        "name": "en-US-Neural2-D",       # natural male voice
                        "ssmlGender": "MALE",
                    },
                    "audioConfig": {
                        "audioEncoding": "MP3",
                        "speakingRate": 1.05,
                        "pitch": 0.0,
                    },
                }
                resp = await client.post(url, json=body)
                if resp.status_code == 400 and "API_KEY" in resp.text:
                    # Cloud TTS may need to be enabled — fall back to silent placeholder
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
