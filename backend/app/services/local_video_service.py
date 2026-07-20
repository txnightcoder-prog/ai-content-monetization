"""
Local Video Generation Service
================================
Orchestrates multi-source TTS + multi-source clips + FFmpeg assembly
into a single faceless MP4, with optional Whisper timed captions.

Provider chains (via TTSService / ClipService):
  Voiceover : ElevenLabs → Google Cloud TTS → OpenAI TTS
  Clips     : Veo 3 → Kling → Pexels → Pixabay

Cost: ~$0.002/video (ElevenLabs) + Pexels (free) + FFmpeg (free)
      + ~$0.006/min audio for Whisper captions (optional, uses OPENAI_API_KEY)
"""

import asyncio
import logging
import os
import re
import subprocess
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.tts_service import TTSService
from app.services.clip_service import ClipService
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
    Generates faceless videos:
      script → TTSService MP3 → ClipService clips → FFmpeg MP4 → Whisper captions

    TTSService:  ElevenLabs → Google TTS → OpenAI TTS (auto-fallback)
    ClipService: Veo 3 → Kling → Pexels → Pixabay    (auto-fallback)
    """

    def __init__(
        self,
        elevenlabs=None,          # kept for backwards compat — passed to TTSService if provided
        pexels=None,              # kept for backwards compat — ignored, ClipService handles it
        assembler: Optional[VideoAssembler] = None,
        timed_captions: bool = True,
        tts_service: Optional[TTSService] = None,
        clip_service: Optional[ClipService] = None,
    ):
        # TTSService wraps ElevenLabs + Google TTS + OpenAI TTS
        self._tts = tts_service or TTSService(
            elevenlabs_key=getattr(elevenlabs, "api_key", None) if elevenlabs else None,
        )
        self._clips = clip_service or ClipService()
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
            # 1. Voiceover via TTSService (ElevenLabs → Google TTS → OpenAI TTS)
            logger.info("LocalVideoService: generating voiceover for job %s", video_id)
            await self._tts.speak(text=script, output_path=voice_path, voice_style="default")

            # 2. Video clips via ClipService (Veo 3 → Kling → Pexels → Pixabay)
            keywords = _extract_keywords(script)
            logger.info("LocalVideoService: fetching clips for '%s'", keywords)
            clip_paths = await self._clips.get_clips(prompt=keywords, count=6, aspect_ratio="9:16")
            if not clip_paths:
                raise RuntimeError(f"All clip providers returned no clips for query '{keywords}'")

            # 3. FFmpeg assembly (raw — no captions yet)
            # ClipService returns local paths, not URLs — pass them as "urls" (assembler handles both)
            logger.info("LocalVideoService: assembling video for job %s", video_id)
            asm_target = raw_output_path if self._timed_captions else output_path
            await asyncio.to_thread(
                self._assemble_sync,
                clip_paths,
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
        providers = {
            "tts":  {
                "elevenlabs": "configured" if os.getenv("ELEVENLABS_API_KEY") else "not set",
                "google_tts": "configured" if os.getenv("GOOGLE_API_KEY") else "not set",
                "openai_tts": "configured" if os.getenv("OPENAI_API_KEY") else "not set",
            },
            "clips": {
                "veo":     "configured" if os.getenv("GOOGLE_API_KEY") else "not set",
                "kling":   "configured" if os.getenv("FAL_API_KEY") else "not set",
                "pexels":  "configured" if os.getenv("PEXELS_API_KEY") else "not set",
                "pixabay": "configured" if os.getenv("PIXABAY_API_KEY") else "not set",
            },
        }
        return providers
