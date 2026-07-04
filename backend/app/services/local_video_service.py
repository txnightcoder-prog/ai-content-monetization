"""
Local Video Generation Service
================================
Orchestrates ElevenLabs TTS + Pexels stock clips + FFmpeg assembly
into a single faceless MP4 — no per-video API cost.

Cost: ~$0.002/video (ElevenLabs chars) + Pexels (free) + FFmpeg (free)

This replaces the previous Pictory service.
"""

import asyncio
import logging
import os
import re
import tempfile
from typing import Any, Dict, Optional
from uuid import uuid4

from app.services.elevenlabs_service import ElevenLabsService
from app.services.pexels_service import PexelsService
from app.services.video_assembler import VideoAssembler

logger = logging.getLogger(__name__)

# Where finished videos are stored locally before YouTube upload
VIDEO_OUTPUT_DIR = os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos")


def _extract_keywords(script: str) -> str:
    """Pull a short search query from the script for Pexels."""
    # Use the first non-empty line (usually the hook) stripped of punctuation
    for line in script.split("\n"):
        line = line.strip()
        if len(line) > 10:
            # Keep only the first 5 words, strip punctuation
            words = re.sub(r"[^\w\s]", "", line).split()[:5]
            return " ".join(words)
    return "technology business"


class LocalVideoService:
    """
    Generates faceless videos locally:
      script → ElevenLabs MP3 → Pexels clips → FFmpeg MP4

    Exposes the same interface as the previous Pictory/Vicsee services
    so video_pipeline.py needs minimal changes.
    """

    def __init__(
        self,
        elevenlabs: Optional[ElevenLabsService] = None,
        pexels: Optional[PexelsService] = None,
        assembler: Optional[VideoAssembler] = None,
    ):
        self._tts = elevenlabs or ElevenLabsService()
        self._pexels = pexels or PexelsService()
        self._assembler = assembler or VideoAssembler()
        os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True)

    # ------------------------------------------------------------------
    async def create_video(
        self,
        script: str,
        aspect_ratio: str = "9:16",   # kept for interface compatibility
        caption_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a video from a script.

        Returns immediately with a ``video_id`` (local job token) and
        ``status = "processing"``.  The caller should then call
        ``wait_for_completion()`` which does the actual work synchronously
        (FFmpeg runs in a thread so it doesn't block the event loop).
        """
        job_id = str(uuid4())
        return {
            "video_id": job_id,
            "status": "processing",
            "_script": script,
            "_caption": caption_text,
        }

    # ------------------------------------------------------------------
    async def wait_for_completion(
        self,
        video_id: str,
        script: str = "",
        caption_text: Optional[str] = None,
        max_wait_seconds: int = 600,
    ) -> Dict[str, Any]:
        """
        Run the full pipeline and return the finished video details.

        Because FFmpeg is CPU-bound, the subprocess calls run in a thread
        pool via ``asyncio.to_thread`` to avoid blocking the event loop.
        """
        output_path = os.path.join(VIDEO_OUTPUT_DIR, f"{video_id}.mp4")

        try:
            # 1. ElevenLabs — generate voiceover
            voice_path = os.path.join(VIDEO_OUTPUT_DIR, f"{video_id}_voice.mp3")
            logger.info("LocalVideoService: generating voiceover for job %s", video_id)
            await self._tts.text_to_speech(text=script, output_path=voice_path)

            # 2. Pexels — fetch stock clips based on script keywords
            keywords = _extract_keywords(script)
            logger.info("LocalVideoService: fetching Pexels clips for '%s'", keywords)
            clip_urls = await self._pexels.search_clips(query=keywords, count=6)
            if not clip_urls:
                raise RuntimeError(f"Pexels returned no clips for query '{keywords}'")

            # 3. FFmpeg assembly — runs in thread pool
            logger.info("LocalVideoService: assembling video for job %s", video_id)
            await asyncio.to_thread(
                self._assemble_sync,
                clip_urls,
                voice_path,
                output_path,
                caption_text or script[:100],
            )

            return {
                "video_id": video_id,
                "status": "completed",
                "video_url": output_path,   # local path; pipeline uploads to YouTube
                "thumbnail_url": None,
                "duration": None,
                "error": None,
            }

        except Exception as exc:
            logger.error("LocalVideoService failed for job %s: %s", video_id, exc)
            return {
                "video_id": video_id,
                "status": "failed",
                "video_url": None,
                "thumbnail_url": None,
                "duration": None,
                "error": str(exc),
            }

    def _assemble_sync(
        self,
        clip_urls: list,
        voice_path: str,
        output_path: str,
        caption: str,
    ) -> None:
        """Synchronous wrapper called from asyncio.to_thread.

        Creates a fresh event loop for this thread — avoids the
        'cannot run nested event loop' error when called via asyncio.to_thread.
        """
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                self._assembler.assemble(
                    clip_urls=clip_urls,
                    voice_mp3_path=voice_path,
                    output_path=output_path,
                    caption_text=caption,
                )
            )
        finally:
            loop.close()

    # ------------------------------------------------------------------
    async def get_account_info(self) -> Dict[str, Any]:
        """Health check — verify both upstream services."""
        el_info = await self._tts.get_account_info()
        return {
            "elevenlabs": el_info,
            "pexels": "key configured",
        }
