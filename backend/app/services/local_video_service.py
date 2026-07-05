"""
Local Video Generation Service
================================
Orchestrates ElevenLabs TTS + Pexels stock clips + FFmpeg assembly
into a single faceless MP4, with optional Whisper timed captions.

Cost: ~$0.002/video (ElevenLabs) + Pexels (free) + FFmpeg (free)
      + ~$0.006/min audio for Whisper captions (optional, uses OPENAI_API_KEY)
"""

import asyncio
import logging
import os
import re
import subprocess
from typing import Any, Dict, Optional
from uuid import uuid4

from app.services.elevenlabs_service import ElevenLabsService
from app.services.pexels_service import PexelsService
from app.services.video_assembler import VideoAssembler, _get_ffmpeg
from app.services.whisper_captions import add_timed_captions

logger = logging.getLogger(__name__)

VIDEO_OUTPUT_DIR = os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos")


def _extract_keywords(script: str) -> str:
    for line in script.split("\n"):
        line = line.strip()
        if len(line) > 10:
            words = re.sub(r"[^\w\s]", "", line).split()[:5]
            return " ".join(words)
    return "technology business"


def _probe_duration(mp4_path: str) -> Optional[int]:
    try:
        result = subprocess.run([_get_ffmpeg(), "-i", mp4_path],
                                capture_output=True, text=True)
        for line in result.stderr.splitlines():
            if "Duration:" in line:
                dur_str = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = dur_str.split(":")
                return int(int(h) * 3600 + int(m) * 60 + float(s))
    except Exception as exc:
        logger.warning("Could not probe duration for %s: %s", mp4_path, exc)
    return None


def _extract_thumbnail(mp4_path: str, thumb_path: str) -> bool:
    try:
        result = subprocess.run(
            [_get_ffmpeg(), "-y", "-ss", "1", "-i", mp4_path,
             "-vframes", "1", "-q:v", "2", thumb_path],
            capture_output=True,
        )
        return result.returncode == 0 and os.path.exists(thumb_path)
    except Exception as exc:
        logger.warning("Thumbnail extraction failed for %s: %s", mp4_path, exc)
        return False


class LocalVideoService:
    """
    Generates faceless videos locally:
      script → ElevenLabs MP3 → Pexels clips → FFmpeg MP4 → Whisper captions
    """

    def __init__(
        self,
        elevenlabs: Optional[ElevenLabsService] = None,
        pexels: Optional[PexelsService] = None,
        assembler: Optional[VideoAssembler] = None,
        timed_captions: bool = True,
    ):
        self._tts = elevenlabs or ElevenLabsService()
        self._pexels = pexels or PexelsService()
        self._assembler = assembler or VideoAssembler()
        self._timed_captions = timed_captions
        os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True)

    # ------------------------------------------------------------------
    async def create_video(
        self,
        script: str,
        aspect_ratio: str = "9:16",
        caption_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        job_id = str(uuid4())
        return {"video_id": job_id, "status": "processing"}

    # ------------------------------------------------------------------
    async def wait_for_completion(
        self,
        video_id: str,
        script: str = "",
        caption_text: Optional[str] = None,
        max_wait_seconds: int = 600,
    ) -> Dict[str, Any]:
        output_path      = os.path.join(VIDEO_OUTPUT_DIR, f"{video_id}.mp4")
        raw_output_path  = os.path.join(VIDEO_OUTPUT_DIR, f"{video_id}_raw.mp4")
        voice_path       = os.path.join(VIDEO_OUTPUT_DIR, f"{video_id}_voice.mp3")
        thumb_path       = os.path.join(VIDEO_OUTPUT_DIR, f"{video_id}_thumb.jpg")

        try:
            # 1. ElevenLabs voiceover
            logger.info("LocalVideoService: generating voiceover for job %s", video_id)
            await self._tts.text_to_speech(text=script, output_path=voice_path)

            # 2. Pexels clips
            keywords = _extract_keywords(script)
            logger.info("LocalVideoService: fetching Pexels clips for '%s'", keywords)
            clip_urls = await self._pexels.search_clips(query=keywords, count=6)
            if not clip_urls:
                raise RuntimeError(f"Pexels returned no clips for query '{keywords}'")

            # 3. FFmpeg assembly (raw — no captions yet)
            logger.info("LocalVideoService: assembling video for job %s", video_id)
            asm_target = raw_output_path if self._timed_captions else output_path
            await asyncio.to_thread(
                self._assemble_sync,
                clip_urls,
                voice_path,
                asm_target,
                caption_text or script[:100],
            )

            # 4. Whisper timed captions (burns SRT into video)
            if self._timed_captions:
                logger.info("LocalVideoService: adding timed captions for job %s", video_id)
                # Voice MP3 is still on disk here — used for transcription
                await add_timed_captions(
                    video_path=asm_target,
                    audio_path=voice_path,
                    output_path=output_path,
                    words_per_line=4,
                )
                # Remove the intermediate raw file
                if os.path.exists(raw_output_path):
                    try:
                        os.unlink(raw_output_path)
                    except OSError:
                        pass
            else:
                logger.info("LocalVideoService: timed captions disabled for job %s", video_id)

            # 5. Thumbnail
            thumbnail_url: Optional[str] = None
            if _extract_thumbnail(output_path, thumb_path):
                thumbnail_url = thumb_path

            # 6. Duration
            duration = _probe_duration(output_path)

            return {
                "video_id":       video_id,
                "status":         "completed",
                "video_url":      output_path,
                "thumbnail_url":  thumbnail_url,
                "duration":       duration,
                "timed_captions": self._timed_captions,
                "error":          None,
            }

        except Exception as exc:
            logger.error("LocalVideoService failed for job %s: %s", video_id, exc)
            return {
                "video_id":       video_id,
                "status":         "failed",
                "video_url":      None,
                "thumbnail_url":  None,
                "duration":       None,
                "timed_captions": False,
                "error":          str(exc),
            }

        finally:
            # Always clean up voice MP3
            if os.path.exists(voice_path):
                try:
                    os.unlink(voice_path)
                except OSError:
                    pass

    def _assemble_sync(self, clip_urls: list, voice_path: str,
                       output_path: str, caption: str) -> None:
        asyncio.run(
            self._assembler.assemble(
                clip_urls=clip_urls,
                voice_mp3_path=voice_path,
                output_path=output_path,
                caption_text=caption,
            )
        )

    async def get_account_info(self) -> Dict[str, Any]:
        el_info = await self._tts.get_account_info()
        return {"elevenlabs": el_info, "pexels": "key configured"}
