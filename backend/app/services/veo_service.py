"""
Veo Video Generation Service (Google DeepMind Veo 3)
=====================================================
Generates AI video clips from text prompts using the Google Gen AI SDK.

Model:  veo-3.1-fast-generate-preview  (fast, cost-effective)
        veo-3.0-generate-preview        (highest quality, slower)

Required env vars:
    GOOGLE_API_KEY  — get one at aistudio.google.com

Cost (approximate at preview pricing):
    veo-3.1-fast:  ~$0.35 / second of generated video
    veo-3.0:       ~$0.70 / second of generated video

A 30-second script typically generates 3–5 clips of 5–8 seconds each,
costing roughly $0.50–$1.40 per video depending on model.

Flow:
    1. Split script into scene prompts (hook → main value → CTA)
    2. Call Veo for each scene concurrently
    3. Poll until each operation is done
    4. Save each clip to disk
    5. Return list of local file paths — VideoAssembler handles the rest
"""

import asyncio
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

VEO_FAST_MODEL  = "veo-3.1-fast-generate-preview"
VEO_QUALITY_MODEL = "veo-3.0-generate-preview"

# Seconds to wait between poll attempts
_POLL_INTERVAL = 5
# Maximum total wait time per clip (Veo can take 60–120 s)
_MAX_WAIT = 300


def _split_into_scenes(script: str, max_scenes: int = 4) -> List[str]:
    """
    Split the script text into short scene prompts for Veo.
    Each prompt should describe visuals, not narration text.
    """
    lines = [l.strip() for l in script.splitlines() if l.strip()]

    # Chunk into up to max_scenes segments
    if len(lines) <= max_scenes:
        return lines[:max_scenes] or [script[:300]]

    chunk_size = max(1, len(lines) // max_scenes)
    scenes = []
    for i in range(0, len(lines), chunk_size):
        chunk = " ".join(lines[i : i + chunk_size])
        scenes.append(chunk[:300])
        if len(scenes) >= max_scenes:
            break
    return scenes


def _build_visual_prompt(scene_text: str, niche: str = "technology") -> str:
    """
    Convert script narration text into a cinematic visual prompt.
    Veo works best with descriptive visual language, not spoken narration.
    """
    return (
        f"Cinematic vertical 9:16 video. {niche} theme. "
        f"No text overlays. Professional footage. "
        f"Scene: {scene_text[:200]}"
    )


class VeoVideoService:
    """
    Generates AI video clips via Google Veo and assembles them into a final MP4.

    Exposes the same interface as LocalVideoService so video_pipeline.py
    only needs a provider-selection check to switch between them.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = VEO_FAST_MODEL,
        video_output_dir: Optional[str] = None,
    ):
        self._api_key   = api_key or os.getenv("GOOGLE_API_KEY", "")
        self._model     = model
        self._output_dir = video_output_dir or os.getenv("VIDEO_OUTPUT_DIR", "/tmp/videos")
        os.makedirs(self._output_dir, exist_ok=True)

        if not self._api_key:
            raise ValueError(
                "GOOGLE_API_KEY is not set. "
                "Get one at https://aistudio.google.com/app/apikey"
            )

    # ------------------------------------------------------------------
    async def _google_tts(self, text: str, output_path: str) -> None:
        """
        Generate voiceover MP3 using Google Cloud Text-to-Speech REST API.
        Uses the same GOOGLE_API_KEY — no extra billing setup needed.
        Free tier: 1 million characters/month (WaveNet), 4M standard.
        """
        import base64
        import httpx as _httpx

        # Truncate to 5000 chars (API limit per request)
        text = text[:5000]
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self._api_key}"
        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": "en-US",
                "name": "en-US-Neural2-D",   # natural male voice, free tier
                "ssmlGender": "MALE",
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": 1.0,
                "pitch": 0.0,
            },
        }
        async with _httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Google TTS failed ({resp.status_code}): {resp.text[:200]}"
                )
            audio_b64 = resp.json().get("audioContent", "")
            if not audio_b64:
                raise RuntimeError("Google TTS returned empty audio")
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(audio_b64))
        logger.info("VeoService: voiceover written to %s", output_path)

    # ------------------------------------------------------------------
    async def create_video(
        self,
        script: str,
        aspect_ratio: str = "9:16",
        caption_text: Optional[str] = None,
        niche: str = "technology",
    ) -> Dict[str, Any]:
        """Return a job token immediately — actual generation happens in wait_for_completion."""
        job_id = str(uuid4())
        return {
            "video_id": job_id,
            "status":   "processing",
            "_script":  script,
            "_niche":   niche,
        }

    # ------------------------------------------------------------------
    async def wait_for_completion(
        self,
        video_id: str,
        script: str = "",
        caption_text: Optional[str] = None,
        niche: str = "technology",
        max_wait_seconds: int = _MAX_WAIT,
    ) -> Dict[str, Any]:
        """
        Run the full Veo pipeline:
          1. Generate voiceover via Google Cloud TTS (free, uses GOOGLE_API_KEY)
          2. Split script → scene prompts
          3. Generate each clip via Veo (concurrent)
          4. Assemble clips + voiceover → final MP4 via FFmpeg
        """
        from app.services.video_assembler import VideoAssembler, _get_ffmpeg

        output_path = os.path.join(self._output_dir, f"{video_id}.mp4")
        voice_path  = os.path.join(self._output_dir, f"{video_id}_voice.mp3")
        thumb_path  = os.path.join(self._output_dir, f"{video_id}_thumb.jpg")

        try:
            # ── 1. Generate voiceover via Google Cloud TTS (free) ─────────────
            logger.info("VeoService: generating voiceover via Google TTS for job %s", video_id)
            await self._google_tts(script, voice_path)

            # ── 2. Generate Veo clips concurrently ────────────────────────────
            scenes = _split_into_scenes(script, max_scenes=4)
            logger.info("VeoService: generating %d Veo clips for job %s", len(scenes), video_id)

            clip_paths = await self._generate_clips(
                scenes=scenes,
                niche=niche,
                job_id=video_id,
                max_wait=max_wait_seconds,
            )

            if not clip_paths:
                raise RuntimeError("Veo returned no clips — check GOOGLE_API_KEY quota")

            logger.info("VeoService: %d clips ready, assembling…", len(clip_paths))

            # ── 3. Assemble: clips + voiceover → final MP4 ───────────────────
            # Pass local file paths as file:// URLs; assembler handles both
            clip_file_urls = [Path(p).as_uri() for p in clip_paths]

            assembler = VideoAssembler()
            await asyncio.to_thread(
                self._assemble_sync,
                assembler,
                clip_paths,   # pass raw paths — assembler already downloaded
                voice_path,
                output_path,
                caption_text or script[:100],
            )

            # ── 4. Thumbnail + duration ───────────────────────────────────────
            import subprocess
            thumb_ok = False
            try:
                r = subprocess.run(
                    [_get_ffmpeg(), "-y", "-ss", "1", "-i", output_path,
                     "-vframes", "1", "-q:v", "2", thumb_path],
                    capture_output=True,
                )
                thumb_ok = r.returncode == 0 and os.path.exists(thumb_path)
            except Exception:
                pass

            duration: Optional[int] = None
            try:
                r2 = subprocess.run([_get_ffmpeg(), "-i", output_path],
                                    capture_output=True, text=True)
                for line in r2.stderr.splitlines():
                    if "Duration:" in line:
                        parts = line.split("Duration:")[1].split(",")[0].strip().split(":")
                        duration = int(int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2]))
                        break
            except Exception:
                pass

            return {
                "video_id":      video_id,
                "status":        "completed",
                "video_url":     output_path,
                "thumbnail_url": thumb_path if thumb_ok else None,
                "duration":      duration,
                "provider":      "veo",
                "model":         self._model,
                "error":         None,
            }

        except Exception as exc:
            logger.error("VeoService failed for job %s: %s", video_id, exc, exc_info=True)
            return {
                "video_id":      video_id,
                "status":        "failed",
                "video_url":     None,
                "thumbnail_url": None,
                "duration":      None,
                "provider":      "veo",
                "error":         str(exc),
            }

        finally:
            # Clean up voice MP3
            if os.path.exists(voice_path):
                try:
                    os.unlink(voice_path)
                except OSError:
                    pass

    # ------------------------------------------------------------------
    async def _generate_clips(
        self,
        scenes: List[str],
        niche: str,
        job_id: str,
        max_wait: int,
    ) -> List[str]:
        """Generate one Veo clip per scene concurrently, return local file paths."""
        tasks = [
            self._generate_single_clip(
                prompt=_build_visual_prompt(scene, niche),
                out_path=os.path.join(self._output_dir, f"{job_id}_clip{i}.mp4"),
                max_wait=max_wait,
            )
            for i, scene in enumerate(scenes)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        paths = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning("VeoService: clip %d failed: %s", i, result)
            elif result:
                paths.append(result)
        return paths

    async def _generate_single_clip(
        self,
        prompt: str,
        out_path: str,
        max_wait: int,
    ) -> Optional[str]:
        """
        Call Veo API for one clip, poll until done, save to out_path.
        Returns out_path on success, None on failure.
        """
        try:
            # Run the blocking SDK calls in a thread pool
            result_path = await asyncio.to_thread(
                self._veo_blocking,
                prompt,
                out_path,
                max_wait,
            )
            return result_path
        except Exception as exc:
            logger.error("VeoService: single clip generation failed: %s", exc)
            return None

    def _veo_blocking(self, prompt: str, out_path: str, max_wait: int) -> str:
        """
        Blocking implementation — called via asyncio.to_thread.
        Uses the google-genai SDK exactly as shown in the reference code.
        """
        try:
            from google import genai as google_genai   # noqa: PLC0415
        except ImportError:
            raise RuntimeError(
                "google-genai package not installed. "
                "Run: pip install google-genai"
            )

        client = google_genai.Client(api_key=self._api_key)

        logger.info("VeoService: submitting prompt to %s: %.80s…", self._model, prompt)
        operation = client.models.generate_videos(
            model=self._model,
            prompt=prompt,
        )

        # Poll until complete
        deadline = time.time() + max_wait
        while not operation.done:
            if time.time() > deadline:
                raise TimeoutError(
                    f"Veo clip generation exceeded {max_wait}s timeout"
                )
            time.sleep(_POLL_INTERVAL)
            operation = client.operations.get(operation)

        generated_videos = operation.response.generated_videos
        if not generated_videos:
            raise RuntimeError("Veo returned an empty generated_videos list")

        video = generated_videos[0]
        video.video.save(out_path)
        logger.info("VeoService: clip saved → %s", out_path)
        return out_path

    # ------------------------------------------------------------------
    def _assemble_sync(
        self,
        assembler: Any,
        clip_paths: List[str],
        voice_path: str,
        output_path: str,
        caption: str,
    ) -> None:
        """
        Synchronous FFmpeg assembly wrapper (called via asyncio.to_thread).
        Veo clips are already on disk — we pass them directly to the assembler
        by writing a concat file instead of downloading via URLs.
        """
        import subprocess, tempfile, os, shutil
        from app.services.video_assembler import _get_ffmpeg, VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS, VIDEO_CRF

        # Re-encode each clip to the standard 1080x1920 format
        tmp_dir = tempfile.mkdtemp(prefix="veo_asm_")
        try:
            normalised = []
            for i, p in enumerate(clip_paths):
                dst = os.path.join(tmp_dir, f"norm_{i}.mp4")
                subprocess.run([
                    _get_ffmpeg(), "-y", "-i", p,
                    "-vf", (
                        f"scale={VIDEO_WIDTH}:{VIDEO_HEIGHT}:"
                        f"force_original_aspect_ratio=increase,"
                        f"crop={VIDEO_WIDTH}:{VIDEO_HEIGHT},"
                        f"fps={VIDEO_FPS}"
                    ),
                    "-an",
                    "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "fast",
                    "-pix_fmt", "yuv420p",
                    dst,
                ], capture_output=True, check=True)
                normalised.append(dst)

            # Concat all normalised clips
            concat_list = os.path.join(tmp_dir, "concat.txt")
            with open(concat_list, "w") as f:
                for p in normalised:
                    f.write(f"file '{p}'\n")

            concat_mp4 = os.path.join(tmp_dir, "concat.mp4")
            subprocess.run([
                _get_ffmpeg(), "-y",
                "-f", "concat", "-safe", "0", "-i", concat_list,
                "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "fast",
                "-pix_fmt", "yuv420p",
                concat_mp4,
            ], capture_output=True, check=True)

            # Mix voiceover
            mixed_mp4 = os.path.join(tmp_dir, "mixed.mp4")
            subprocess.run([
                _get_ffmpeg(), "-y",
                "-i", concat_mp4, "-i", voice_path,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest", mixed_mp4,
            ], capture_output=True, check=True)

            # Burn caption
            if caption:
                safe = caption.replace("'", "\\'").replace(":", "\\:").replace("\\", "\\\\")[:120]
                drawtext = (
                    f"drawtext=text='{safe}':"
                    f"fontsize=52:fontcolor=white:bordercolor=black:borderw=3:"
                    f"x=(w-text_w)/2:y=h*0.78:expansion=none"
                )
                captioned = os.path.join(tmp_dir, "captioned.mp4")
                subprocess.run([
                    _get_ffmpeg(), "-y", "-i", mixed_mp4,
                    "-vf", drawtext,
                    "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "fast",
                    "-c:a", "copy", captioned,
                ], capture_output=True, check=True)
                shutil.copy2(captioned, output_path)
            else:
                shutil.copy2(mixed_mp4, output_path)

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    # ------------------------------------------------------------------
    async def get_account_info(self) -> Dict[str, Any]:
        """Health check — confirms key is set and SDK is importable."""
        try:
            from google import genai as _g  # noqa: F401
        except ImportError:
            return {"veo": "google-genai not installed — run: pip install google-genai"}
        return {
            "veo":   f"Google API key configured, model={self._model}",
            "model": self._model,
        }

# Made with Bob
